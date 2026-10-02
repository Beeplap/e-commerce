from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from typing import Any
from uuid import UUID, uuid4

from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.accounts.models import User
from apps.audit.models import AuditLog
from apps.catalog.models import Category
from apps.finance.models import (
    CommissionPlan,
    CommissionRule,
    Payout,
    PayoutItem,
    SellerBalance,
    SellerLedgerEntry,
)
from apps.orders.models import SellerOrder
from apps.platform_access.models import PlatformAccess
from apps.sellers.lifecycle_services import lock_seller_access
from apps.sellers.models import Seller, SellerMembership


@dataclass(frozen=True)
class CommissionResult:
    plan_id: UUID
    rule_id: UUID | None
    percentage: Decimal
    fixed_fee: Decimal
    commission_amount: Decimal
    seller_net_amount: Decimal


def ensure_seller_balance(seller_id: UUID) -> SellerBalance:
    balance, _ = SellerBalance.objects.get_or_create(
        seller_id=seller_id,
        defaults={
            "currency": "USD",
            "current_balance": Decimal("0.00"),
            "pending_balance": Decimal("0.00"),
            "total_paid_out": Decimal("0.00"),
        },
    )
    return balance


def calculate_commission(
    amount: Decimal,
    seller: Seller | UUID | None = None,
    category: Category | UUID | None = None,
    plan: CommissionPlan | None = None,
) -> CommissionResult:
    seller_id = seller.pk if isinstance(seller, Seller) else seller
    category_id = category.pk if isinstance(category, Category) else category

    if plan is None:
        plan = (
            CommissionPlan.objects.filter(is_default=True, is_active=True).first()
            or CommissionPlan.objects.filter(is_active=True).first()
        )

    if plan is None:
        default_pct = Decimal("10.00")
        comm = (amount * default_pct / Decimal("100")).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        comm = max(Decimal("0.00"), min(amount, comm))
        net = (amount - comm).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        return CommissionResult(
            plan_id=uuid4(),
            rule_id=None,
            percentage=default_pct,
            fixed_fee=Decimal("0.00"),
            commission_amount=comm,
            seller_net_amount=net,
        )

    matched_rule: CommissionRule | None = None
    best_score = -1

    for rule in plan.rules.filter(is_active=True).order_by("-priority", "-created_at"):
        rule_seller_id = rule.seller_id
        rule_category_id = rule.category_id

        matches_seller = rule_seller_id is not None and rule_seller_id == seller_id
        matches_category = rule_category_id is not None and rule_category_id == category_id

        if rule_seller_id is not None and rule_category_id is not None:
            if matches_seller and matches_category:
                score = (rule.priority * 10) + 3
                if score > best_score:
                    best_score = score
                    matched_rule = rule
        elif rule_seller_id is not None and rule_category_id is None and matches_seller:
            score = (rule.priority * 10) + 2
            if score > best_score:
                best_score = score
                matched_rule = rule
        elif rule_seller_id is None and rule_category_id is not None and matches_category:
            score = (rule.priority * 10) + 1
            if score > best_score:
                best_score = score
                matched_rule = rule

    if matched_rule is not None:
        percentage = matched_rule.percentage
        fixed_fee = matched_rule.fixed_fee
        rule_id = matched_rule.pk
    else:
        percentage = plan.default_percentage
        fixed_fee = Decimal("0.00")
        rule_id = None

    raw_percentage_fee = (amount * percentage) / Decimal("100")
    total_commission = (raw_percentage_fee + fixed_fee).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    total_commission = max(Decimal("0.00"), min(amount, total_commission))
    seller_net = (amount - total_commission).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    return CommissionResult(
        plan_id=plan.pk,
        rule_id=rule_id,
        percentage=percentage,
        fixed_fee=fixed_fee,
        commission_amount=total_commission,
        seller_net_amount=seller_net,
    )


def record_ledger_entry(
    seller_id: UUID,
    entry_type: str,
    amount: Decimal,
    description: str,
    seller_order: SellerOrder | None = None,
    payout: Payout | None = None,
    payment_reference: str = "",
    payout_reference: str = "",
) -> SellerLedgerEntry:
    balance = SellerBalance.objects.select_for_update().get(seller_id=seller_id)
    new_balance = balance.current_balance + amount

    if entry_type == SellerLedgerEntry.EntryType.PAYOUT and new_balance < Decimal("0.00"):
        raise ValidationError({"amount": "Insufficient seller balance for payout."})

    balance.current_balance = new_balance
    if entry_type == SellerLedgerEntry.EntryType.PAYOUT:
        balance.total_paid_out += abs(amount)
    balance.save(update_fields=["current_balance", "total_paid_out", "updated_at"])

    entry = SellerLedgerEntry.objects.create(
        seller_id=seller_id,
        entry_type=entry_type,
        amount=amount,
        balance_after=new_balance,
        currency=balance.currency,
        seller_order=seller_order,
        payout=payout,
        payment_reference=payment_reference,
        payout_reference=payout_reference,
        description=description,
    )
    return entry


def settle_seller_order(
    seller_order: SellerOrder,
) -> tuple[SellerLedgerEntry, SellerLedgerEntry]:
    with transaction.atomic():
        so = SellerOrder.objects.select_for_update().get(pk=seller_order.pk)
        ensure_seller_balance(so.seller_id)

        existing_sale = SellerLedgerEntry.objects.filter(
            seller_order=so, entry_type=SellerLedgerEntry.EntryType.SALE
        ).first()
        existing_comm = SellerLedgerEntry.objects.filter(
            seller_order=so, entry_type=SellerLedgerEntry.EntryType.COMMISSION
        ).first()

        if existing_sale and existing_comm:
            return existing_sale, existing_comm

        gross_amount = (
            so.subtotal + so.tax_total + so.shipping_total - so.discount_total
        ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        comm_amount = so.commission_total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        sale_entry = record_ledger_entry(
            seller_id=so.seller_id,
            entry_type=SellerLedgerEntry.EntryType.SALE,
            amount=gross_amount,
            description=f"Order settlement for {so.seller_order_number}",
            seller_order=so,
            payment_reference=so.order.order_number,
        )

        comm_entry = record_ledger_entry(
            seller_id=so.seller_id,
            entry_type=SellerLedgerEntry.EntryType.COMMISSION,
            amount=-comm_amount,
            description=f"Marketplace commission for {so.seller_order_number}",
            seller_order=so,
            payment_reference=so.order.order_number,
        )

        return sale_entry, comm_entry


def create_ledger_adjustment(
    actor: Any,
    seller_id: UUID,
    amount: Decimal,
    description: str,
) -> SellerLedgerEntry:
    with transaction.atomic():
        User.objects.select_for_update().get(pk=actor.pk)
        access = PlatformAccess.objects.select_for_update().get(user=actor, is_active=True)
        if not access.role.permissions.filter(code="platform.finance.manage").exists():
            raise PermissionDenied("Missing required platform capability: platform.finance.manage")

        seller = Seller.objects.select_for_update().get(pk=seller_id)
        ensure_seller_balance(seller.pk)

        entry = record_ledger_entry(
            seller_id=seller.pk,
            entry_type=SellerLedgerEntry.EntryType.ADJUSTMENT,
            amount=amount,
            description=description,
        )

        AuditLog.objects.create(
            actor_id=actor.pk,
            seller_id=seller.pk,
            action="finance.adjustment.created",
            target_type="finance_sellerledgerentry",
            target_id=entry.pk,
            changes={
                "amount": str(amount),
                "balance_after": str(entry.balance_after),
                "description": description,
            },
        )
        return entry


def request_payout(
    actor: Any,
    seller_id: UUID,
    amount: Decimal,
    notes: str = "",
    period_start: Any = None,
    period_end: Any = None,
) -> Payout:
    with transaction.atomic():
        lock_seller_access(actor, seller_id, capability="payouts.read")
        seller = Seller.objects.select_for_update().get(pk=seller_id)
        balance = ensure_seller_balance(seller.pk)
        balance = SellerBalance.objects.select_for_update().get(seller_id=seller.pk)

        if amount <= Decimal("0.00"):
            raise ValidationError({"amount": "Payout amount must be positive."})
        if amount > balance.current_balance:
            raise ValidationError(
                {"amount": f"Requested amount exceeds balance ({balance.current_balance})."}
            )

        payout_number = f"PO-{seller.slug[:6].upper()}-{uuid4().hex[:8].upper()}"

        payout = Payout.objects.create(
            payout_number=payout_number,
            seller=seller,
            amount=amount,
            currency=balance.currency,
            status=Payout.Status.PENDING,
            period_start=period_start,
            period_end=period_end,
            created_by=actor,
            notes=notes,
        )

        AuditLog.objects.create(
            actor_id=actor.pk,
            seller_id=seller.pk,
            action="payout.requested",
            target_type="finance_payout",
            target_id=payout.pk,
            changes={"payout_number": payout_number, "amount": str(amount)},
        )
        return payout


def approve_payout(
    actor: Any,
    payout_id: UUID,
) -> Payout:
    with transaction.atomic():
        User.objects.select_for_update().get(pk=actor.pk)
        access = PlatformAccess.objects.select_for_update().get(user=actor, is_active=True)
        if not access.role.permissions.filter(code="platform.finance.manage").exists():
            raise PermissionDenied("Missing required platform capability: platform.finance.manage")

        payout = Payout.objects.select_for_update().get(pk=payout_id)
        if SellerMembership.objects.filter(user=actor, seller_id=payout.seller_id).exists():
            raise PermissionDenied("Seller members cannot approve their own payouts.")

        if payout.status != Payout.Status.PENDING:
            raise ValidationError(
                f"Cannot approve payout with status {payout.status}; must be PENDING."
            )

        payout.status = Payout.Status.APPROVED
        payout.approved_at = timezone.now()
        payout.approved_by = actor
        payout.save(update_fields=["status", "approved_at", "approved_by"])

        AuditLog.objects.create(
            actor_id=actor.pk,
            seller_id=payout.seller_id,
            action="payout.approved",
            target_type="finance_payout",
            target_id=payout.pk,
            changes={"payout_number": payout.payout_number, "amount": str(payout.amount)},
        )
        return payout


def process_payout(
    actor: Any,
    payout_id: UUID,
    payout_reference: str = "",
) -> Payout:
    with transaction.atomic():
        User.objects.select_for_update().get(pk=actor.pk)
        access = PlatformAccess.objects.select_for_update().get(user=actor, is_active=True)
        if not access.role.permissions.filter(code="platform.finance.manage").exists():
            raise PermissionDenied("Missing required platform capability: platform.finance.manage")

        payout = Payout.objects.select_for_update().get(pk=payout_id)
        if SellerMembership.objects.filter(user=actor, seller_id=payout.seller_id).exists():
            raise PermissionDenied("Seller members cannot process their own payouts.")

        if payout.status == Payout.Status.PROCESSED:
            raise ValidationError("Payout is already processed.")
        if payout.status != Payout.Status.APPROVED:
            raise ValidationError(
                f"Cannot process payout with status {payout.status}; must be APPROVED."
            )

        balance = ensure_seller_balance(payout.seller_id)
        balance = SellerBalance.objects.select_for_update().get(seller_id=payout.seller_id)

        if payout.amount > balance.current_balance:
            raise ValidationError(
                {"amount": f"Payout ({payout.amount}) exceeds balance ({balance.current_balance})."}
            )

        ref = payout_reference.strip() or payout.payout_number

        ledger_entry = record_ledger_entry(
            seller_id=payout.seller_id,
            entry_type=SellerLedgerEntry.EntryType.PAYOUT,
            amount=-payout.amount,
            description=f"Payout disbursement {payout.payout_number}",
            payout=payout,
            payout_reference=ref,
        )

        PayoutItem.objects.create(
            payout=payout,
            ledger_entry=ledger_entry,
            amount=payout.amount,
        )

        payout.status = Payout.Status.PROCESSED
        payout.processed_at = timezone.now()
        payout.processed_by = actor
        payout.save(update_fields=["status", "processed_at", "processed_by"])

        AuditLog.objects.create(
            actor_id=actor.pk,
            seller_id=payout.seller_id,
            action="payout.processed",
            target_type="finance_payout",
            target_id=payout.pk,
            changes={
                "payout_number": payout.payout_number,
                "amount": str(payout.amount),
                "payout_reference": ref,
                "ledger_entry_id": str(ledger_entry.pk),
            },
        )

        from apps.events.services import publish_outbox_event

        publish_outbox_event(
            topic="finance.payout.processed",
            event_key=str(payout.pk),
            payload={
                "payout_id": str(payout.pk),
                "seller_id": str(payout.seller_id),
                "amount": str(payout.amount),
                "currency": payout.currency,
                "status": payout.status,
                "payout_reference": ref,
            },
        )

        return payout


def reject_payout(
    actor: Any,
    payout_id: UUID,
    rejection_reason: str,
) -> Payout:
    with transaction.atomic():
        User.objects.select_for_update().get(pk=actor.pk)
        access = PlatformAccess.objects.select_for_update().get(user=actor, is_active=True)
        if not access.role.permissions.filter(code="platform.finance.manage").exists():
            raise PermissionDenied("Missing required platform capability: platform.finance.manage")

        payout = Payout.objects.select_for_update().get(pk=payout_id)
        if SellerMembership.objects.filter(user=actor, seller_id=payout.seller_id).exists():
            raise PermissionDenied("Seller members cannot reject their own payouts.")

        if payout.status not in [Payout.Status.PENDING, Payout.Status.APPROVED]:
            raise ValidationError(f"Cannot reject payout with status {payout.status}.")

        reason = rejection_reason.strip()
        if not reason:
            raise ValidationError({"rejection_reason": "Rejection reason is required."})

        payout.status = Payout.Status.REJECTED
        payout.rejection_reason = reason
        payout.save(update_fields=["status", "rejection_reason"])

        AuditLog.objects.create(
            actor_id=actor.pk,
            seller_id=payout.seller_id,
            action="payout.rejected",
            target_type="finance_payout",
            target_id=payout.pk,
            changes={"payout_number": payout.payout_number, "reason": reason},
        )
        return payout


def create_commission_plan(
    actor: Any,
    name: str,
    default_percentage: Decimal,
    description: str = "",
    is_default: bool = False,
) -> CommissionPlan:
    with transaction.atomic():
        User.objects.select_for_update().get(pk=actor.pk)
        access = PlatformAccess.objects.select_for_update().get(user=actor, is_active=True)
        if not access.role.permissions.filter(code="platform.finance.manage").exists():
            raise PermissionDenied("Missing required platform capability: platform.finance.manage")

        if is_default:
            CommissionPlan.objects.filter(is_default=True).update(is_default=False)

        plan = CommissionPlan.objects.create(
            name=name.strip(),
            description=description.strip(),
            default_percentage=default_percentage,
            is_default=is_default,
        )

        AuditLog.objects.create(
            actor_id=actor.pk,
            seller_id=None,
            action="commission_plan.created",
            target_type="finance_commissionplan",
            target_id=plan.pk,
            changes={"name": plan.name, "default_percentage": str(default_percentage)},
        )
        return plan


def update_commission_plan(
    actor: Any,
    plan_id: UUID,
    name: str,
    default_percentage: Decimal,
    description: str = "",
    is_active: bool = True,
    is_default: bool = False,
) -> CommissionPlan:
    with transaction.atomic():
        User.objects.select_for_update().get(pk=actor.pk)
        access = PlatformAccess.objects.select_for_update().get(user=actor, is_active=True)
        if not access.role.permissions.filter(code="platform.finance.manage").exists():
            raise PermissionDenied("Missing required platform capability: platform.finance.manage")

        plan = CommissionPlan.objects.select_for_update().get(pk=plan_id)

        if is_default and not plan.is_default:
            CommissionPlan.objects.filter(is_default=True).exclude(pk=plan.pk).update(
                is_default=False
            )

        plan.name = name.strip()
        plan.default_percentage = default_percentage
        plan.description = description.strip()
        plan.is_active = is_active
        plan.is_default = is_default
        plan.save(
            update_fields=[
                "name",
                "default_percentage",
                "description",
                "is_active",
                "is_default",
                "updated_at",
            ]
        )

        AuditLog.objects.create(
            actor_id=actor.pk,
            seller_id=None,
            action="commission_plan.updated",
            target_type="finance_commissionplan",
            target_id=plan.pk,
            changes={"name": plan.name, "default_percentage": str(default_percentage)},
        )
        return plan


def create_commission_rule(
    actor: Any,
    plan_id: UUID,
    percentage: Decimal,
    fixed_fee: Decimal = Decimal("0.00"),
    seller_id: UUID | None = None,
    category_id: UUID | None = None,
    priority: int = 0,
) -> CommissionRule:
    with transaction.atomic():
        User.objects.select_for_update().get(pk=actor.pk)
        access = PlatformAccess.objects.select_for_update().get(user=actor, is_active=True)
        if not access.role.permissions.filter(code="platform.finance.manage").exists():
            raise PermissionDenied("Missing required platform capability: platform.finance.manage")

        plan = CommissionPlan.objects.select_for_update().get(pk=plan_id)

        rule = CommissionRule.objects.create(
            plan=plan,
            seller_id=seller_id,
            category_id=category_id,
            percentage=percentage,
            fixed_fee=fixed_fee,
            priority=priority,
        )

        AuditLog.objects.create(
            actor_id=actor.pk,
            seller_id=seller_id,
            action="commission_rule.created",
            target_type="finance_commissionrule",
            target_id=rule.pk,
            changes={
                "plan_id": str(plan.pk),
                "seller_id": str(seller_id) if seller_id else None,
                "category_id": str(category_id) if category_id else None,
                "percentage": str(percentage),
                "fixed_fee": str(fixed_fee),
            },
        )
        return rule


def update_commission_rule(
    actor: Any,
    rule_id: UUID,
    percentage: Decimal,
    fixed_fee: Decimal,
    priority: int,
    is_active: bool,
) -> CommissionRule:
    with transaction.atomic():
        User.objects.select_for_update().get(pk=actor.pk)
        access = PlatformAccess.objects.select_for_update().get(user=actor, is_active=True)
        if not access.role.permissions.filter(code="platform.finance.manage").exists():
            raise PermissionDenied("Missing required platform capability: platform.finance.manage")

        rule = CommissionRule.objects.select_for_update().get(pk=rule_id)
        rule.percentage = percentage
        rule.fixed_fee = fixed_fee
        rule.priority = priority
        rule.is_active = is_active
        rule.save(update_fields=["percentage", "fixed_fee", "priority", "is_active", "updated_at"])

        AuditLog.objects.create(
            actor_id=actor.pk,
            seller_id=rule.seller_id,
            action="commission_rule.updated",
            target_type="finance_commissionrule",
            target_id=rule.pk,
            changes={"percentage": str(percentage), "fixed_fee": str(fixed_fee)},
        )
        return rule


def delete_commission_rule(
    actor: Any,
    rule_id: UUID,
) -> None:
    with transaction.atomic():
        User.objects.select_for_update().get(pk=actor.pk)
        access = PlatformAccess.objects.select_for_update().get(user=actor, is_active=True)
        if not access.role.permissions.filter(code="platform.finance.manage").exists():
            raise PermissionDenied("Missing required platform capability: platform.finance.manage")

        rule = CommissionRule.objects.select_for_update().get(pk=rule_id)
        rule_pk = rule.pk
        plan_id = rule.plan_id
        seller_id = rule.seller_id
        rule.delete()

        AuditLog.objects.create(
            actor_id=actor.pk,
            seller_id=seller_id,
            action="commission_rule.deleted",
            target_type="finance_commissionrule",
            target_id=rule_pk,
            changes={"plan_id": str(plan_id)},
        )
