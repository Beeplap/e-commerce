from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from io import BytesIO
from threading import Barrier
from typing import Any
from unittest.mock import patch
from uuid import uuid4

import pytest
from django import db
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import storages
from django.test import override_settings
from PIL import Image
from rest_framework.test import APIClient

from apps.audit.models import AuditLog
from apps.cart.models import Cart, CartItem
from apps.catalog.models import ProductImage, ProductVariant
from apps.events.models import OutboxEvent
from apps.fulfillment.models import ShippingMethod, ShippingRate
from apps.inventory.models import Inventory, InventoryTransaction
from apps.orders.models import Order
from apps.sellers.models import Seller
from tests.test_phase20_checkout import build_checkout_setup_data

pytestmark = pytest.mark.django_db
ADDRESS = {
    "full_name": "Checkout Customer",
    "phone": "+15551234567",
    "line1": "123 Main Street",
    "city": "Austin",
    "state": "TX",
    "postal_code": "78701",
    "country": "US",
}


@pytest.fixture
def checkout() -> dict[str, Any]:
    data = build_checkout_setup_data()
    cart = Cart.objects.create(user=data["customer"])
    CartItem.objects.create(cart=cart, variant=data["variant_1"], quantity=2)
    client = APIClient()
    client.force_authenticate(data["customer"])
    return {**data, "cart": cart, "client": client}


def payload(**changes: Any) -> dict[str, Any]:
    return {
        "shipping_address": ADDRESS,
        "idempotency_key": "checkout-integrity-attempt-0001",
        **changes,
    }


def test_replay_preserves_new_cart_items_and_does_not_reserve_again(
    checkout: dict[str, Any],
) -> None:
    client = checkout["client"]
    first = client.post("/api/v1/checkout/place-order/", payload(), format="json")
    assert first.status_code == 201
    CartItem.objects.create(cart=checkout["cart"], variant=checkout["variant_1"], quantity=1)
    again = client.post("/api/v1/checkout/place-order/", payload(), format="json")
    assert again.status_code == 201
    assert again.data == first.data
    assert Order.objects.count() == 1
    assert OutboxEvent.objects.filter(topic="orders.order.created").count() == 1
    assert InventoryTransaction.objects.filter(type="reservation").count() == 1
    checkout["inv_1"].refresh_from_db()
    assert checkout["inv_1"].quantity_reserved == 2
    assert checkout["cart"].items.get().quantity == 1


def test_reused_key_with_changed_request_is_a_conflict(checkout: dict[str, Any]) -> None:
    client = checkout["client"]
    first = client.post("/api/v1/checkout/place-order/", payload(), format="json")
    assert first.status_code == 201
    changed = payload(shipping_address={**ADDRESS, "line1": "Another destination"})
    again = client.post("/api/v1/checkout/place-order/", changed, format="json")
    assert again.status_code == 409
    assert Order.objects.count() == 1


def test_checkout_keys_are_scoped_to_the_authenticated_cart(checkout: dict[str, Any]) -> None:
    first = checkout["client"].post("/api/v1/checkout/place-order/", payload(), format="json")
    other_cart = Cart.objects.create(user=checkout["other_customer"])
    CartItem.objects.create(cart=other_cart, variant=checkout["variant_1"], quantity=1)
    other = APIClient()
    other.force_authenticate(checkout["other_customer"])
    second = other.post("/api/v1/checkout/place-order/", payload(), format="json")
    assert first.status_code == second.status_code == 201
    assert first.data["order_id"] != second.data["order_id"]
    assert second.data["customer_email"] == checkout["other_customer"].email


def test_guest_retry_is_session_scoped(checkout: dict[str, Any]) -> None:
    clients = [APIClient(), APIClient()]
    responses = []
    for client in clients:
        added = client.post(
            "/api/v1/cart/items/",
            {"variant_id": str(checkout["variant_1"].pk), "quantity": 1},
            format="json",
        )
        assert added.status_code == 201
        attempt = payload(customer_email="guest@example.invalid")
        first = client.post("/api/v1/checkout/place-order/", attempt, format="json")
        again = client.post("/api/v1/checkout/place-order/", attempt, format="json")
        assert first.status_code == again.status_code == 201
        assert first.data == again.data
        responses.append(first.data)
    assert responses[0]["order_id"] != responses[1]["order_id"]


@pytest.mark.parametrize("key", ["short", "x" * 129, "invalid/key/with/slashes"])
def test_invalid_idempotency_key_is_rejected(checkout: dict[str, Any], key: str) -> None:
    response = checkout["client"].post(
        "/api/v1/checkout/place-order/", payload(idempotency_key=key), format="json"
    )
    assert response.status_code == 400
    assert "idempotency_key" in response.data
    assert not Order.objects.exists()


def test_failed_placement_does_not_consume_attempt(checkout: dict[str, Any]) -> None:
    inventory = checkout["inv_1"]
    inventory.quantity_on_hand = 0
    inventory.save(update_fields=["quantity_on_hand"])
    failed = checkout["client"].post("/api/v1/checkout/place-order/", payload(), format="json")
    assert failed.status_code == 400
    inventory.quantity_on_hand = 20
    inventory.save(update_fields=["quantity_on_hand"])
    retried = checkout["client"].post("/api/v1/checkout/place-order/", payload(), format="json")
    assert retried.status_code == 201
    assert Order.objects.count() == 1


def test_currency_is_preserved_from_catalog_through_order(checkout: dict[str, Any]) -> None:
    Seller.objects.filter(pk=checkout["seller_1"].pk).update(default_currency="NPR")
    ShippingRate.objects.filter(method__seller=checkout["seller_1"]).update(currency="NPR")
    client = checkout["client"]
    product = client.get(f"/api/v1/storefront/products/{checkout['variant_1'].product_id}")
    assert product.status_code == 200
    assert product.data["currency"] == "NPR"
    cart = client.get("/api/v1/cart/")
    assert cart.status_code == 200
    assert cart.data["currency"] == "NPR"
    quote = client.post("/api/v1/checkout/quote/", payload(idempotency_key=None), format="json")
    # Quote input intentionally has no placement-only idempotency field.
    assert quote.status_code == 400
    quote = client.post("/api/v1/checkout/quote/", {"shipping_address": ADDRESS}, format="json")
    assert quote.status_code == 200
    assert quote.data["currency"] == "NPR"
    placed = client.post("/api/v1/checkout/place-order/", payload(), format="json")
    assert placed.status_code == 201
    order = Order.objects.get(pk=placed.data["order_id"])
    assert order.currency == placed.data["currency"] == "NPR"
    assert order.grand_total == Decimal("55.00")


def test_product_image_links_match_real_download_routes(checkout: dict[str, Any]) -> None:
    catalog_storage = {"BACKEND": "django.core.files.storage.InMemoryStorage"}
    with override_settings(STORAGES={**settings.STORAGES, "catalog": catalog_storage}):
        image_bytes = BytesIO()
        Image.new("RGB", (2, 2), "white").save(image_bytes, format="PNG")
        content = image_bytes.getvalue()
        key = storages["catalog"].save(f"{uuid4()}.png", ContentFile(content))
        image = ProductImage.objects.create(
            seller=checkout["seller_1"],
            product=checkout["variant_1"].product,
            storage_key=key,
            content_type="image/png",
            size=len(content),
        )
        client = checkout["client"]
        listing = client.get("/api/v1/storefront/products")
        assert listing.status_code == 200
        card = next(p for p in listing.data["results"] if str(p["id"]) == str(image.product_id))
        detail = client.get(f"/api/v1/storefront/products/{image.product_id}")
        assert detail.status_code == 200
        assert card["thumbnail_url"] == detail.data["images"][0]["url"]
        downloaded = client.get(card["thumbnail_url"])
        assert downloaded.status_code == 200
        assert b"".join(downloaded.streaming_content) == content
        storages["catalog"].delete(key)
        missing = client.get(card["thumbnail_url"])
        assert missing.status_code == 404


def test_discount_allocations_sum_exactly_to_seller_discount(checkout: dict[str, Any]) -> None:
    cart = checkout["cart"]
    cart.items.all().delete()
    variant = checkout["variant_1"]
    variant.price = Decimal("0.05")
    variant.save(update_fields=["price"])
    CartItem.objects.create(cart=cart, variant=variant, quantity=1)
    for n in range(2):
        extra = ProductVariant.objects.create(
            seller=checkout["seller_1"],
            product=variant.product,
            sku=f"ROUNDING-{n}",
            price=Decimal("0.05"),
            status="active",
        )
        Inventory.objects.create(warehouse=checkout["wh_1"], variant=extra, quantity_on_hand=5)
        CartItem.objects.create(cart=cart, variant=extra, quantity=1)
    promotion = checkout["coupon_1"].promotion
    promotion.min_order_amount = Decimal("0.00")
    promotion.save(update_fields=["min_order_amount"])
    response = checkout["client"].post(
        "/api/v1/checkout/place-order/", payload(coupon_code="SAVE10"), format="json"
    )
    assert response.status_code == 201
    order = Order.objects.get(pk=response.data["order_id"])
    seller_order = order.seller_orders.get()
    assert order.discount_total == seller_order.discount_total == Decimal("0.02")
    items = list(seller_order.items.all())
    assert sum(item.discount_amount for item in items) == seller_order.discount_total
    assert sum(item.total for item in items) == seller_order.subtotal - seller_order.discount_total


def test_guest_cannot_quote_using_another_customers_address(checkout: dict[str, Any]) -> None:
    from apps.checkout.models import CustomerAddress

    address = CustomerAddress.objects.create(user=checkout["customer"], **ADDRESS)
    guest = APIClient()
    guest.post("/api/v1/cart/items/", {"variant_id": str(checkout["variant_1"].pk)}, format="json")
    response = guest.post("/api/v1/checkout/quote/", {"address_id": str(address.pk)}, format="json")
    assert response.status_code == 400
    assert "address_id" in response.data


def test_guest_cannot_bypass_coupon_usage_accounting(checkout: dict[str, Any]) -> None:
    guest = APIClient()
    guest.post("/api/v1/cart/items/", {"variant_id": str(checkout["variant_1"].pk)}, format="json")
    response = guest.post(
        "/api/v1/checkout/place-order/",
        payload(customer_email="guest@example.invalid", coupon_code="SAVE10"),
        format="json",
    )
    assert response.status_code == 400
    assert "coupon_code" in response.data
    assert not Order.objects.exists()
    checkout["coupon_1"].refresh_from_db()
    assert checkout["coupon_1"].usage_count == 0


@pytest.mark.parametrize("weight", [None, Decimal("3.00")])
def test_weight_limited_delivery_needs_a_known_weight_within_bounds(
    checkout: dict[str, Any],
    weight: Decimal | None,
) -> None:
    variant = checkout["variant_1"]
    variant.weight = weight
    variant.save(update_fields=["weight"])
    ShippingRate.objects.filter(method__seller=checkout["seller_1"]).update(
        weight_max=Decimal("1.00")
    )
    response = checkout["client"].post(
        "/api/v1/checkout/quote/", {"shipping_address": ADDRESS}, format="json"
    )
    assert response.status_code == 400
    assert "shipping" in response.data


def test_verified_email_does_not_transfer_to_a_different_address(checkout: dict[str, Any]) -> None:
    user = checkout["customer"]
    user.is_email_verified = True
    user.save(update_fields=["is_email_verified"])
    same = checkout["client"].patch(
        "/api/v1/customer/profile/", {"email": user.email.upper()}, format="json"
    )
    assert same.status_code == 200
    assert same.data["is_email_verified"] is True
    assert not AuditLog.objects.filter(action="customer.email.changed").exists()
    changed = checkout["client"].patch(
        "/api/v1/customer/profile/", {"email": "new-address@example.invalid"}, format="json"
    )
    assert changed.status_code == 200
    assert changed.data["is_email_verified"] is False
    user.refresh_from_db()
    assert user.is_email_verified is False
    audit = AuditLog.objects.get(action="customer.email.changed", actor_id=user.pk)
    assert audit.target_id == user.pk
    assert audit.changes == {"fields": ["email", "is_email_verified"]}
    assert "new-address" not in str(audit.changes)


def test_email_change_rolls_back_if_its_audit_cannot_be_written(checkout: dict[str, Any]) -> None:
    from apps.customers.services import update_customer_profile

    user = checkout["customer"]
    original_email = user.email
    user.is_email_verified = True
    user.save(update_fields=["is_email_verified"])
    with (
        patch(
            "apps.customers.services.AuditLog.objects.create",
            side_effect=RuntimeError("audit unavailable"),
        ),
        pytest.raises(RuntimeError, match="audit unavailable"),
    ):
        update_customer_profile(user, {"email": "changed@example.invalid"})
    user.refresh_from_db()
    assert user.email == original_email
    assert user.is_email_verified is True


def test_mixed_currency_addition_is_rejected_without_changing_cart(
    checkout: dict[str, Any],
) -> None:
    Seller.objects.filter(pk=checkout["seller_2"].pk).update(default_currency="EUR")
    added = checkout["client"].post(
        "/api/v1/cart/items/",
        {"variant_id": str(checkout["variant_2"].pk), "quantity": 1},
        format="json",
    )
    assert added.status_code == 400
    assert "currency" in added.data
    assert checkout["cart"].items.count() == 1


def test_existing_mixed_currency_cart_cannot_be_checked_out(checkout: dict[str, Any]) -> None:
    Seller.objects.filter(pk=checkout["seller_2"].pk).update(default_currency="EUR")
    CartItem.objects.create(cart=checkout["cart"], variant=checkout["variant_2"], quantity=1)
    for path in ["quote", "place-order"]:
        response = checkout["client"].post(
            f"/api/v1/checkout/{path}/", {"shipping_address": ADDRESS}, format="json"
        )
        assert response.status_code == 400
        assert "currency" in response.data
    assert not Order.objects.exists()


@pytest.mark.parametrize("failure", ["country", "currency", "disabled", "unconfigured"])
def test_shipping_must_have_a_real_eligible_rate(checkout: dict[str, Any], failure: str) -> None:
    address = ADDRESS
    methods = ShippingMethod.objects.filter(seller=checkout["seller_1"])
    if failure == "country":
        address = {**ADDRESS, "country": "CA"}
    elif failure == "currency":
        ShippingRate.objects.filter(method__in=methods).update(currency="EUR")
    elif failure == "disabled":
        methods.update(is_active=False)
    else:
        ShippingRate.objects.filter(method__in=methods).delete()
    response = checkout["client"].post(
        "/api/v1/checkout/place-order/", payload(shipping_address=address), format="json"
    )
    assert response.status_code == 400
    assert "shipping" in response.data
    assert not Order.objects.exists()
    assert not InventoryTransaction.objects.exists()
    assert checkout["cart"].items.count() == 1


def test_explicit_zero_rate_is_allowed_but_foreign_selection_is_not(
    checkout: dict[str, Any],
) -> None:
    ShippingRate.objects.filter(method=checkout["sm_standard_1"]).update(rate=Decimal("0.00"))
    quote = checkout["client"].post(
        "/api/v1/checkout/quote/", {"shipping_address": ADDRESS}, format="json"
    )
    assert quote.status_code == 200
    assert quote.data["shipping_total"] == "0.00"
    assert quote.data["sellers"][0]["selected_shipping_method"]["method_id"] == str(
        checkout["sm_standard_1"].pk
    )
    response = checkout["client"].post(
        "/api/v1/checkout/place-order/",
        payload(
            shipping_selections={str(checkout["seller_1"].pk): str(checkout["sm_standard_2"].pk)}
        ),
        format="json",
    )
    assert response.status_code == 400
    assert "shipping_selections" in response.data
    assert not Order.objects.exists()


def test_archived_product_cannot_be_ordered_from_an_existing_cart(checkout: dict[str, Any]) -> None:
    product = checkout["variant_1"].product
    product.status = "archived"
    product.save(update_fields=["status"])
    response = checkout["client"].post("/api/v1/checkout/place-order/", payload(), format="json")
    assert response.status_code == 400
    assert not Order.objects.exists()
    assert not InventoryTransaction.objects.exists()


@pytest.mark.django_db(transaction=True, serialized_rollback=True)
def test_concurrent_same_attempt_creates_one_order(checkout: dict[str, Any]) -> None:
    barrier = Barrier(2)
    user = checkout["customer"]
    attempt = payload(idempotency_key=str(uuid4()))

    def submit() -> tuple[int, Any]:
        try:
            client = APIClient()
            client.force_authenticate(user)
            barrier.wait(timeout=10)
            response = client.post("/api/v1/checkout/place-order/", attempt, format="json")
            return response.status_code, response.data
        finally:
            db.connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(submit) for _ in range(2)]
        results = [future.result(timeout=30) for future in futures]
    assert [status for status, _ in results] == [201, 201]
    assert results[0][1] == results[1][1]
    assert Order.objects.count() == 1
