import hashlib
import hmac
import json
import uuid
from decimal import Decimal
from typing import Any

import pytest
from django.conf import settings
from django.db import DatabaseError, transaction
from django.test import override_settings
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.cart.models import Cart, CartItem
from apps.events.models import OutboxEvent
from apps.finance.models import SellerLedgerEntry
from apps.inventory.models import Inventory, InventoryTransaction
from apps.orders.models import Order, SellerOrder
from apps.orders.services import (
    begin_processing_seller_order,
    cancel_seller_order,
    ship_seller_order,
)
from apps.payments.models import Payment, PaymentTransaction
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
INTENT_URL = "/api/v1/checkout/payment-intent/"
CONFIRM_URL = "/api/v1/checkout/confirm-payment/"
WEBHOOK_URL = "/api/v1/webhooks/payment/"


@pytest.fixture
def setup() -> dict[str, Any]:
    return build_checkout_setup_data()


def new_key() -> str:
    return f"idem_{uuid.uuid4().hex}"


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


def create_intent(client: APIClient, order: Order, key: str) -> Any:
    return client.post(
        INTENT_URL,
        data={"order_id": str(order.pk), "idempotency_key": key},
        format="json",
    )


def confirm(client: APIClient, payment_id: str, key: str, token: str = "tok_visa") -> Any:
    return client.post(
        CONFIRM_URL,
        data={"payment_id": payment_id, "idempotency_key": key, "payment_token": token},
        format="json",
    )


def sign(body: bytes) -> str:
    secret = settings.PAYMENT_WEBHOOK_SECRET.encode("utf-8")
    return hmac.new(secret, body, hashlib.sha256).hexdigest()


def post_webhook(client: APIClient, event: dict[str, Any], signature: str | None = None) -> Any:
    body = json.dumps(event).encode("utf-8")
    if signature == "":
        return client.post(WEBHOOK_URL, data=body, content_type="application/json")
    sig = signature or sign(body)
    return client.post(
        WEBHOOK_URL,
        data=body,
        content_type="application/json",
        HTTP_X_PAYMENT_SIGNATURE=sig,
    )


# ---------------------------------------------------------------------------
# Capture: order confirmation, reservation -> sale, seller settlement, outbox
# ---------------------------------------------------------------------------


def test_successful_capture_confirms_orders_converts_reservations_and_settles(
    setup: dict[str, Any],
) -> None:
    client = customer_client(setup["customer"])
    order = place_customer_order(setup, client)
    key = new_key()

    intent = create_intent(client, order, key)
    assert intent.status_code == 201
    assert intent.data["status"] == "pending"
    assert Decimal(intent.data["amount"]) == order.grand_total
    assert "client_secret" not in intent.data

    response = confirm(client, intent.data["payment_id"], key)
    assert response.status_code == 200, response.data
    assert response.data["status"] == "captured"

    order.refresh_from_db()
    assert order.payment_status == Order.PaymentStatus.PAID
    seller_orders = list(order.seller_orders.all())
    assert len(seller_orders) == 2
    for seller_order in seller_orders:
        assert seller_order.status == SellerOrder.Status.CONFIRMED
        assert seller_order.inventory_committed is True
        entry_types = set(
            SellerLedgerEntry.objects.filter(seller_order=seller_order).values_list(
                "entry_type", flat=True
            )
        )
        assert entry_types == {
            SellerLedgerEntry.EntryType.SALE,
            SellerLedgerEntry.EntryType.COMMISSION,
        }

    inv_1 = Inventory.objects.get(pk=setup["inv_1"].pk)
    inv_2 = Inventory.objects.get(pk=setup["inv_2"].pk)
    assert (inv_1.quantity_on_hand, inv_1.quantity_reserved) == (18, 0)
    assert (inv_2.quantity_on_hand, inv_2.quantity_reserved) == (14, 0)
    assert InventoryTransaction.objects.filter(type=InventoryTransaction.Type.SALE).count() == 2
    assert OutboxEvent.objects.filter(topic="payments.payment.captured").count() == 1


# ---------------------------------------------------------------------------
# Idempotency: replays never double charge; key reuse conflicts
# ---------------------------------------------------------------------------


def test_replayed_payment_with_same_key_returns_existing_without_double_charge(
    setup: dict[str, Any],
) -> None:
    client = customer_client(setup["customer"])
    order = place_customer_order(setup, client)
    key = new_key()

    first_intent = create_intent(client, order, key)
    replay_intent = create_intent(client, order, key)
    assert replay_intent.status_code == 200
    assert replay_intent.data["payment_id"] == first_intent.data["payment_id"]
    payment_id = first_intent.data["payment_id"]

    # A second concurrent attempt with a different key cannot open another charge.
    assert create_intent(client, order, new_key()).status_code == 409

    first = confirm(client, payment_id, key)
    second = confirm(client, payment_id, key)
    assert first.status_code == second.status_code == 200
    assert first.data["payment_id"] == second.data["payment_id"]

    payment = Payment.objects.get(pk=payment_id)
    captured = payment.transactions.filter(transaction_type=PaymentTransaction.Type.CAPTURED)
    assert captured.count() == 1
    assert (
        SellerLedgerEntry.objects.filter(
            seller_order__order=order, entry_type=SellerLedgerEntry.EntryType.SALE
        ).count()
        == 2
    )
    assert Inventory.objects.get(pk=setup["inv_1"].pk).quantity_on_hand == 18
    assert InventoryTransaction.objects.filter(type=InventoryTransaction.Type.SALE).count() == 2

    # Wrong key for an existing payment and re-paying a paid order both conflict.
    assert confirm(client, payment_id, new_key()).status_code == 409
    assert create_intent(client, order, new_key()).status_code == 409


def test_idempotency_key_cannot_be_reused_for_another_order(setup: dict[str, Any]) -> None:
    client = customer_client(setup["customer"])
    first_order = place_customer_order(setup, client)
    second_order = place_customer_order(setup, client)
    key = new_key()

    assert create_intent(client, first_order, key).status_code == 201
    assert create_intent(client, second_order, key).status_code == 409
    assert Payment.objects.filter(order=second_order).count() == 0


# ---------------------------------------------------------------------------
# Failure: stock released, order cancelled, retry blocked
# ---------------------------------------------------------------------------


def test_failed_payment_releases_reserved_stock_and_cancels_order(setup: dict[str, Any]) -> None:
    client = customer_client(setup["customer"])
    order = place_customer_order(setup, client)
    assert Inventory.objects.get(pk=setup["inv_1"].pk).quantity_reserved == 2
    key = new_key()
    payment_id = create_intent(client, order, key).data["payment_id"]

    response = confirm(client, payment_id, key, token="tok_chargeDeclined")
    assert response.status_code == 402
    assert response.data["status"] == "failed"
    assert response.data["detail"]

    order.refresh_from_db()
    assert order.payment_status == Order.PaymentStatus.FAILED
    assert order.fulfillment_status == Order.FulfillmentStatus.CANCELLED
    assert set(order.seller_orders.values_list("status", flat=True)) == {
        SellerOrder.Status.CANCELLED
    }
    inv_1 = Inventory.objects.get(pk=setup["inv_1"].pk)
    inv_2 = Inventory.objects.get(pk=setup["inv_2"].pk)
    assert (inv_1.quantity_on_hand, inv_1.quantity_reserved) == (20, 0)
    assert (inv_2.quantity_on_hand, inv_2.quantity_reserved) == (15, 0)
    assert InventoryTransaction.objects.filter(type=InventoryTransaction.Type.RELEASE).count() == 2
    assert not SellerLedgerEntry.objects.filter(seller_order__order=order).exists()
    assert OutboxEvent.objects.filter(topic="payments.payment.failed").count() == 1

    # Replaying the declined attempt returns the recorded failure; a new attempt is rejected.
    assert confirm(client, payment_id, key, token="tok_visa").status_code == 402
    assert Payment.objects.get(pk=payment_id).status == Payment.Status.FAILED
    assert create_intent(client, order, new_key()).status_code == 409


# ---------------------------------------------------------------------------
# Webhooks: HMAC verification, amount checks, event dedupe
# ---------------------------------------------------------------------------


def test_webhook_with_invalid_signature_rejected(setup: dict[str, Any]) -> None:
    client = customer_client(setup["customer"])
    order = place_customer_order(setup, client)
    payment_id = create_intent(client, order, new_key()).data["payment_id"]
    event = {
        "id": "evt_invalid_sig",
        "type": "payment_intent.succeeded",
        "data": {"payment_id": payment_id, "amount": str(order.grand_total), "currency": "USD"},
    }
    anonymous = APIClient()

    assert post_webhook(anonymous, event, signature="0" * 64).status_code == 400
    assert post_webhook(anonymous, event, signature="").status_code == 400
    with override_settings(PAYMENT_WEBHOOK_SECRET=""):
        # Unconfigured signing fails closed even for a correctly formed signature.
        assert post_webhook(anonymous, event).status_code == 400

    assert Payment.objects.get(pk=payment_id).status == Payment.Status.PENDING
    assert Order.objects.get(pk=order.pk).payment_status == Order.PaymentStatus.PENDING


def test_signed_webhook_captures_once_and_rejects_amount_tampering(
    setup: dict[str, Any],
) -> None:
    client = customer_client(setup["customer"])
    order = place_customer_order(setup, client)
    payment_id = create_intent(client, order, new_key()).data["payment_id"]
    anonymous = APIClient()

    tampered = {
        "id": "evt_tampered",
        "type": "payment_intent.succeeded",
        "data": {"payment_id": payment_id, "amount": "0.01", "currency": "USD"},
    }
    assert post_webhook(anonymous, tampered).status_code == 400
    assert Payment.objects.get(pk=payment_id).status == Payment.Status.PENDING

    event = {
        "id": "evt_success_1",
        "type": "payment_intent.succeeded",
        "data": {
            "payment_id": payment_id,
            "amount": str(order.grand_total),
            "currency": "USD",
            "gateway_reference": "gw_ref_123",
        },
    }
    first = post_webhook(anonymous, event)
    assert first.status_code == 200
    assert first.data["status"] == "captured"
    duplicate = post_webhook(anonymous, event)
    assert duplicate.status_code == 200
    assert duplicate.data["status"] == "duplicate"

    payment = Payment.objects.get(pk=payment_id)
    assert payment.status == Payment.Status.CAPTURED
    assert payment.reference_id == "gw_ref_123"
    assert Order.objects.get(pk=order.pk).payment_status == Order.PaymentStatus.PAID
    assert Inventory.objects.get(pk=setup["inv_1"].pk).quantity_on_hand == 18


# ---------------------------------------------------------------------------
# Authorization: cross-customer, guest session binding, CSRF
# ---------------------------------------------------------------------------


def test_cross_customer_and_foreign_guest_payment_access_denied(setup: dict[str, Any]) -> None:
    owner = customer_client(setup["customer"])
    order = place_customer_order(setup, owner)
    key = new_key()
    payment_id = create_intent(owner, order, key).data["payment_id"]

    attacker = customer_client(setup["other_customer"])
    assert create_intent(attacker, order, new_key()).status_code == 404
    assert confirm(attacker, payment_id, key).status_code == 404
    anonymous = APIClient(enforce_csrf_checks=False)
    assert create_intent(anonymous, order, new_key()).status_code == 404
    assert confirm(anonymous, payment_id, key).status_code == 404
    assert Payment.objects.get(pk=payment_id).status == Payment.Status.PENDING

    # A guest can pay for the order placed in its own session, but nobody else can.
    guest = APIClient(enforce_csrf_checks=False)
    guest.post(
        "/api/v1/cart/items/",
        data={"variant_id": str(setup["variant_1"].pk), "quantity": 1},
        format="json",
    )
    placed = guest.post(
        "/api/v1/checkout/place-order/",
        data={"customer_email": "guest@example.com", "shipping_address": ADDRESS},
        format="json",
    )
    assert placed.status_code == 201, placed.data
    guest_order = Order.objects.get(pk=placed.data["order_id"])
    other_guest = APIClient(enforce_csrf_checks=False)
    assert create_intent(other_guest, guest_order, new_key()).status_code == 404
    assert create_intent(attacker, guest_order, new_key()).status_code == 404
    guest_key = new_key()
    guest_intent = create_intent(guest, guest_order, guest_key)
    assert guest_intent.status_code == 201
    assert confirm(guest, guest_intent.data["payment_id"], guest_key).status_code == 200


def test_payment_endpoints_enforce_csrf_and_reject_card_data(setup: dict[str, Any]) -> None:
    order = place_customer_order(setup)
    strict = APIClient(enforce_csrf_checks=True)
    strict.force_login(setup["customer"])
    assert create_intent(strict, order, new_key()).status_code == 403

    client = customer_client(setup["customer"])
    key = new_key()
    payment_id = create_intent(client, order, key).data["payment_id"]
    smuggled = client.post(
        CONFIRM_URL,
        data={
            "payment_id": payment_id,
            "idempotency_key": key,
            "payment_token": "tok_visa",
            "card_number": "4242424242424242",
            "amount": "0.01",
        },
        format="json",
    )
    assert smuggled.status_code == 400
    assert Payment.objects.get(pk=payment_id).status == Payment.Status.PENDING
    assert create_intent(client, order, "short").status_code == 400


# ---------------------------------------------------------------------------
# Integration with fulfillment, fail-closed gateway and append-only audit trail
# ---------------------------------------------------------------------------


def test_paid_order_ships_without_double_consumption_and_cannot_be_cancelled(
    setup: dict[str, Any],
) -> None:
    client = customer_client(setup["customer"])
    order = place_customer_order(setup, client)
    key = new_key()
    payment_id = create_intent(client, order, key).data["payment_id"]
    assert confirm(client, payment_id, key).status_code == 200

    seller = setup["seller_1"]
    seller_user = seller.memberships.get().user
    seller_order = order.seller_orders.get(seller=seller)

    with pytest.raises(ValidationError):
        cancel_seller_order(
            seller_id=seller.pk,
            actor=seller_user,
            seller_order_id=seller_order.pk,
            reason="Changed my mind",
        )

    begin_processing_seller_order(
        seller_id=seller.pk, actor=seller_user, seller_order_id=seller_order.pk
    )
    ship_seller_order(
        seller_id=seller.pk,
        actor=seller_user,
        seller_order_id=seller_order.pk,
        carrier="FedEx",
        tracking_number="TRACK123",
    )
    inv_1 = Inventory.objects.get(pk=setup["inv_1"].pk)
    assert (inv_1.quantity_on_hand, inv_1.quantity_reserved) == (18, 0)
    assert (
        InventoryTransaction.objects.filter(
            inventory=inv_1, type=InventoryTransaction.Type.SALE
        ).count()
        == 1
    )


def test_mock_gateway_disabled_fails_closed(setup: dict[str, Any]) -> None:
    client = customer_client(setup["customer"])
    order = place_customer_order(setup, client)
    with override_settings(PAYMENT_MOCK_GATEWAY_ENABLED=False):
        assert create_intent(client, order, new_key()).status_code == 503
    assert not Payment.objects.filter(order=order).exists()


def test_payment_transactions_are_append_only(setup: dict[str, Any]) -> None:
    client = customer_client(setup["customer"])
    order = place_customer_order(setup, client)
    payment_id = create_intent(client, order, new_key()).data["payment_id"]
    record = PaymentTransaction.objects.get(payment_id=payment_id)

    with pytest.raises(DatabaseError), transaction.atomic():
        PaymentTransaction.objects.filter(pk=record.pk).update(success=False)
    with pytest.raises(DatabaseError), transaction.atomic():
        PaymentTransaction.objects.filter(pk=record.pk).delete()
