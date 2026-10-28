from concurrent.futures import ThreadPoolExecutor
from threading import Event
from typing import Any
from unittest.mock import patch
from uuid import uuid4

import pytest
from django import db
from django.db import DatabaseError, transaction
from rest_framework.test import APIClient

from apps.cart.models import Cart, CartItem
from apps.cart.services import merge_guest_cart_into_user_cart
from apps.checkout import services
from apps.checkout.models import CheckoutAttempt, CheckoutAttemptCancellation
from apps.events.models import OutboxEvent
from apps.inventory.models import InventoryTransaction
from apps.orders.models import Order
from tests.test_phase20_checkout import build_checkout_setup_data
from tests.test_phase21_payments import ADDRESS, customer_client

pytestmark = pytest.mark.django_db
URL = "/api/v1/checkout/recover-placement/"
PLACE = "/api/v1/checkout/place-order/"
KEY = "checkout-recovery-original-attempt"


@pytest.fixture
def setup() -> dict[str, Any]:
    data = build_checkout_setup_data()
    cart = Cart.objects.create(user=data["customer"])
    CartItem.objects.create(cart=cart, variant=data["variant_1"], quantity=2)
    return {**data, "cart": cart, "client": customer_client(data["customer"])}


def payload(cart: Cart, key: str = KEY) -> dict[str, Any]:
    return {
        "cart_id": str(cart.pk),
        "idempotency_key": key,
        "shipping_address": ADDRESS,
        "customer_email": "guest@example.com",
    }


def recover(client: APIClient, cart: Cart, key: str = KEY) -> Any:
    return client.post(URL, {"cart_id": str(cart.pk), "idempotency_key": key}, format="json")


def test_lost_placement_recovers_only_order_identifier_and_preserves_refilled_cart(
    setup: dict[str, Any],
) -> None:
    client, cart = setup["client"], setup["cart"]
    placed = client.post(PLACE, payload(cart), format="json")
    assert placed.status_code == 201
    CartItem.objects.create(cart=cart, variant=setup["variant_1"], quantity=1)
    before = (InventoryTransaction.objects.count(), OutboxEvent.objects.count())
    for _ in range(2):
        response = recover(client, cart)
        assert response.status_code == 200
        assert response["Cache-Control"] == "no-store"
        assert response.data == {"status": "placed", "order_id": placed.data["order_id"]}
    assert cart.items.get().quantity == 1
    assert Order.objects.count() == 1
    assert not CheckoutAttemptCancellation.objects.exists()
    assert before == (InventoryTransaction.objects.count(), OutboxEvent.objects.count())


def test_recovery_closes_missing_attempt_and_blocks_late_original_submission(
    setup: dict[str, Any],
) -> None:
    client, cart = setup["client"], setup["cart"]
    for _ in range(2):
        response = recover(client, cart)
        assert response.data == {"status": "cancelled", "order_id": None}
    assert CheckoutAttemptCancellation.objects.count() == 1
    original = client.post(PLACE, payload(cart), format="json")
    assert original.status_code == 409
    assert cart.items.get().quantity == 2
    assert not Order.objects.exists()
    assert not InventoryTransaction.objects.filter(type="reservation").exists()
    assert (
        client.post(
            PLACE, payload(cart, "checkout-recovery-new-attempt"), format="json"
        ).status_code
        == 201
    )


@pytest.mark.parametrize("attacker", ["customer", "guest", "superuser"])
def test_known_cart_and_attempt_do_not_authorize_foreign_recovery(
    setup: dict[str, Any], attacker: str
) -> None:
    if attacker == "guest":
        client = APIClient()
    else:
        user = setup["other_customer"]
        if attacker == "superuser":
            user.is_superuser = True
            user.save(update_fields=["is_superuser"])
        client = customer_client(user)
    assert recover(client, setup["cart"]).status_code == 404
    assert not CheckoutAttemptCancellation.objects.exists()
    placed = setup["client"].post(PLACE, payload(setup["cart"]), format="json")
    assert placed.status_code == 201
    assert recover(client, setup["cart"]).status_code == 404


def make_guest(setup: dict[str, Any]) -> tuple[APIClient, Cart]:
    client = APIClient()
    assert (
        client.post(
            "/api/v1/cart/items/",
            {"variant_id": str(setup["variant_1"].pk), "quantity": 1},
            format="json",
        ).status_code
        == 201
    )
    return client, Cart.objects.get(session_key=client.session.session_key)


def test_guest_can_restore_order_binding_lost_between_commit_and_response(
    setup: dict[str, Any],
) -> None:
    guest, cart = make_guest(setup)
    placed = guest.post(PLACE, payload(cart), format="json")
    assert placed.status_code == 201
    session = guest.session
    session.pop("guest_order_ids")
    session.save()
    reloaded = APIClient()
    reloaded.cookies.update(guest.cookies)
    order_url = f"/api/v1/checkout/orders/{placed.data['order_id']}/payment-state/"
    assert reloaded.get(order_url).status_code == 404
    assert recover(reloaded, cart).data["order_id"] == placed.data["order_id"]
    assert reloaded.get(order_url).status_code == 200
    assert recover(APIClient(), cart).status_code == 404
    assert recover(setup["client"], cart).status_code == 404
    expired = reloaded.session
    expired.flush()
    assert recover(reloaded, cart).status_code == 404


def test_cart_replacement_cannot_reopen_old_closed_attempt(setup: dict[str, Any]) -> None:
    old_cart = setup["cart"]
    old_id = old_cart.pk
    assert recover(setup["client"], old_cart).status_code == 200
    old_cart.delete()
    with db.connection.cursor() as cursor:
        cursor.execute("SET CONSTRAINTS checkout_cancel_preserve_delete IMMEDIATE")
    replacement = Cart.objects.create(user=setup["customer"])
    CartItem.objects.create(cart=replacement, variant=setup["variant_1"], quantity=1)
    old_cart.pk = old_id
    assert setup["client"].post(PLACE, payload(old_cart), format="json").status_code == 409
    assert recover(setup["client"], old_cart).status_code == 404
    assert not Order.objects.exists()


def test_guest_cart_merge_preserves_items_without_reopening_closed_attempt(
    setup: dict[str, Any],
) -> None:
    guest, cart = make_guest(setup)
    original = payload(cart)
    assert recover(guest, cart).status_code == 200
    guest_key = guest.session.session_key
    assert guest_key is not None
    merged = merge_guest_cart_into_user_cart(guest_session_key=guest_key, user=setup["customer"])
    with db.connection.cursor() as cursor:
        cursor.execute("SET CONSTRAINTS checkout_cancel_preserve_delete IMMEDIATE")
    assert merged.items.get(variant=setup["variant_1"]).quantity == 3
    assert not Cart.objects.filter(pk=cart.pk).exists()
    assert not CheckoutAttemptCancellation.objects.filter(cart_id=cart.pk).exists()
    assert setup["client"].post(PLACE, original, format="json").status_code == 409
    assert not Order.objects.exists()


def test_recovery_limit_fails_closed_without_evicting_records(setup: dict[str, Any]) -> None:
    with patch.object(services, "MAX_CANCELLED_CHECKOUT_ATTEMPTS", 1):
        assert recover(setup["client"], setup["cart"]).status_code == 200
        assert recover(setup["client"], setup["cart"], "another-recovery-key").status_code == 429
        assert recover(setup["client"], setup["cart"]).status_code == 200
    assert CheckoutAttemptCancellation.objects.count() == 1
    assert not CheckoutAttemptCancellation.objects.filter(key="another-recovery-key").exists()


def test_postgres_preserves_closed_keys_and_forbids_a_placed_outcome(setup: dict[str, Any]) -> None:
    cart, client = setup["cart"], setup["client"]
    assert recover(client, cart).status_code == 200
    marker = CheckoutAttemptCancellation.objects.get(cart=cart)
    for action in (
        lambda: CheckoutAttemptCancellation.objects.filter(pk=marker.pk).update(
            key="changed-recovery-key"
        ),
        lambda: CheckoutAttemptCancellation.objects.filter(pk=marker.pk).delete(),
    ):
        with pytest.raises(DatabaseError), transaction.atomic():
            action()
            with db.connection.cursor() as cursor:
                cursor.execute("SET CONSTRAINTS checkout_cancel_preserve_delete IMMEDIATE")
    placed = client.post(PLACE, payload(cart, "another-original-attempt"), format="json")
    assert placed.status_code == 201
    with pytest.raises(DatabaseError), transaction.atomic():
        CheckoutAttempt.objects.create(
            cart=cart,
            key=KEY,
            order_id=placed.data["order_id"],
            request_digest="a" * 64,
            response={},
        )
    assert CheckoutAttemptCancellation.objects.filter(pk=marker.pk, key=KEY).exists()


def test_postgres_does_not_close_an_already_committed_attempt(setup: dict[str, Any]) -> None:
    cart = setup["cart"]
    assert setup["client"].post(PLACE, payload(cart), format="json").status_code == 201
    with pytest.raises(DatabaseError), transaction.atomic():
        CheckoutAttemptCancellation.objects.create(cart=cart, key=KEY)
    assert not CheckoutAttemptCancellation.objects.exists()
    original = CheckoutAttempt.objects.get(cart=cart, key=KEY)
    with pytest.raises(DatabaseError), transaction.atomic():
        CheckoutAttempt.objects.filter(pk=original.pk).update(response={})
    with pytest.raises(DatabaseError), transaction.atomic():
        CheckoutAttempt.objects.filter(pk=original.pk).delete()
        with db.connection.cursor() as cursor:
            cursor.execute("SET CONSTRAINTS checkout_attempt_preserve_delete IMMEDIATE")
    assert CheckoutAttempt.objects.filter(pk=original.pk).exists()


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"cart_id": "bad", "idempotency_key": KEY},
        {"cart_id": str(uuid4()), "idempotency_key": "short"},
        {"cart_id": str(uuid4()), "idempotency_key": KEY, "order_id": str(uuid4())},
    ],
)
def test_recovery_input_is_explicit_and_bounded(
    setup: dict[str, Any], body: dict[str, Any]
) -> None:
    assert setup["client"].post(URL, body, format="json").status_code == 400
    assert not CheckoutAttemptCancellation.objects.exists()


def test_recovery_requires_csrf_and_rejects_get_and_queries(setup: dict[str, Any]) -> None:
    strict = APIClient(enforce_csrf_checks=True)
    strict.force_login(setup["customer"])
    assert recover(strict, setup["cart"]).status_code == 403
    assert recover(APIClient(enforce_csrf_checks=True), setup["cart"]).status_code == 403
    assert setup["client"].get(URL).status_code == 405
    assert (
        setup["client"].post(URL + "?key=extra", payload(setup["cart"]), format="json").status_code
        == 400
    )
    assert not CheckoutAttemptCancellation.objects.exists()


def test_disabled_actor_and_failed_marker_write_cannot_report_cancellation(
    setup: dict[str, Any],
) -> None:
    user = setup["customer"]
    user.is_active = False
    user.save(update_fields=["is_active"])
    assert recover(setup["client"], setup["cart"]).status_code == 403
    assert not CheckoutAttemptCancellation.objects.exists()
    user.is_active = True
    user.save(update_fields=["is_active"])
    with patch(
        "apps.checkout.services.CheckoutAttemptCancellation.objects.create",
        side_effect=RuntimeError("storage failed"),
    ):
        response = recover(setup["client"], setup["cart"])
    assert response.status_code == 500
    assert "storage failed" not in str(response.data)
    assert not CheckoutAttemptCancellation.objects.exists()
    assert not Order.objects.exists()


@pytest.mark.django_db(transaction=True, serialized_rollback=True)
@pytest.mark.parametrize("winner", ["placement", "recovery"])
def test_overlapping_guest_placement_and_recovery_have_one_durable_outcome(
    setup: dict[str, Any], winner: str
) -> None:
    guest, cart = make_guest(setup)
    locked, release, second_started = Event(), Event(), Event()
    quote = services.calculate_checkout_quote
    create = CheckoutAttemptCancellation.objects.create

    def pause() -> None:
        locked.set()
        assert release.wait(10), "Concurrent request did not release its lock"

    def paused_quote(**kwargs: Any) -> Any:
        pause()
        return quote(**kwargs)

    def paused_create(**kwargs: Any) -> Any:
        marker = create(**kwargs)
        pause()
        return marker

    def command(kind: str) -> Any:
        db.close_old_connections()
        try:
            client = APIClient()
            client.cookies.update(guest.cookies)
            if kind != winner:
                second_started.set()
            return (
                client.post(PLACE, payload(cart), format="json")
                if kind == "placement"
                else recover(client, cart)
            )
        finally:
            db.connections.close_all()

    target = (
        "apps.checkout.services.calculate_checkout_quote"
        if winner == "placement"
        else "apps.checkout.services.CheckoutAttemptCancellation.objects.create"
    )
    with (
        patch(target, side_effect=paused_quote if winner == "placement" else paused_create),
        ThreadPoolExecutor(max_workers=2) as pool,
    ):
        first = pool.submit(command, winner)
        try:
            assert locked.wait(10)
            second = pool.submit(command, "recovery" if winner == "placement" else "placement")
            assert second_started.wait(10)
        finally:
            release.set()
        first_result, second_result = first.result(timeout=15), second.result(timeout=15)
    placement, recovery = (
        (first_result, second_result) if winner == "placement" else (second_result, first_result)
    )
    if winner == "placement":
        assert placement.status_code == 201
        assert recovery.data == {"status": "placed", "order_id": placement.data["order_id"]}
        assert Order.objects.count() == CheckoutAttempt.objects.count() == 1
        assert not CheckoutAttemptCancellation.objects.exists()
        assert InventoryTransaction.objects.filter(type="reservation").count() == 1
    else:
        assert recovery.data == {"status": "cancelled", "order_id": None}
        assert placement.status_code == 409
        assert not Order.objects.exists()
        assert not InventoryTransaction.objects.filter(type="reservation").exists()
        assert CheckoutAttemptCancellation.objects.count() == 1
