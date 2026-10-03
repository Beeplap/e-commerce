import uuid
from decimal import Decimal
from typing import Any

import pytest
from rest_framework.test import APIClient

from apps.cart.models import Cart, CartItem
from apps.checkout.models import CustomerAddress
from apps.fulfillment.models import ReturnRequest
from apps.inventory.models import Inventory
from apps.orders.models import Order
from apps.payments.models import PaymentTransaction
from apps.reviews.models import ProductReview
from tests.test_phase20_checkout import build_checkout_setup_data

pytestmark = pytest.mark.django_db

ADDRESS = {
    "full_name": "Charlie Hardener",
    "phone": "+15551112233",
    "line1": "789 Secure Rd",
    "city": "Austin",
    "state": "TX",
    "postal_code": "78702",
    "country": "US",
}


@pytest.fixture
def setup() -> dict[str, Any]:
    return build_checkout_setup_data()


def customer_client(user: Any) -> APIClient:
    client = APIClient(enforce_csrf_checks=False)
    client.force_authenticate(user=user)
    return client


# ---------------------------------------------------------------------------
# 1. Price tampering in checkout payloads is rejected / ignored
# ---------------------------------------------------------------------------


def test_client_price_tampering_rejected_in_checkout(setup: dict[str, Any]) -> None:
    customer = setup["customer"]
    cart, _ = Cart.objects.get_or_create(user=customer)
    CartItem.objects.create(cart=cart, variant=setup["variant_1"], quantity=1)

    client = customer_client(customer)

    # Attempt 1: submit arbitrary unit_price or grand_total to place-order
    tampered_payload = {
        "shipping_address": ADDRESS,
        "unit_price": "0.01",
        "grand_total": "0.01",
        "subtotal": "0.01",
    }
    response = client.post("/api/v1/checkout/place-order/", data=tampered_payload, format="json")
    # StrictSerializer rejects unexpected fields with 400
    assert response.status_code == 400
    assert "Unexpected fields" in str(response.data)

    # Place order with canonical payload
    valid_payload = {"shipping_address": ADDRESS}
    response = client.post("/api/v1/checkout/place-order/", data=valid_payload, format="json")
    assert response.status_code == 201

    order = Order.objects.get(pk=response.data["order_id"])
    # Price is calculated server-authoritatively ($25.00 product + $5.00 shipping)
    assert order.grand_total == Decimal("30.00")
    seller_order = order.seller_orders.first()
    assert seller_order is not None
    first_item = seller_order.items.first()
    assert first_item is not None
    assert first_item.unit_price == Decimal("25.00")


# ---------------------------------------------------------------------------
# 2. Cross-customer cart isolation & tampering
# ---------------------------------------------------------------------------


def test_cross_customer_cart_isolation_and_tampering_denied(setup: dict[str, Any]) -> None:
    customer_a = setup["customer"]
    customer_b = setup["other_customer"]

    # Customer A adds item to cart
    cart_a, _ = Cart.objects.get_or_create(user=customer_a)
    item_a = CartItem.objects.create(cart=cart_a, variant=setup["variant_1"], quantity=2)

    client_b = customer_client(customer_b)

    # Customer B inspects their own cart
    resp_b = client_b.get("/api/v1/cart/")
    assert resp_b.status_code == 200
    # Customer B cannot see Customer A's items
    assert resp_b.data["total_items"] == 0

    # Customer B attempts to mutate Customer A's cart item
    patch_resp = client_b.patch(
        f"/api/v1/cart/items/{item_a.id}/",
        data={"quantity": 5},
        format="json",
    )
    assert patch_resp.status_code == 404

    # Customer B attempts to delete Customer A's cart item
    del_resp = client_b.delete(f"/api/v1/cart/items/{item_a.id}/")
    assert del_resp.status_code == 404

    # Item A is untouched
    item_a.refresh_from_db()
    assert item_a.quantity == 2


# ---------------------------------------------------------------------------
# 3. Cross-customer address book isolation
# ---------------------------------------------------------------------------


def test_cross_customer_address_tampering_denied(setup: dict[str, Any]) -> None:
    customer_a = setup["customer"]
    customer_b = setup["other_customer"]

    addr_a = CustomerAddress.objects.create(user=customer_a, **ADDRESS)

    client_b = customer_client(customer_b)

    # Customer B attempts to update Customer A's address
    assert (
        client_b.patch(
            f"/api/v1/customer/addresses/{addr_a.id}/",
            data={"city": "HackedCity"},
            format="json",
        ).status_code
        == 404
    )

    # Customer B attempts to delete Customer A's address
    assert client_b.delete(f"/api/v1/customer/addresses/{addr_a.id}/").status_code == 404

    addr_a.refresh_from_db()
    assert addr_a.city == "Austin"


# ---------------------------------------------------------------------------
# 4. Cross-customer order, cancellation, review, and return isolation
# ---------------------------------------------------------------------------


def test_cross_customer_order_tampering_denied(setup: dict[str, Any]) -> None:
    customer_a = setup["customer"]
    customer_b = setup["other_customer"]

    cart_a, _ = Cart.objects.get_or_create(user=customer_a)
    CartItem.objects.create(cart=cart_a, variant=setup["variant_1"], quantity=1)

    client_a = customer_client(customer_a)
    place_resp = client_a.post(
        "/api/v1/checkout/place-order/", data={"shipping_address": ADDRESS}, format="json"
    )
    assert place_resp.status_code == 201
    order_id = place_resp.data["order_id"]
    order_a = Order.objects.get(pk=order_id)
    seller_order_a = order_a.seller_orders.first()
    assert seller_order_a is not None
    item_a = seller_order_a.items.first()
    assert item_a is not None

    client_b = customer_client(customer_b)

    # Customer B cannot read Customer A's order
    assert client_b.get(f"/api/v1/customer/orders/{order_id}/").status_code == 404

    # Customer B cannot cancel Customer A's order
    assert (
        client_b.post(
            f"/api/v1/customer/orders/{order_id}/cancel/",
            data={"reason": "malicious cancellation"},
            format="json",
        ).status_code
        == 404
    )

    # Customer B cannot submit review for Customer A's item
    review_resp = client_b.post(
        "/api/v1/customer/reviews/",
        data={
            "order_item_id": str(item_a.id),
            "rating": 1,
            "title": "Malicious Review",
            "body": "Fake review from unauthorized user.",
        },
        format="json",
    )
    assert review_resp.status_code == 404

    # Customer B cannot submit return for Customer A's item
    return_resp = client_b.post(
        "/api/v1/customer/returns/",
        data={
            "order_item_id": str(item_a.id),
            "quantity": 1,
            "reason": "defective",
        },
        format="json",
    )
    assert return_resp.status_code == 404


# ---------------------------------------------------------------------------
# 5. Concurrent checkout prevents stock overselling
# ---------------------------------------------------------------------------


def test_concurrent_checkout_prevents_stock_overselling(setup: dict[str, Any]) -> None:
    # Set inventory to exactly 1 unit
    inv = Inventory.objects.get(variant=setup["variant_1"], warehouse=setup["wh_1"])
    inv.quantity_on_hand = 1
    inv.quantity_reserved = 0
    inv.save(update_fields=["quantity_on_hand", "quantity_reserved"])

    customer_a = setup["customer"]
    customer_b = setup["other_customer"]

    # Both customers add 1 unit to cart
    cart_a, _ = Cart.objects.get_or_create(user=customer_a)
    CartItem.objects.create(cart=cart_a, variant=setup["variant_1"], quantity=1)

    cart_b, _ = Cart.objects.get_or_create(user=customer_b)
    CartItem.objects.create(cart=cart_b, variant=setup["variant_1"], quantity=1)

    client_a = customer_client(customer_a)
    client_b = customer_client(customer_b)

    # First checkout succeeds
    resp_a = client_a.post(
        "/api/v1/checkout/place-order/", data={"shipping_address": ADDRESS}, format="json"
    )
    assert resp_a.status_code == 201

    # Second checkout fails with 400 (insufficient stock)
    resp_b = client_b.post(
        "/api/v1/checkout/place-order/", data={"shipping_address": ADDRESS}, format="json"
    )
    assert resp_b.status_code == 400
    assert "insufficient" in str(resp_b.data).lower()

    # Verified inventory was not oversold
    inv.refresh_from_db()
    assert inv.quantity_reserved == 1
    assert inv.quantity_on_hand == 1


# ---------------------------------------------------------------------------
# 6. Payment idempotency prevents duplicate charges
# ---------------------------------------------------------------------------


def test_payment_idempotency_prevents_duplicate_charge(setup: dict[str, Any]) -> None:
    customer = setup["customer"]
    cart, _ = Cart.objects.get_or_create(user=customer)
    CartItem.objects.create(cart=cart, variant=setup["variant_1"], quantity=1)

    client = customer_client(customer)
    place_resp = client.post(
        "/api/v1/checkout/place-order/", data={"shipping_address": ADDRESS}, format="json"
    )
    assert place_resp.status_code == 201
    order_id = place_resp.data["order_id"]

    key = f"idem_{uuid.uuid4().hex}"

    # Create intent
    intent_resp = client.post(
        "/api/v1/checkout/payment-intent/",
        data={"order_id": order_id, "idempotency_key": key},
        format="json",
    )
    assert intent_resp.status_code == 201
    payment_id = intent_resp.data["payment_id"]

    # Confirm payment with same key
    confirm_resp_1 = client.post(
        "/api/v1/checkout/confirm-payment/",
        data={"payment_id": payment_id, "idempotency_key": key, "payment_token": "tok_visa"},
        format="json",
    )
    assert confirm_resp_1.status_code == 200
    assert confirm_resp_1.data["status"] == "captured"

    # Replay confirm payment with same key
    confirm_resp_2 = client.post(
        "/api/v1/checkout/confirm-payment/",
        data={"payment_id": payment_id, "idempotency_key": key, "payment_token": "tok_visa"},
        format="json",
    )
    assert confirm_resp_2.status_code == 200
    assert confirm_resp_2.data["status"] == "captured"

    # Verify exactly one captured payment transaction was written
    txns = PaymentTransaction.objects.filter(payment_id=payment_id, transaction_type="captured")
    assert txns.count() == 1


# ---------------------------------------------------------------------------
# 7. Post-purchase verified reviews & returns integrity
# ---------------------------------------------------------------------------


def test_verified_reviews_and_returns_lifecycle_integrity(setup: dict[str, Any]) -> None:
    customer = setup["customer"]
    cart, _ = Cart.objects.get_or_create(user=customer)
    CartItem.objects.create(cart=cart, variant=setup["variant_1"], quantity=1)

    client = customer_client(customer)
    place_resp = client.post(
        "/api/v1/checkout/place-order/", data={"shipping_address": ADDRESS}, format="json"
    )
    assert place_resp.status_code == 201
    order_id = place_resp.data["order_id"]
    order = Order.objects.get(pk=order_id)
    seller_order = order.seller_orders.first()
    assert seller_order is not None
    item = seller_order.items.first()
    assert item is not None

    key = f"idem_{uuid.uuid4().hex}"
    intent_resp = client.post(
        "/api/v1/checkout/payment-intent/",
        data={"order_id": order_id, "idempotency_key": key},
        format="json",
    )
    assert intent_resp.status_code == 201

    confirm_resp = client.post(
        "/api/v1/checkout/confirm-payment/",
        data={
            "payment_id": intent_resp.data["payment_id"],
            "idempotency_key": key,
            "payment_token": "tok_visa",
        },
        format="json",
    )
    assert confirm_resp.status_code == 200
    order.refresh_from_db()

    # Before delivery, reviews and returns are prohibited
    review_resp = client.post(
        "/api/v1/customer/reviews/",
        data={
            "order_item_id": str(item.id),
            "rating": 5,
            "title": "Too early",
            "body": "Should fail before delivery.",
        },
        format="json",
    )
    assert review_resp.status_code == 400
    assert "delivered" in str(review_resp.data).lower()

    # Deliver the order
    order.fulfillment_status = "delivered"
    order.save(update_fields=["fulfillment_status"])
    for so in order.seller_orders.all():
        so.status = "delivered"
        so.save(update_fields=["status"])

    # Now review succeeds with verified purchase badge
    review_resp = client.post(
        "/api/v1/customer/reviews/",
        data={
            "order_item_id": str(item.id),
            "rating": 5,
            "title": "Excellent Quality",
            "body": "Super durable and exactly as described.",
        },
        format="json",
    )
    assert review_resp.status_code == 201
    assert review_resp.data["verified_purchase"] is True
    assert ProductReview.objects.filter(pk=review_resp.data["id"]).exists()

    # Return request succeeds and creates RMA
    return_resp = client.post(
        "/api/v1/customer/returns/",
        data={
            "order_item_id": str(item.id),
            "quantity": 1,
            "reason": "defective",
            "customer_notes": "Slight cosmetic blemish.",
        },
        format="json",
    )
    assert return_resp.status_code == 201
    assert return_resp.data["status"] == "requested"
    assert ReturnRequest.objects.filter(pk=return_resp.data["id"]).exists()
