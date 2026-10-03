from typing import Any

import pytest
from rest_framework.test import APIClient

from apps.cart.models import Cart, CartItem
from apps.fulfillment.models import ReturnRequest
from apps.inventory.models import Inventory
from apps.orders.models import Order, SellerOrder
from tests.test_phase20_checkout import build_checkout_setup_data

pytestmark = pytest.mark.django_db

ADDRESS = {
    "full_name": "Alice Smith",
    "phone": "+15551234567",
    "line1": "123 Main St",
    "city": "Austin",
    "state": "TX",
    "postal_code": "78701",
    "country": "US",
}


@pytest.fixture
def setup() -> dict[str, Any]:
    return build_checkout_setup_data()


def customer_client(user: Any) -> APIClient:
    client = APIClient(enforce_csrf_checks=False)
    client.force_authenticate(user=user)
    return client


def place_customer_order(setup: dict[str, Any], client: APIClient | None = None) -> Order:
    customer = setup["customer"]
    cart, _ = Cart.objects.get_or_create(user=customer)
    CartItem.objects.create(cart=cart, variant=setup["variant_1"], quantity=2)
    CartItem.objects.create(cart=cart, variant=setup["variant_2"], quantity=1)
    response = (client or customer_client(customer)).post(
        "/api/v1/checkout/place-order/", data={"shipping_address": ADDRESS}, format="json"
    )
    assert response.status_code == 201, response.data
    return Order.objects.get(pk=response.data["order_id"])


# ---------------------------------------------------------------------------
# Profile & Address Book
# ---------------------------------------------------------------------------


def test_customer_profile_get_and_patch(setup: dict[str, Any]) -> None:
    client = customer_client(setup["customer"])
    customer = setup["customer"]

    # Read default profile
    response = client.get("/api/v1/customer/profile/")
    assert response.status_code == 200, response.data
    assert response.data["email"] == customer.email
    assert response.data["first_name"] == customer.first_name
    assert response.data["phone"] == ""

    # Update profile
    patch_resp = client.patch(
        "/api/v1/customer/profile/",
        data={
            "first_name": "Alicia",
            "last_name": "Smithson",
            "phone": "+15559876543",
        },
        format="json",
    )
    assert patch_resp.status_code == 200, patch_resp.data
    assert patch_resp.data["first_name"] == "Alicia"
    assert patch_resp.data["last_name"] == "Smithson"
    assert patch_resp.data["phone"] == "+15559876543"

    customer.refresh_from_db()
    assert customer.first_name == "Alicia"
    assert customer.customer_profile.phone == "+15559876543"

    # Reject duplicate email update
    other = setup["other_customer"]
    conflict = client.patch(
        "/api/v1/customer/profile/",
        data={"email": other.email},
        format="json",
    )
    assert conflict.status_code == 400


def test_customer_address_book_crud(setup: dict[str, Any]) -> None:
    client = customer_client(setup["customer"])

    # Create address
    res = client.post(
        "/api/v1/customer/addresses/",
        data=ADDRESS,
        format="json",
    )
    assert res.status_code == 201, res.data
    addr_id = res.data["id"]

    # List addresses
    list_res = client.get("/api/v1/customer/addresses/")
    assert list_res.status_code == 200
    assert len(list_res.data) == 1
    assert list_res.data[0]["id"] == addr_id

    # Patch address
    patch_res = client.patch(
        f"/api/v1/customer/addresses/{addr_id}/",
        data={"line2": "Suite 500"},
        format="json",
    )
    assert patch_res.status_code == 200
    assert patch_res.data["line2"] == "Suite 500"

    # Delete address
    del_res = client.delete(f"/api/v1/customer/addresses/{addr_id}/")
    assert del_res.status_code == 204


# ---------------------------------------------------------------------------
# Order History & Tenant/Customer Isolation
# ---------------------------------------------------------------------------


def test_customer_order_history_and_isolation(setup: dict[str, Any]) -> None:
    client = customer_client(setup["customer"])
    attacker = customer_client(setup["other_customer"])
    order = place_customer_order(setup, client)

    # Customer sees order in history
    history = client.get("/api/v1/customer/orders/")
    assert history.status_code == 200, history.data
    assert history.data["count"] == 1
    assert history.data["results"][0]["id"] == str(order.pk)
    assert history.data["results"][0]["order_number"] == order.order_number

    # Attacker sees empty history
    attacker_history = attacker.get("/api/v1/customer/orders/")
    assert attacker_history.status_code == 200
    assert attacker_history.data["count"] == 0

    # Customer sees detailed order with packages
    detail = client.get(f"/api/v1/customer/orders/{order.pk}/")
    assert detail.status_code == 200, detail.data
    assert detail.data["id"] == str(order.pk)
    assert len(detail.data["packages"]) == 2

    # Attacker receives 404 for other customer's order
    assert attacker.get(f"/api/v1/customer/orders/{order.pk}/").status_code == 404

    # Anonymous user is denied with 403
    anon = APIClient(enforce_csrf_checks=False)
    assert anon.get(f"/api/v1/customer/orders/{order.pk}/").status_code == 403


# ---------------------------------------------------------------------------
# Order Cancellation & Inventory Release
# ---------------------------------------------------------------------------


def test_customer_cancel_pending_order_releases_inventory(setup: dict[str, Any]) -> None:
    client = customer_client(setup["customer"])
    order = place_customer_order(setup, client)

    # Invariants before cancel: stock is reserved
    inv_1 = Inventory.objects.get(variant=setup["variant_1"])
    inv_2 = Inventory.objects.get(variant=setup["variant_2"])
    assert inv_1.quantity_reserved == 2
    assert inv_2.quantity_reserved == 1

    # Customer cancels the pending order
    res = client.post(
        f"/api/v1/customer/orders/{order.pk}/cancel/",
        data={"reason": "Found a better deal elsewhere"},
        format="json",
    )
    assert res.status_code == 200, res.data
    assert res.data["status"] == "cancelled"
    assert res.data["fulfillment_status"] == "cancelled"

    order.refresh_from_db()
    assert order.fulfillment_status == Order.FulfillmentStatus.CANCELLED

    for so in order.seller_orders.all():
        assert so.status == SellerOrder.Status.CANCELLED

    # Stock reservations are completely released
    inv_1.refresh_from_db()
    inv_2.refresh_from_db()
    assert inv_1.quantity_reserved == 0
    assert inv_2.quantity_reserved == 0

    # Re-cancelling returns 400
    re_cancel = client.post(
        f"/api/v1/customer/orders/{order.pk}/cancel/",
        data={"reason": "cancel again"},
        format="json",
    )
    assert re_cancel.status_code == 400


def test_customer_cannot_cancel_foreign_or_processing_order(setup: dict[str, Any]) -> None:
    client = customer_client(setup["customer"])
    attacker = customer_client(setup["other_customer"])
    order = place_customer_order(setup, client)

    # Attacker receives 404 attempting to cancel someone else's order
    assert attacker.post(f"/api/v1/customer/orders/{order.pk}/cancel/").status_code == 404

    # Seller order processing blocks customer cancellation
    so = order.seller_orders.first()
    assert so is not None
    so.status = SellerOrder.Status.PROCESSING
    so.save()

    cancel_fail = client.post(f"/api/v1/customer/orders/{order.pk}/cancel/")
    assert cancel_fail.status_code == 400
    assert "already being processed" in cancel_fail.data["detail"]


# ---------------------------------------------------------------------------
# Verified Product Reviews
# ---------------------------------------------------------------------------


def test_verified_product_review_for_delivered_item(setup: dict[str, Any]) -> None:
    client = customer_client(setup["customer"])
    order = place_customer_order(setup, client)
    seller_order = order.seller_orders.first()
    assert seller_order is not None
    order_item = seller_order.items.first()
    assert order_item is not None

    # Marking order as paid and seller order as delivered
    order.payment_status = Order.PaymentStatus.PAID
    order.save(update_fields=["payment_status"])
    seller_order.status = SellerOrder.Status.DELIVERED
    seller_order.save(update_fields=["status"])

    res = client.post(
        "/api/v1/customer/reviews/",
        data={
            "order_item_id": str(order_item.id),
            "rating": 5,
            "title": "Excellent quality!",
            "body": "These earbuds exceeded my expectations. Sound is crystal clear.",
        },
        format="json",
    )
    assert res.status_code == 201, res.data
    assert res.data["rating"] == 5
    assert res.data["verified_purchase"] is True
    assert str(res.data["product_id"]) == str(order_item.product_id)

    # Duplicate review for same product is rejected
    dup_res = client.post(
        "/api/v1/customer/reviews/",
        data={
            "order_item_id": str(order_item.id),
            "rating": 4,
            "title": "Another review",
            "body": "Attempting second review",
        },
        format="json",
    )
    assert dup_res.status_code == 400


def test_product_review_rejected_for_undelivered_or_foreign_item(setup: dict[str, Any]) -> None:
    client = customer_client(setup["customer"])
    attacker = customer_client(setup["other_customer"])
    order = place_customer_order(setup, client)
    seller_order = order.seller_orders.first()
    assert seller_order is not None
    order_item = seller_order.items.first()
    assert order_item is not None

    # Undelivered order item review is rejected with 400
    undelivered_res = client.post(
        "/api/v1/customer/reviews/",
        data={
            "order_item_id": str(order_item.id),
            "rating": 5,
            "title": "Too early",
            "body": "Has not arrived yet",
        },
        format="json",
    )
    assert undelivered_res.status_code == 400
    assert "delivered" in undelivered_res.data["detail"]

    # Foreign customer review attempt receives 404
    foreign_res = attacker.post(
        "/api/v1/customer/reviews/",
        data={
            "order_item_id": str(order_item.id),
            "rating": 5,
            "title": "Fraud review",
            "body": "I never ordered this",
        },
        format="json",
    )
    assert foreign_res.status_code == 404


# ---------------------------------------------------------------------------
# Customer Return Requests (RMA)
# ---------------------------------------------------------------------------


def test_customer_return_request_rma_creates_seller_record(setup: dict[str, Any]) -> None:
    client = customer_client(setup["customer"])
    order = place_customer_order(setup, client)
    seller_order = order.seller_orders.first()
    assert seller_order is not None
    order_item = seller_order.items.first()
    assert order_item is not None

    # Mark as delivered
    seller_order.status = SellerOrder.Status.DELIVERED
    seller_order.save(update_fields=["status"])

    res = client.post(
        "/api/v1/customer/returns/",
        data={
            "order_item_id": str(order_item.id),
            "quantity": 1,
            "reason": "defective",
            "customer_notes": "Left earbud has static noise.",
        },
        format="json",
    )
    assert res.status_code == 201, res.data
    assert res.data["return_number"].startswith("RET-")
    assert res.data["status"] == "requested"
    assert res.data["seller_name"] == seller_order.seller.display_name

    rma = ReturnRequest.objects.get(pk=res.data["id"])
    assert rma.seller == seller_order.seller
    assert rma.customer == setup["customer"]
    assert rma.items.count() == 1
    first_item = rma.items.first()
    assert first_item is not None
    assert first_item.quantity == 1


def test_customer_return_request_rejected_for_pending_or_foreign_item(
    setup: dict[str, Any],
) -> None:
    client = customer_client(setup["customer"])
    attacker = customer_client(setup["other_customer"])
    order = place_customer_order(setup, client)
    seller_order = order.seller_orders.first()
    assert seller_order is not None
    order_item = seller_order.items.first()
    assert order_item is not None

    # Pending order cannot be returned
    pending_res = client.post(
        "/api/v1/customer/returns/",
        data={
            "order_item_id": str(order_item.id),
            "quantity": 1,
            "reason": "changed_mind",
        },
        format="json",
    )
    assert pending_res.status_code == 400
    assert "shipped or delivered" in pending_res.data["detail"]

    # Foreign customer receives 404
    foreign_res = attacker.post(
        "/api/v1/customer/returns/",
        data={
            "order_item_id": str(order_item.id),
            "quantity": 1,
            "reason": "changed_mind",
        },
        format="json",
    )
    assert foreign_res.status_code == 404
