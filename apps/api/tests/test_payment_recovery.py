from typing import Any
from unittest.mock import patch

import pytest
from django.test import override_settings
from rest_framework.test import APIClient

from apps.events.models import OutboxEvent
from apps.finance.models import SellerLedgerEntry
from apps.inventory.models import InventoryTransaction
from apps.orders.models import Order
from apps.payments.models import Payment, PaymentTransaction
from tests.test_phase20_checkout import build_checkout_setup_data
from tests.test_phase21_payments import (
    ADDRESS,
    confirm,
    create_intent,
    customer_client,
    new_key,
    place_customer_order,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def setup() -> dict[str, Any]:
    return build_checkout_setup_data()


def state_url(order: Order) -> str:
    return f"/api/v1/checkout/orders/{order.pk}/payment-state/"


def guest_order(setup: dict[str, Any]) -> tuple[APIClient, Order]:
    client = APIClient()
    added = client.post(
        "/api/v1/cart/items/",
        {"variant_id": str(setup["variant_1"].pk), "quantity": 1},
        format="json",
    )
    assert added.status_code == 201
    placed = client.post(
        "/api/v1/checkout/place-order/",
        {"customer_email": "guest@example.com", "shipping_address": ADDRESS},
        format="json",
    )
    assert placed.status_code == 201
    return client, Order.objects.get(pk=placed.data["order_id"])


def evidence_counts() -> tuple[int, ...]:
    return tuple(
        model.objects.count()
        for model in (
            Payment,
            PaymentTransaction,
            InventoryTransaction,
            SellerLedgerEntry,
            OutboxEvent,
        )
    )


def test_recovery_without_payment_is_minimal_read_only_and_not_cached(
    setup: dict[str, Any],
) -> None:
    client = customer_client(setup["customer"])
    order = place_customer_order(setup, client)
    before = evidence_counts()
    with patch("apps.payments.services.get_gateway") as gateway:
        with override_settings(PAYMENT_MOCK_GATEWAY_ENABLED=False):
            response = client.get(state_url(order))
        gateway.assert_not_called()
    assert response.status_code == 200
    assert response["Cache-Control"] == "no-store"
    assert response.data == {
        "order_id": str(order.pk),
        "order_number": order.order_number,
        "grand_total": str(order.grand_total),
        "currency": order.currency,
        "payment_status": "pending",
        "fulfillment_status": "unfulfilled",
        "payment": None,
        "resume_key": None,
    }
    assert evidence_counts() == before


def test_reload_recovers_existing_attempt_and_replays_capture_once(setup: dict[str, Any]) -> None:
    client = customer_client(setup["customer"])
    order = place_customer_order(setup, client)
    key = new_key()
    intent = create_intent(client, order, key)
    before = evidence_counts()
    for _ in range(2):
        response = client.get(state_url(order))
        assert response.status_code == 200
        assert response.data["resume_key"] == key
        assert response.data["payment"] == intent.data
    assert evidence_counts() == before
    assert (
        confirm(client, intent.data["payment_id"], response.data["resume_key"]).status_code == 200
    )
    after = evidence_counts()
    paid = client.get(state_url(order))
    assert paid.data["payment_status"] == "paid"
    assert paid.data["payment"]["status"] == "captured"
    assert paid.data["resume_key"] is None
    assert confirm(client, intent.data["payment_id"], key).status_code == 200
    assert evidence_counts() == after
    # UUID knowledge and the replay key together do not authorize a different customer.
    attacker = customer_client(setup["other_customer"])
    assert attacker.get(state_url(order)).status_code == 404
    assert confirm(attacker, intent.data["payment_id"], key).status_code == 404


def test_guest_reload_can_read_paid_evidence_only_in_original_session(
    setup: dict[str, Any],
) -> None:
    guest, order = guest_order(setup)
    key = new_key()
    intent = create_intent(guest, order, key)
    reloaded = APIClient()
    reloaded.cookies.update(guest.cookies)
    assert reloaded.get(state_url(order)).data["resume_key"] == key
    assert confirm(reloaded, intent.data["payment_id"], key).status_code == 200
    assert reloaded.get(state_url(order)).data["payment_status"] == "paid"
    for stranger in (APIClient(), customer_client(setup["customer"])):
        assert stranger.get(state_url(order)).status_code == 404
    session = reloaded.session
    session.flush()
    assert reloaded.get(state_url(order)).status_code == 404


@pytest.mark.parametrize("identity", ["other_customer", "guest", "superuser"])
def test_recovery_denies_foreign_customer_order_even_with_platform_superuser(
    setup: dict[str, Any], identity: str
) -> None:
    order = place_customer_order(setup)
    if identity == "guest":
        client = APIClient()
        session = client.session
        session["guest_order_ids"] = [str(order.pk)]
        session.save()
    else:
        user = setup["other_customer"]
        if identity == "superuser":
            user.is_superuser = True
            user.save(update_fields=["is_superuser"])
        client = customer_client(user)
    assert client.get(state_url(order)).status_code == 404


@pytest.mark.parametrize("status", ["authorized", "failed", "refunded"])
def test_non_pending_payment_never_returns_a_resume_key(setup: dict[str, Any], status: str) -> None:
    client = customer_client(setup["customer"])
    order = place_customer_order(setup, client)
    intent = create_intent(client, order, new_key())
    if status == "failed":
        assert confirm(client, intent.data["payment_id"], new_key()).status_code == 409
        key = Payment.objects.get(pk=intent.data["payment_id"]).idempotency_key
        assert (
            confirm(client, intent.data["payment_id"], key, "tok_chargeDeclined").status_code == 402
        )
    else:
        Payment.objects.filter(pk=intent.data["payment_id"]).update(status=status)
        Order.objects.filter(pk=order.pk).update(payment_status=status)
    response = client.get(state_url(order))
    assert response.status_code == 200
    assert response.data["payment"]["status"] == status
    assert response.data["resume_key"] is None


def test_cancelled_order_does_not_offer_resume(setup: dict[str, Any]) -> None:
    client = customer_client(setup["customer"])
    order = place_customer_order(setup, client)
    create_intent(client, order, new_key())
    Order.objects.filter(pk=order.pk).update(fulfillment_status="cancelled")
    response = client.get(state_url(order))
    assert response.data["fulfillment_status"] == "cancelled"
    assert response.data["resume_key"] is None


def test_read_does_not_relax_csrf_or_accept_queries_or_mutation(setup: dict[str, Any]) -> None:
    guest, order = guest_order(setup)
    key = new_key()
    intent = create_intent(guest, order, key)
    strict = APIClient(enforce_csrf_checks=True)
    strict.cookies.update(guest.cookies)
    response = strict.get(state_url(order))
    assert response.status_code == 200
    assert (
        confirm(strict, intent.data["payment_id"], response.data["resume_key"]).status_code == 403
    )
    assert strict.post(state_url(order), {}, format="json").status_code == 403
    assert strict.get(state_url(order), {"order_id": str(order.pk)}).status_code == 400
    assert guest.post(state_url(order), {}, format="json").status_code == 405
    assert guest.get("/api/v1/checkout/orders/not-a-uuid/payment-state/").status_code == 404


def test_deactivated_customer_session_cannot_read_recovery(setup: dict[str, Any]) -> None:
    order = place_customer_order(setup)
    client = APIClient()
    client.force_login(setup["customer"])
    setup["customer"].is_active = False
    setup["customer"].save(update_fields=["is_active"])
    assert client.get(state_url(order)).status_code == 404
