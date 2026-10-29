from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier
from typing import Any
from unittest.mock import patch

import pytest
from django import db
from django.core import signing
from rest_framework.test import APIClient

from apps.cart.models import Cart, CartItem
from apps.checkout.models import CheckoutAttempt, CustomerAddress
from apps.checkout.review import REVIEW_MAX_AGE, SALT
from apps.events.models import OutboxEvent
from apps.fulfillment.models import ShippingRate
from apps.inventory.models import InventoryTransaction
from apps.orders.models import Order
from tests.test_phase20_checkout import build_checkout_setup_data
from tests.test_phase21_payments import ADDRESS, customer_client

pytestmark = pytest.mark.django_db
QUOTE = "/api/v1/checkout/quote/"
PLACE = "/api/v1/checkout/place-order/"


@pytest.fixture
def setup() -> dict[str, Any]:
    data = build_checkout_setup_data()
    cart = Cart.objects.create(user=data["customer"])
    CartItem.objects.create(cart=cart, variant=data["variant_1"], quantity=2)
    return {**data, "cart": cart, "client": customer_client(data["customer"])}


def reviewed(setup: dict[str, Any], **changes: Any) -> dict[str, Any]:
    quote_input = {"shipping_address": ADDRESS, **changes}
    quote = setup["client"].post(QUOTE, quote_input, format="json")
    assert quote.status_code == 200
    assert quote["Cache-Control"] == "no-store"
    return {
        **quote_input,
        "cart_id": str(setup["cart"].pk),
        "quote_token": quote.data["quote_token"],
        "idempotency_key": "review-approved-attempt-0001",
    }


def test_review_places_exact_total_and_replays_after_expiry_and_cart_refill(
    setup: dict[str, Any],
) -> None:
    body = reviewed(setup)
    placed = setup["client"].post(PLACE, body, format="json")
    assert placed.status_code == 201
    assert placed.data["grand_total"] == "55.00"
    CartItem.objects.create(cart=setup["cart"], variant=setup["variant_1"], quantity=1)
    with patch("django.core.signing.time.time", return_value=10**12):
        replay = setup["client"].post(PLACE, body, format="json")
    assert replay.status_code == 201
    assert replay.data == placed.data
    assert Order.objects.count() == 1
    assert setup["cart"].items.get().quantity == 1
    assert InventoryTransaction.objects.filter(type="reservation").count() == 1


@pytest.mark.parametrize("change", ["price", "quantity", "shipping", "address", "method", "coupon"])
def test_changed_review_cannot_create_business_writes(setup: dict[str, Any], change: str) -> None:
    body = reviewed(setup, coupon_code="SAVE10") if change == "coupon" else reviewed(setup)
    if change == "price":
        variant = setup["variant_1"]
        variant.price = Decimal("30.00")
        variant.save(update_fields=["price"])
    elif change == "quantity":
        setup["cart"].items.update(quantity=1)
    elif change == "shipping":
        ShippingRate.objects.filter(method=setup["sm_standard_1"]).update(rate=Decimal("6.00"))
    elif change == "address":
        body["shipping_address"] = {**ADDRESS, "line1": "A different street"}
    elif change == "method":
        body["shipping_selections"] = {str(setup["seller_1"].pk): str(setup["sm_express_1"].pk)}
    else:
        coupon = setup["coupon_1"]
        coupon.is_active = False
        coupon.save(update_fields=["is_active"])
    response = setup["client"].post(PLACE, body, format="json")
    assert response.status_code == 409
    assert "quote_token" in response.data
    assert not Order.objects.exists()
    assert not CheckoutAttempt.objects.exists()
    assert not InventoryTransaction.objects.exists()
    assert not OutboxEvent.objects.exists()
    assert setup["cart"].items.exists()
    setup["inv_1"].refresh_from_db()
    assert setup["inv_1"].quantity_reserved == 0
    setup["coupon_1"].refresh_from_db()
    assert setup["coupon_1"].usage_count == 0


@pytest.mark.parametrize("kind", ["missing", "tampered", "expired", "oversized"])
def test_invalid_review_fails_closed(setup: dict[str, Any], kind: str) -> None:
    body = reviewed(setup)
    if kind == "missing":
        body.pop("quote_token")
    elif kind == "tampered":
        body["quote_token"] += "invalid"
    elif kind == "oversized":
        body["quote_token"] = "x" * 257
    else:
        with patch("django.core.signing.time.time", return_value=1):
            body = reviewed(setup)
    response = setup["client"].post(PLACE, body, format="json")
    assert response.status_code == (400 if kind == "oversized" else 409)
    assert "quote_token" in response.data
    assert not Order.objects.exists()


def test_saved_address_must_match_displayed_snapshot_before_quote_and_placement(
    setup: dict[str, Any],
) -> None:
    address = CustomerAddress.objects.create(user=setup["customer"], **ADDRESS)
    body = reviewed(setup, address_id=str(address.pk))
    address.line1 = "Changed in another tab"
    address.save(update_fields=["line1"])
    quote = setup["client"].post(
        QUOTE, {"address_id": str(address.pk), "shipping_address": ADDRESS}, format="json"
    )
    assert quote.status_code == 409
    placed = setup["client"].post(PLACE, body, format="json")
    assert placed.status_code == 409
    assert not Order.objects.exists()


def test_token_contains_only_keyed_digest_and_timestamp_and_is_not_cart_authority(
    setup: dict[str, Any],
) -> None:
    body = reviewed(setup)
    digest = signing.TimestampSigner(salt=SALT).unsign(body["quote_token"], max_age=REVIEW_MAX_AGE)
    assert len(digest) == 64
    assert all(character in "0123456789abcdef" for character in digest)
    other = customer_client(setup["other_customer"])
    cart = Cart.objects.create(user=setup["other_customer"])
    CartItem.objects.create(cart=cart, variant=setup["variant_1"], quantity=2)
    body["cart_id"] = str(cart.pk)
    assert other.post(PLACE, body, format="json").status_code == 409
    guest = APIClient()
    assert guest.get("/api/v1/cart/").status_code == 200
    assert guest.post(PLACE, body, format="json").status_code == 409
    assert not Order.objects.exists()


def test_stock_change_with_enough_inventory_does_not_invalidate_review(
    setup: dict[str, Any],
) -> None:
    body = reviewed(setup)
    inventory = setup["inv_1"]
    inventory.quantity_on_hand = 8
    inventory.save(update_fields=["quantity_on_hand"])
    assert setup["client"].post(PLACE, body, format="json").status_code == 201


def test_new_review_cannot_replace_payload_under_successful_key(setup: dict[str, Any]) -> None:
    body = reviewed(setup)
    assert setup["client"].post(PLACE, body, format="json").status_code == 201
    CartItem.objects.create(cart=setup["cart"], variant=setup["variant_1"], quantity=1)
    new_body = reviewed(setup)
    assert setup["client"].post(PLACE, new_body, format="json").status_code == 409
    assert Order.objects.count() == 1


def test_reviewed_guest_placement_still_requires_real_csrf(setup: dict[str, Any]) -> None:
    client = APIClient(enforce_csrf_checks=True)
    assert client.post(QUOTE, {"shipping_address": ADDRESS}, format="json").status_code == 403
    assert client.post(PLACE, reviewed(setup), format="json").status_code == 403


def test_guest_uses_own_session_review_and_cannot_transfer_it(setup: dict[str, Any]) -> None:
    client = APIClient()
    assert (
        client.post(
            "/api/v1/cart/items/",
            {"variant_id": str(setup["variant_1"].pk), "quantity": 2},
            format="json",
        ).status_code
        == 201
    )
    cart = Cart.objects.get(session_key=client.session.session_key)
    body = reviewed({"client": client, "cart": cart})
    body["customer_email"] = "guest@example.com"
    assert client.post(PLACE, body, format="json").status_code == 201
    assert client.post(PLACE, body, format="json").status_code == 201
    assert Order.objects.count() == 1
    other = APIClient()
    assert other.get("/api/v1/cart/").status_code == 200
    assert other.post(PLACE, body, format="json").status_code == 409


@pytest.mark.django_db(transaction=True, serialized_rollback=True)
def test_concurrent_reviewed_attempt_is_placed_exactly_once(setup: dict[str, Any]) -> None:
    body = reviewed(setup)
    barrier = Barrier(2)

    def submit() -> Any:
        db.close_old_connections()
        try:
            client = customer_client(setup["customer"])
            barrier.wait(timeout=10)
            response = client.post(PLACE, body, format="json")
            return response.status_code, response.data
        finally:
            db.connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(submit) for _ in range(2)]
        results = [future.result(timeout=30) for future in futures]
    assert results[0] == results[1]
    assert results[0][0] == 201
    assert Order.objects.count() == CheckoutAttempt.objects.count() == 1
    assert InventoryTransaction.objects.filter(type="reservation").count() == 1
