from decimal import Decimal
from typing import Any
from uuid import UUID

from django.core.exceptions import PermissionDenied
from django.db.models import Q, QuerySet, Sum
from rest_framework.exceptions import NotFound

from apps.finance.models import (
    CommissionPlan,
    Payout,
    SellerBalance,
    SellerLedgerEntry,
)
from apps.finance.services import ensure_seller_balance
from apps.platform_access.models import PlatformAccess
from apps.sellers.selectors import require_seller_access


def _require_platform_finance_read(actor: Any) -> None:
    if not actor.is_authenticated:
        raise PermissionDenied("Authentication required.")
    access = PlatformAccess.objects.filter(user=actor, is_active=True).first()
    if (
        not access
        or not access.role.permissions.filter(
            code__in=["platform.finance.read", "platform.finance.manage"]
        ).exists()
    ):
        raise PermissionDenied("Missing required platform capability: platform.finance.read")


def seller_balance(actor: Any, seller_id: UUID) -> SellerBalance:
    require_seller_access(actor, seller_id, capability="finance.read")
    return ensure_seller_balance(seller_id)


def seller_ledger_entries(
    actor: Any,
    seller_id: UUID,
    entry_type: str | None = None,
) -> QuerySet[SellerLedgerEntry]:
    require_seller_access(actor, seller_id, capability="finance.read")
    qs = SellerLedgerEntry.objects.filter(seller_id=seller_id)
    if entry_type:
        qs = qs.filter(entry_type=entry_type)
    return qs.order_by("-created_at", "-id")


def seller_payouts(
    actor: Any,
    seller_id: UUID,
    status: str | None = None,
) -> QuerySet[Payout]:
    require_seller_access(actor, seller_id, capability="payouts.read")
    qs = Payout.objects.filter(seller_id=seller_id)
    if status:
        qs = qs.filter(status=status)
    return qs.order_by("-created_at", "-id")


def seller_payout_detail(actor: Any, seller_id: UUID, payout_id: UUID) -> Payout:
    require_seller_access(actor, seller_id, capability="payouts.read")
    payout = (
        Payout.objects.filter(seller_id=seller_id, pk=payout_id)
        .select_related("seller")
        .prefetch_related("items__ledger_entry")
        .first()
    )
    if not payout:
        raise NotFound("Payout not found.")
    return payout


def admin_finance_summary(actor: Any) -> dict[str, Any]:
    _require_platform_finance_read(actor)

    sales_total = SellerLedgerEntry.objects.filter(
        entry_type=SellerLedgerEntry.EntryType.SALE
    ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
    comm_total = SellerLedgerEntry.objects.filter(
        entry_type=SellerLedgerEntry.EntryType.COMMISSION
    ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
    balances_agg = SellerBalance.objects.aggregate(
        current=Sum("current_balance"),
        pending=Sum("pending_balance"),
        paid_out=Sum("total_paid_out"),
    )

    pending_payouts_count = Payout.objects.filter(status=Payout.Status.PENDING).count()
    active_plans_count = CommissionPlan.objects.filter(is_active=True).count()

    return {
        "total_gross_sales": sales_total,
        "total_commissions": abs(comm_total),
        "total_available_balances": balances_agg["current"] or Decimal("0.00"),
        "total_pending_balances": balances_agg["pending"] or Decimal("0.00"),
        "total_paid_out": balances_agg["paid_out"] or Decimal("0.00"),
        "pending_payouts_count": pending_payouts_count,
        "active_plans_count": active_plans_count,
    }


def admin_commission_plans(actor: Any) -> QuerySet[CommissionPlan]:
    _require_platform_finance_read(actor)
    return CommissionPlan.objects.all().prefetch_related("rules")


def admin_commission_plan_detail(actor: Any, plan_id: UUID) -> CommissionPlan:
    _require_platform_finance_read(actor)
    plan = (
        CommissionPlan.objects.filter(pk=plan_id)
        .prefetch_related("rules__seller", "rules__category")
        .first()
    )
    if not plan:
        raise NotFound("Commission plan not found.")
    return plan


def admin_seller_balances(actor: Any, search: str | None = None) -> QuerySet[SellerBalance]:
    _require_platform_finance_read(actor)
    qs = SellerBalance.objects.select_related("seller").all()
    if search:
        qs = qs.filter(
            Q(seller__legal_name__icontains=search)
            | Q(seller__display_name__icontains=search)
            | Q(seller__slug__icontains=search)
        )
    return qs.order_by("seller__display_name")


def admin_seller_balance_detail(actor: Any, seller_id: UUID) -> SellerBalance:
    _require_platform_finance_read(actor)
    balance = SellerBalance.objects.filter(seller_id=seller_id).select_related("seller").first()
    if not balance:
        raise NotFound("Seller balance not found.")
    return balance


def admin_payouts(
    actor: Any,
    status: str | None = None,
    seller_id: UUID | None = None,
) -> QuerySet[Payout]:
    _require_platform_finance_read(actor)
    qs = Payout.objects.select_related("seller", "created_by", "approved_by", "processed_by").all()
    if status:
        qs = qs.filter(status=status)
    if seller_id:
        qs = qs.filter(seller_id=seller_id)
    return qs.order_by("-created_at", "-id")


def admin_payout_detail(actor: Any, payout_id: UUID) -> Payout:
    _require_platform_finance_read(actor)
    payout = (
        Payout.objects.filter(pk=payout_id)
        .select_related("seller", "created_by", "approved_by", "processed_by")
        .prefetch_related("items__ledger_entry")
        .first()
    )
    if not payout:
        raise NotFound("Payout not found.")
    return payout
