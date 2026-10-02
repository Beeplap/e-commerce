from dataclasses import dataclass
from decimal import Decimal

import pytest
from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.db import DatabaseError, IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.catalog.models import Category
from apps.finance import services
from apps.finance.models import (
    CommissionPlan,
    CommissionRule,
    Payout,
    SellerBalance,
    SellerLedgerEntry,
)
from apps.orders.models import Order, SellerOrder
from apps.platform_access.models import PlatformAccess, PlatformRole
from apps.sellers.models import Seller, SellerMembership, SellerRole

pytestmark = pytest.mark.django_db


def client(user: User) -> APIClient:
    browser = APIClient(enforce_csrf_checks=True)
    browser.force_login(user, backend="django.contrib.auth.backends.ModelBackend")
    browser.credentials(HTTP_X_CSRFTOKEN=browser.get("/api/v1/auth/csrf").json()["csrf_token"])
    return browser


@dataclass
class FinanceSetup:
    owner_a: User
    owner_b: User
    admin: User
    regular: User
    seller_a: Seller
    seller_b: Seller
    category: Category
    plan: CommissionPlan
    browser_a: APIClient
    browser_b: APIClient
    platform: APIClient


@pytest.fixture
def setup() -> FinanceSetup:
    owner_a = User.objects.create_user("fin-owner-a@example.com")
    owner_b = User.objects.create_user("fin-owner-b@example.com")
    admin = User.objects.create_user("fin-admin@example.com")
    regular = User.objects.create_user("fin-regular@example.com")

    PlatformAccess.objects.create(
        user=admin, role=PlatformRole.objects.get(name="SUPER_ADMIN"), is_active=True
    )

    seller_a = Seller.objects.create(
        legal_name="Alpha Corp",
        display_name="Alpha Store",
        slug="alpha-store",
        email="alpha@example.com",
        phone="+1234567890",
        default_currency="USD",
        status=Seller.Status.ACTIVE,
    )
    seller_b = Seller.objects.create(
        legal_name="Beta Corp",
        display_name="Beta Store",
        slug="beta-store",
        email="beta@example.com",
        phone="+1234567891",
        default_currency="USD",
        status=Seller.Status.ACTIVE,
    )

    owner_role = SellerRole.objects.get(name="OWNER", is_system=True)
    SellerMembership.objects.create(
        user=owner_a,
        seller=seller_a,
        role=owner_role,
        status="active",
        joined_at=timezone.now(),
    )
    SellerMembership.objects.create(
        user=owner_b,
        seller=seller_b,
        role=owner_role,
        status="active",
        joined_at=timezone.now(),
    )

    category = Category.objects.create(name="Electronics", slug="electronics")

    plan, _ = CommissionPlan.objects.get_or_create(
        is_default=True,
        defaults={
            "name": "Standard Marketplace Plan",
            "default_percentage": Decimal("10.00"),
            "is_active": True,
        },
    )

    browser_a = client(owner_a)
    browser_a.credentials(
        HTTP_X_CSRFTOKEN=browser_a.get("/api/v1/auth/csrf").json()["csrf_token"],
        HTTP_X_SELLER_ID=str(seller_a.pk),
    )

    browser_b = client(owner_b)
    browser_b.credentials(
        HTTP_X_CSRFTOKEN=browser_b.get("/api/v1/auth/csrf").json()["csrf_token"],
        HTTP_X_SELLER_ID=str(seller_b.pk),
    )

    platform = client(admin)

    return FinanceSetup(
        owner_a=owner_a,
        owner_b=owner_b,
        admin=admin,
        regular=regular,
        seller_a=seller_a,
        seller_b=seller_b,
        category=category,
        plan=plan,
        browser_a=browser_a,
        browser_b=browser_b,
        platform=platform,
    )


def test_commission_calculation_rules_and_precedence(setup: FinanceSetup) -> None:
    # 1. Default plan calculation (10%)
    res1 = services.calculate_commission(amount=Decimal("100.00"), plan=setup.plan)
    assert res1.rule_id is None
    assert res1.percentage == Decimal("10.00")
    assert res1.fixed_fee == Decimal("0.00")
    assert res1.commission_amount == Decimal("10.00")
    assert res1.seller_net_amount == Decimal("90.00")

    # 2. Category rule: 8.00% + $0.50 fixed fee
    cat_rule = CommissionRule.objects.create(
        plan=setup.plan,
        category=setup.category,
        percentage=Decimal("8.00"),
        fixed_fee=Decimal("0.50"),
        priority=0,
    )
    res2 = services.calculate_commission(
        amount=Decimal("50.00"), category=setup.category, plan=setup.plan
    )
    assert res2.rule_id == cat_rule.pk
    assert res2.percentage == Decimal("8.00")
    assert res2.fixed_fee == Decimal("0.50")
    # 50 * 0.08 = 4.00 + 0.50 = 4.50
    assert res2.commission_amount == Decimal("4.50")
    assert res2.seller_net_amount == Decimal("45.50")

    # 3. Seller rule: 6.00% flat
    seller_rule = CommissionRule.objects.create(
        plan=setup.plan,
        seller=setup.seller_a,
        percentage=Decimal("6.00"),
        fixed_fee=Decimal("0.00"),
        priority=0,
    )
    res3 = services.calculate_commission(
        amount=Decimal("100.00"), seller=setup.seller_a, plan=setup.plan
    )
    assert res3.rule_id == seller_rule.pk
    assert res3.commission_amount == Decimal("6.00")

    # 4. Specific seller AND category rule: overrides both
    both_rule = CommissionRule.objects.create(
        plan=setup.plan,
        seller=setup.seller_a,
        category=setup.category,
        percentage=Decimal("4.00"),
        fixed_fee=Decimal("1.00"),
        priority=0,
    )
    res4 = services.calculate_commission(
        amount=Decimal("200.00"),
        seller=setup.seller_a,
        category=setup.category,
        plan=setup.plan,
    )
    assert res4.rule_id == both_rule.pk
    # 200 * 0.04 = 8.00 + 1.00 = 9.00
    assert res4.commission_amount == Decimal("9.00")
    assert res4.seller_net_amount == Decimal("191.00")

    # 5. Rounding check (ROUND_HALF_UP)
    # $33.33 at 10% = 3.333 -> 3.33
    res5 = services.calculate_commission(amount=Decimal("33.33"), plan=setup.plan)
    assert res5.commission_amount == Decimal("3.33")
    assert res5.seller_net_amount == Decimal("30.00")


def test_changing_plan_does_not_mutate_historical_records(setup: FinanceSetup) -> None:
    # Record initial order settlement
    order = Order.objects.create(order_number="ORD-TEST-001", grand_total=Decimal("100.00"))
    seller_order = SellerOrder.objects.create(
        order=order,
        seller=setup.seller_a,
        seller_order_number="SO-TEST-001",
        subtotal=Decimal("100.00"),
        commission_total=Decimal("10.00"),
        seller_net_total=Decimal("90.00"),
    )
    sale_entry, comm_entry = services.settle_seller_order(seller_order)

    assert sale_entry.amount == Decimal("100.00")
    assert comm_entry.amount == Decimal("-10.00")

    # Now mutate the plan default percentage from 10% to 30%
    setup.plan.default_percentage = Decimal("30.00")
    setup.plan.save()

    # Verify historical records remain identical
    sale_entry.refresh_from_db()
    comm_entry.refresh_from_db()
    assert sale_entry.amount == Decimal("100.00")
    assert comm_entry.amount == Decimal("-10.00")


def test_seller_ledger_entry_append_only_immutability_trigger(setup: FinanceSetup) -> None:
    services.ensure_seller_balance(setup.seller_a.pk)
    entry = services.record_ledger_entry(
        seller_id=setup.seller_a.pk,
        entry_type=SellerLedgerEntry.EntryType.SALE,
        amount=Decimal("50.00"),
        description="Sale entry",
    )

    with pytest.raises((DatabaseError, IntegrityError)), transaction.atomic():
        SellerLedgerEntry.objects.filter(pk=entry.pk).update(amount=Decimal("100.00"))

    with pytest.raises((DatabaseError, IntegrityError)), transaction.atomic():
        entry.delete()


def test_cross_tenant_finance_isolation(setup: FinanceSetup) -> None:
    services.create_ledger_adjustment(
        actor=setup.admin,
        seller_id=setup.seller_a.pk,
        amount=Decimal("250.00"),
        description="Credit Alpha",
    )
    services.create_ledger_adjustment(
        actor=setup.admin,
        seller_id=setup.seller_b.pk,
        amount=Decimal("100.00"),
        description="Credit Beta",
    )

    # Seller A reads balance
    resp_a = setup.browser_a.get("/api/v1/seller/finance/balance")
    assert resp_a.status_code == 200
    assert resp_a.json()["current_balance"] == "250.00"

    # Seller B reads balance
    resp_b = setup.browser_b.get("/api/v1/seller/finance/balance")
    assert resp_b.status_code == 200
    assert resp_b.json()["current_balance"] == "100.00"

    # Seller A checks transactions: only sees own
    tx_a = setup.browser_a.get("/api/v1/seller/finance/transactions")
    assert tx_a.status_code == 200
    assert tx_a.json()["count"] == 1
    assert tx_a.json()["results"][0]["description"] == "Credit Alpha"

    # Seller B checks transactions: only sees own
    tx_b = setup.browser_b.get("/api/v1/seller/finance/transactions")
    assert tx_b.status_code == 200
    assert tx_b.json()["count"] == 1
    assert tx_b.json()["results"][0]["description"] == "Credit Beta"


def test_cross_tenant_foreign_key_trigger(setup: FinanceSetup) -> None:
    order = Order.objects.create(order_number="ORD-TEST-002", grand_total=Decimal("100.00"))
    seller_order_b = SellerOrder.objects.create(
        order=order,
        seller=setup.seller_b,
        seller_order_number="SO-TEST-B",
        subtotal=Decimal("100.00"),
        commission_total=Decimal("10.00"),
        seller_net_total=Decimal("90.00"),
    )

    # Attempt to insert a SellerLedgerEntry for Seller A referencing Seller B's order
    with pytest.raises((DatabaseError, IntegrityError)), transaction.atomic():
        SellerLedgerEntry.objects.create(
            seller=setup.seller_a,
            entry_type=SellerLedgerEntry.EntryType.SALE,
            amount=Decimal("100.00"),
            balance_after=Decimal("100.00"),
            seller_order=seller_order_b,
            description="Cross tenant attack",
        )


def test_seller_cannot_modify_ledger_or_rules(setup: FinanceSetup) -> None:
    # Seller cannot create commission plan
    res_plan = setup.browser_a.post(
        "/api/v1/admin/finance/commissions/plans",
        {"name": "Hack Plan", "default_percentage": "1.00"},
        format="json",
    )
    assert res_plan.status_code == 403

    # Seller cannot adjust balances
    res_adj = setup.browser_a.post(
        f"/api/v1/admin/finance/seller-balances/{setup.seller_a.pk}/adjust",
        {"amount": "1000.00", "description": "Free money"},
        format="json",
    )
    assert res_adj.status_code == 403


def test_payout_request_and_balance_validation(setup: FinanceSetup) -> None:
    # Add balance to seller A
    services.create_ledger_adjustment(
        actor=setup.admin,
        seller_id=setup.seller_a.pk,
        amount=Decimal("300.00"),
        description="Initial balance",
    )

    # Exceeding balance fails
    resp_over = setup.browser_a.post(
        "/api/v1/seller/finance/payouts",
        {"amount": "400.00", "notes": "Too much"},
        format="json",
    )
    assert resp_over.status_code == 400

    # Negative / 0 amount fails
    resp_zero = setup.browser_a.post(
        "/api/v1/seller/finance/payouts",
        {"amount": "0.00"},
        format="json",
    )
    assert resp_zero.status_code == 400

    # Valid amount succeeds
    resp_ok = setup.browser_a.post(
        "/api/v1/seller/finance/payouts",
        {"amount": "150.00", "notes": "Bi-weekly payout"},
        format="json",
    )
    assert resp_ok.status_code == 201
    assert resp_ok.json()["status"] == "PENDING"
    assert resp_ok.json()["amount"] == "150.00"


def test_seller_member_cannot_approve_own_payout(setup: FinanceSetup) -> None:
    # Credit seller A
    services.create_ledger_adjustment(
        actor=setup.admin,
        seller_id=setup.seller_a.pk,
        amount=Decimal("200.00"),
        description="Credit",
    )
    payout = services.request_payout(
        actor=setup.owner_a,
        seller_id=setup.seller_a.pk,
        amount=Decimal("100.00"),
    )

    # Grant platform access to owner_a
    PlatformAccess.objects.create(
        user=setup.owner_a,
        role=PlatformRole.objects.get(name="SUPER_ADMIN"),
        is_active=True,
    )

    # Owner A tries to approve own payout -> Denied!
    with pytest.raises(
        (PermissionDenied, DjangoPermissionDenied),
        match="Seller members cannot approve their own payouts",
    ):
        services.approve_payout(actor=setup.owner_a, payout_id=payout.pk)

    # Test via HTTP endpoint
    owner_a_platform = client(setup.owner_a)
    http_res = owner_a_platform.post(f"/api/v1/admin/finance/payouts/{payout.pk}/approve")
    assert http_res.status_code == 403


def test_payout_full_lifecycle(setup: FinanceSetup) -> None:
    # 1. Credit seller A with $500.00
    services.create_ledger_adjustment(
        actor=setup.admin,
        seller_id=setup.seller_a.pk,
        amount=Decimal("500.00"),
        description="Deposit",
    )

    # 2. Seller requests payout of $200.00
    payout = services.request_payout(
        actor=setup.owner_a,
        seller_id=setup.seller_a.pk,
        amount=Decimal("200.00"),
        notes="First payout",
    )
    assert payout.status == Payout.Status.PENDING

    # 3. Platform admin approves payout
    appr_resp = setup.platform.post(f"/api/v1/admin/finance/payouts/{payout.pk}/approve")
    assert appr_resp.status_code == 200
    assert appr_resp.json()["status"] == "APPROVED"

    # 4. Platform admin processes payout
    proc_resp = setup.platform.post(
        f"/api/v1/admin/finance/payouts/{payout.pk}/process",
        {"payout_reference": "WIRE-12345"},
        format="json",
    )
    assert proc_resp.status_code == 200
    assert proc_resp.json()["status"] == "PROCESSED"

    # 5. Check balance and ledger
    balance = SellerBalance.objects.get(seller_id=setup.seller_a.pk)
    assert balance.current_balance == Decimal("300.00")
    assert balance.total_paid_out == Decimal("200.00")

    payout_entry = SellerLedgerEntry.objects.filter(
        seller=setup.seller_a, entry_type=SellerLedgerEntry.EntryType.PAYOUT
    ).first()
    assert payout_entry is not None
    assert payout_entry.amount == Decimal("-200.00")
    assert payout_entry.balance_after == Decimal("300.00")
    assert payout_entry.payout_reference == "WIRE-12345"

    # 6. Verify processed payout immutability
    with pytest.raises((DatabaseError, IntegrityError)), transaction.atomic():
        Payout.objects.filter(pk=payout.pk).update(amount=Decimal("999.00"))


def test_duplicate_payout_processing_protection(setup: FinanceSetup) -> None:
    services.create_ledger_adjustment(
        actor=setup.admin,
        seller_id=setup.seller_a.pk,
        amount=Decimal("200.00"),
        description="Deposit",
    )
    payout = services.request_payout(
        actor=setup.owner_a,
        seller_id=setup.seller_a.pk,
        amount=Decimal("100.00"),
    )
    services.approve_payout(actor=setup.admin, payout_id=payout.pk)
    services.process_payout(actor=setup.admin, payout_id=payout.pk)

    # Second process call fails with ValidationError
    with pytest.raises(ValidationError, match="Payout is already processed"):
        services.process_payout(actor=setup.admin, payout_id=payout.pk)


def test_payout_rejection_workflow(setup: FinanceSetup) -> None:
    services.create_ledger_adjustment(
        actor=setup.admin,
        seller_id=setup.seller_a.pk,
        amount=Decimal("200.00"),
        description="Deposit",
    )
    payout = services.request_payout(
        actor=setup.owner_a,
        seller_id=setup.seller_a.pk,
        amount=Decimal("100.00"),
    )

    # Rejection without reason fails
    rej_fail = setup.platform.post(
        f"/api/v1/admin/finance/payouts/{payout.pk}/reject",
        {"reason": ""},
        format="json",
    )
    assert rej_fail.status_code == 400

    # Rejection with reason succeeds
    rej_ok = setup.platform.post(
        f"/api/v1/admin/finance/payouts/{payout.pk}/reject",
        {"reason": "Incorrect banking details on file."},
        format="json",
    )
    assert rej_ok.status_code == 200
    assert rej_ok.json()["status"] == "REJECTED"
    assert rej_ok.json()["rejection_reason"] == "Incorrect banking details on file."


def test_order_settlement_idempotency(setup: FinanceSetup) -> None:
    order = Order.objects.create(order_number="ORD-SETTLE-001", grand_total=Decimal("150.00"))
    seller_order = SellerOrder.objects.create(
        order=order,
        seller=setup.seller_a,
        seller_order_number="SO-SETTLE-001",
        subtotal=Decimal("120.00"),
        tax_total=Decimal("10.00"),
        shipping_total=Decimal("5.00"),
        discount_total=Decimal("0.00"),
        commission_total=Decimal("12.00"),
        seller_net_total=Decimal("123.00"),
    )

    sale1, comm1 = services.settle_seller_order(seller_order)
    assert sale1.amount == Decimal("135.00")  # 120 + 10 + 5
    assert comm1.amount == Decimal("-12.00")

    # Second settlement call returns the same entries and doesn't duplicate
    sale2, comm2 = services.settle_seller_order(seller_order)
    assert sale1.pk == sale2.pk
    assert comm1.pk == comm2.pk

    balance = SellerBalance.objects.get(seller_id=setup.seller_a.pk)
    # Net: 135 - 12 = 123.00
    assert balance.current_balance == Decimal("123.00")
