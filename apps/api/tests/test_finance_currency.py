from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from io import StringIO
from threading import Barrier
from typing import Any
from unittest.mock import patch

import pytest
from django import db
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import DatabaseError, connection, transaction
from django.db.migrations.executor import MigrationExecutor
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.cart.models import Cart, CartItem
from apps.finance import services
from apps.finance.models import Payout, SellerBalance, SellerLedgerEntry
from apps.fulfillment.models import ShippingRate
from apps.fulfillment.services import process_refund
from apps.orders.models import Order, SellerOrder
from apps.payments.models import Payment
from apps.payments.services import GatewayResult
from apps.platform_access.models import PlatformAccess, PlatformRole
from apps.sellers.models import Seller, SellerMembership
from tests.test_phase20_checkout import build_checkout_setup_data
from tests.test_phase21_payments import ADDRESS, confirm, create_intent, new_key

pytestmark = pytest.mark.django_db


@pytest.fixture
def commerce() -> dict[str, Any]:
    data = build_checkout_setup_data()
    seller = data["seller_1"]
    Seller.objects.filter(pk=seller.pk).update(default_currency="NPR")
    seller.refresh_from_db()
    ShippingRate.objects.filter(method__seller=seller).update(currency="NPR")
    cart = Cart.objects.create(user=data["customer"])
    CartItem.objects.create(cart=cart, variant=data["variant_1"], quantity=2)
    client = APIClient()
    client.force_authenticate(data["customer"])
    placed = client.post(
        "/api/v1/checkout/place-order/", {"shipping_address": ADDRESS}, format="json"
    )
    assert placed.status_code == 201, placed.data
    order = Order.objects.get(pk=placed.data["order_id"])
    owner = SellerMembership.objects.get(seller=seller).user
    admin = User.objects.create_user("currency-finance-admin@example.invalid")
    PlatformAccess.objects.create(
        user=admin, role=PlatformRole.objects.get(name="SUPER_ADMIN"), is_active=True
    )
    return {
        **data,
        "seller": seller,
        "order": order,
        "client": client,
        "owner": owner,
        "admin": admin,
    }


def test_capture_and_payout_keep_the_order_currency(commerce: dict[str, Any]) -> None:
    key = new_key()
    intent = create_intent(commerce["client"], commerce["order"], key)
    assert intent.status_code == 201
    captured = confirm(commerce["client"], intent.data["payment_id"], key)
    assert captured.status_code == 200, captured.data
    assert captured.data["currency"] == "NPR"
    balance = SellerBalance.objects.get(seller=commerce["seller"])
    assert balance.currency == "NPR"
    assert balance.current_balance == Decimal("50.00")
    assert set(SellerLedgerEntry.objects.values_list("currency", flat=True)) == {"NPR"}

    payout = services.request_payout(commerce["owner"], commerce["seller"].pk, Decimal("10"))
    assert payout.currency == "NPR"
    services.approve_payout(commerce["admin"], payout.pk)
    services.process_payout(commerce["admin"], payout.pk)
    balance.refresh_from_db()
    assert balance.current_balance == Decimal("40.00")
    assert balance.total_paid_out == Decimal("10.00")
    assert balance.currency == "NPR"
    assert set(SellerLedgerEntry.objects.values_list("currency", flat=True)) == {"NPR"}

    with pytest.raises(DatabaseError), transaction.atomic():
        Payout.objects.filter(pk=payout.pk).update(currency="USD")
    output = StringIO()
    call_command("check_finance_currencies", stdout=output)
    assert "Financial currency audit passed" in output.getvalue()


def test_refund_uses_the_original_order_currency(commerce: dict[str, Any]) -> None:
    key = new_key()
    intent = create_intent(commerce["client"], commerce["order"], key)
    assert confirm(commerce["client"], intent.data["payment_id"], key).status_code == 200
    seller_order = commerce["order"].seller_orders.get()
    refund = process_refund(
        actor=commerce["owner"],
        seller_id=commerce["seller"].pk,
        seller_order_id=seller_order.pk,
        amount=Decimal("11"),
        reason="Partial refund",
    )
    assert refund.currency == "NPR"
    balance = SellerBalance.objects.get(seller=commerce["seller"])
    assert balance.current_balance == Decimal("40.00")
    assert set(SellerLedgerEntry.objects.values_list("currency", flat=True)) == {"NPR"}


def test_settlement_rejects_a_foreign_currency_without_financial_writes(
    commerce: dict[str, Any],
) -> None:
    order = Order.objects.create(order_number="FOREIGN-CURRENCY", currency="EUR")
    seller_order = SellerOrder.objects.create(
        order=order, seller=commerce["seller"], seller_order_number="FOREIGN-CURRENCY-SO"
    )
    with pytest.raises(ValidationError, match="currency"):
        services.settle_seller_order(seller_order)
    assert not SellerLedgerEntry.objects.exists()
    assert not SellerBalance.objects.exists()


@pytest.mark.parametrize("operation", ["intent", "confirm"])
def test_disabled_actor_is_rechecked_before_payment(
    commerce: dict[str, Any], operation: str
) -> None:
    key = new_key()
    intent = create_intent(commerce["client"], commerce["order"], key)
    User.objects.filter(pk=commerce["customer"].pk).update(is_active=False)
    response = (
        create_intent(commerce["client"], commerce["order"], new_key())
        if operation == "intent"
        else confirm(commerce["client"], intent.data["payment_id"], key)
    )
    assert response.status_code == 403
    assert not SellerLedgerEntry.objects.exists()


@pytest.mark.django_db(transaction=True, serialized_rollback=True)
def test_migration_preserves_inconsistent_legacy_money_and_blocks_new_writes() -> None:
    executor = MigrationExecutor(connection)
    latest = executor.loader.graph.leaf_nodes()
    previous = [("finance", "0002_finance_integrity")]
    try:
        executor.migrate(previous)
        old_apps = executor.loader.project_state(previous).apps
        OldSeller = old_apps.get_model("sellers", "Seller")
        OldBalance = old_apps.get_model("finance", "SellerBalance")
        OldLedger = old_apps.get_model("finance", "SellerLedgerEntry")
        OldPayout = old_apps.get_model("finance", "Payout")
        seller = OldSeller.objects.create(
            legal_name="Legacy Seller",
            display_name="Legacy Seller",
            slug="legacy-currency",
            email="legacy@example.invalid",
            default_currency="NPR",
        )
        OldBalance.objects.create(
            seller_id=seller.pk, currency="USD", current_balance=Decimal("100")
        )
        entry = OldLedger.objects.create(
            seller_id=seller.pk,
            currency="USD",
            entry_type="ADJUSTMENT",
            amount=Decimal("100"),
            balance_after=Decimal("100"),
            description="Historical record",
        )
        payout = OldPayout.objects.create(
            seller_id=seller.pk, currency="USD", payout_number="LEGACY-CURRENCY-PAYOUT", amount=1
        )
    finally:
        MigrationExecutor(connection).migrate(latest)

    balance = SellerBalance.objects.get(pk=seller.pk)
    assert (balance.currency, balance.current_balance) == ("USD", Decimal("100"))
    assert SellerLedgerEntry.objects.get(pk=entry.pk).currency == "USD"
    output = StringIO()
    with pytest.raises(CommandError, match="reconciliation"):
        call_command("check_finance_currencies", stdout=output)
    assert "balances: 1" in output.getvalue()
    assert "payouts: 1" in output.getvalue()
    assert "ledger_entries: 1" in output.getvalue()
    admin = User.objects.create_user("legacy-finance-admin@example.invalid")
    PlatformAccess.objects.create(
        user=admin, role=PlatformRole.objects.get(name="SUPER_ADMIN"), is_active=True
    )
    with pytest.raises(ValidationError, match="reconciliation"):
        services.approve_payout(admin, payout.pk)
    assert Payout.objects.get(pk=payout.pk).status == Payout.Status.PENDING
    with pytest.raises(ValidationError, match="Reconciliation"):
        services.ensure_seller_balance(seller.pk)
    with pytest.raises(ValidationError, match="reconciliation"):
        services.record_ledger_entry(
            seller_id=seller.pk, entry_type="ADJUSTMENT", amount=Decimal("1"), description="Blocked"
        )
    with pytest.raises(DatabaseError), transaction.atomic():
        SellerBalance.objects.filter(pk=seller.pk).update(current_balance=Decimal("101"))
    balance.refresh_from_db()
    assert (balance.currency, balance.current_balance) == ("USD", Decimal("100"))
    assert SellerLedgerEntry.objects.filter(seller_id=seller.pk).count() == 1


@pytest.mark.parametrize("resource", ["balance", "payout", "ledger"])
def test_database_rejects_currency_relabeling(commerce: dict[str, Any], resource: str) -> None:
    seller = commerce["seller"]
    with pytest.raises(DatabaseError), transaction.atomic():
        if resource == "balance":
            SellerBalance.objects.create(seller=seller, currency="USD")
        elif resource == "payout":
            Payout.objects.create(
                seller=seller, payout_number="BAD-CURRENCY", amount=1, currency="USD"
            )
        else:
            SellerLedgerEntry.objects.create(
                seller=seller, entry_type="ADJUSTMENT", amount=1, balance_after=1, currency="USD"
            )


@pytest.mark.parametrize("resource", ["balance", "payout", "order", "seller"])
def test_currency_identity_cannot_change_after_financial_activity(
    commerce: dict[str, Any], resource: str
) -> None:
    balance = services.ensure_seller_balance(commerce["seller"].pk)
    payout = Payout.objects.create(
        seller=commerce["seller"], payout_number="IDENTITY-CURRENCY", amount=1, currency="NPR"
    )
    with pytest.raises(DatabaseError), transaction.atomic():
        if resource == "balance":
            SellerBalance.objects.filter(pk=balance.pk).update(currency="USD")
        elif resource == "payout":
            Payout.objects.filter(pk=payout.pk).update(currency="USD")
        elif resource == "order":
            Order.objects.filter(pk=commerce["order"].pk).update(currency="USD")
        else:
            Seller.objects.filter(pk=commerce["seller"].pk).update(default_currency="USD")


def test_payout_currency_must_match_its_ledger_entry(commerce: dict[str, Any]) -> None:
    seller = commerce["seller"]
    services.ensure_seller_balance(seller.pk)
    other = Seller.objects.create(
        legal_name="Other",
        display_name="Other",
        slug="currency-other",
        email="other@example.invalid",
    )
    foreign = Payout.objects.create(
        seller=other, payout_number="FOREIGN-PAYOUT", amount=1, currency="USD"
    )
    with pytest.raises(ValidationError):
        services.record_ledger_entry(
            seller_id=seller.pk,
            entry_type="PAYOUT",
            amount=Decimal("-1"),
            description="Must reject foreign payout",
            payout=foreign,
        )
    balance = SellerBalance.objects.get(seller=seller)
    assert balance.current_balance == 0
    assert not SellerLedgerEntry.objects.exists()


def test_ledger_rejects_order_currency_mismatch_at_database_boundary(
    commerce: dict[str, Any],
) -> None:
    order = Order.objects.create(order_number="EUR-SNAPSHOT", currency="EUR")
    seller_order = SellerOrder.objects.create(
        order=order, seller=commerce["seller"], seller_order_number="EUR-SNAPSHOT-SO"
    )
    with pytest.raises(DatabaseError), transaction.atomic():
        SellerLedgerEntry.objects.create(
            seller=commerce["seller"],
            seller_order=seller_order,
            entry_type="SALE",
            amount=1,
            balance_after=1,
            currency="NPR",
        )


def test_rejected_capture_does_not_charge_or_change_inventory(commerce: dict[str, Any]) -> None:
    # A historical foreign-currency order is never converted into a new seller balance.
    order = Order.objects.create(
        order_number="WRONG-PAYMENT-CURRENCY", currency="EUR", grand_total=1
    )
    SellerOrder.objects.create(
        order=order, seller=commerce["seller"], seller_order_number="WRONG-PAYMENT-SO", subtotal=1
    )
    order.customer = commerce["customer"]
    order.save(update_fields=["customer"])
    key = new_key()
    intent = create_intent(commerce["client"], order, key)
    assert intent.status_code == 201
    with patch(
        "apps.payments.services.MockPaymentGateway.charge",
        return_value=GatewayResult(success=True, reference="must-not-charge"),
    ) as charge:
        response = confirm(commerce["client"], intent.data["payment_id"], key)
    assert response.status_code == 400
    charge.assert_not_called()
    assert Payment.objects.get(pk=intent.data["payment_id"]).status == "pending"
    commerce["inv_1"].refresh_from_db()
    assert commerce["inv_1"].quantity_reserved == 2
    assert not SellerLedgerEntry.objects.exists()


@pytest.mark.django_db(transaction=True, serialized_rollback=True)
def test_concurrent_npr_captures_settle_one_shared_balance(commerce: dict[str, Any]) -> None:
    other = commerce["other_customer"]
    other_client = APIClient()
    other_client.force_authenticate(other)
    cart = Cart.objects.create(user=other)
    CartItem.objects.create(cart=cart, variant=commerce["variant_1"], quantity=2)
    placed = other_client.post(
        "/api/v1/checkout/place-order/", {"shipping_address": ADDRESS}, format="json"
    )
    assert placed.status_code == 201
    other_order = Order.objects.get(pk=placed.data["order_id"])
    key_a, key_b = new_key(), new_key()
    first = create_intent(commerce["client"], commerce["order"], key_a)
    second = create_intent(other_client, other_order, key_b)
    assert first.status_code == second.status_code == 201
    barrier = Barrier(2)

    def capture(user: User, payment_id: str, key: str) -> int:
        db.close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(user)
            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute("SET LOCAL lock_timeout = '8s'")
                barrier.wait(timeout=10)
                return int(confirm(client, payment_id, key).status_code)
        finally:
            db.connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as pool:
        first_result = pool.submit(capture, commerce["customer"], first.data["payment_id"], key_a)
        second_result = pool.submit(capture, other, second.data["payment_id"], key_b)
        assert first_result.result(timeout=25) == second_result.result(timeout=25) == 200
    balance = SellerBalance.objects.get(seller=commerce["seller"])
    assert (balance.currency, balance.current_balance) == ("NPR", Decimal("100"))
    assert SellerLedgerEntry.objects.filter(entry_type="SALE").count() == 2
    assert SellerLedgerEntry.objects.filter(entry_type="COMMISSION").count() == 2
    assert Payment.objects.filter(status=Payment.Status.CAPTURED).count() == 2
    commerce["inv_1"].refresh_from_db()
    assert (commerce["inv_1"].quantity_on_hand, commerce["inv_1"].quantity_reserved) == (16, 0)
