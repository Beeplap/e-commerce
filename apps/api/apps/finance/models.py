from decimal import Decimal
from uuid import uuid4

from django.conf import settings
from django.db import models
from django.db.models import Q


class CommissionPlan(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    name = models.CharField(max_length=120, unique=True)
    description = models.TextField(blank=True, default="")
    default_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("10.00"),
    )
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-is_default", "name"]
        constraints = [
            models.CheckConstraint(
                condition=Q(default_percentage__gte=0, default_percentage__lte=100),
                name="plan_default_percentage_bounds",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.default_percentage}%)"


class CommissionRule(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    plan = models.ForeignKey(
        CommissionPlan,
        on_delete=models.CASCADE,
        related_name="rules",
    )
    seller = models.ForeignKey(
        "sellers.Seller",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="commission_rules",
    )
    category = models.ForeignKey(
        "catalog.Category",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="commission_rules",
    )
    percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    fixed_fee = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    priority = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-priority", "-created_at"]
        constraints = [
            models.CheckConstraint(
                condition=Q(percentage__gte=0, percentage__lte=100),
                name="rule_percentage_bounds",
            ),
            models.CheckConstraint(
                condition=Q(fixed_fee__gte=0),
                name="rule_fixed_fee_nonnegative",
            ),
            models.UniqueConstraint(
                fields=["plan", "seller", "category"],
                name="unique_rule_per_plan_seller_category",
            ),
        ]

    def __str__(self) -> str:
        target = []
        if self.seller:
            target.append(f"seller={self.seller.slug}")
        if self.category:
            target.append(f"category={self.category.name}")
        target_str = ", ".join(target) or "all"
        return f"Rule({self.plan.name}, {target_str}: {self.percentage}% + ${self.fixed_fee})"


class SellerBalance(models.Model):
    seller = models.OneToOneField(
        "sellers.Seller",
        on_delete=models.PROTECT,
        primary_key=True,
        related_name="balance",
    )
    currency = models.CharField(max_length=3, default="USD")
    current_balance = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    pending_balance = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    total_paid_out = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["seller_id"]
        constraints = [
            models.CheckConstraint(
                condition=Q(total_paid_out__gte=0),
                name="total_paid_out_nonnegative",
            ),
        ]

    def __str__(self) -> str:
        return f"Balance({self.seller_id}: {self.currency} {self.current_balance})"


class Payout(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        PROCESSED = "PROCESSED", "Processed"
        REJECTED = "REJECTED", "Rejected"

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    payout_number = models.CharField(max_length=64, unique=True)
    seller = models.ForeignKey(
        "sellers.Seller",
        on_delete=models.PROTECT,
        related_name="payouts",
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default="USD")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    period_start = models.DateTimeField(null=True, blank=True)
    period_end = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="created_payouts",
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="approved_payouts",
    )
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="processed_payouts",
    )
    notes = models.TextField(blank=True, default="")
    rejection_reason = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=Q(amount__gt=0),
                name="payout_amount_positive",
            ),
        ]

    def __str__(self) -> str:
        return f"Payout {self.payout_number} ({self.seller_id}: {self.currency} {self.amount})"


class SellerLedgerEntry(models.Model):
    class EntryType(models.TextChoices):
        SALE = "SALE", "Sale"
        COMMISSION = "COMMISSION", "Commission"
        REFUND = "REFUND", "Refund"
        PAYOUT = "PAYOUT", "Payout"
        ADJUSTMENT = "ADJUSTMENT", "Adjustment"

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    seller = models.ForeignKey(
        "sellers.Seller",
        on_delete=models.PROTECT,
        related_name="ledger_entries",
    )
    entry_type = models.CharField(
        max_length=20,
        choices=EntryType.choices,
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    balance_after = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default="USD")
    seller_order = models.ForeignKey(
        "orders.SellerOrder",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="ledger_entries",
    )
    payout = models.ForeignKey(
        Payout,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="ledger_entries",
    )
    payment_reference = models.CharField(max_length=120, blank=True, default="")
    payout_reference = models.CharField(max_length=120, blank=True, default="")
    description = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self) -> str:
        return f"LedgerEntry {self.id} ({self.seller_id}: {self.entry_type} {self.amount})"


class PayoutItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    payout = models.ForeignKey(
        Payout,
        on_delete=models.CASCADE,
        related_name="items",
    )
    ledger_entry = models.ForeignKey(
        SellerLedgerEntry,
        on_delete=models.PROTECT,
        related_name="payout_items",
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        ordering = ["-id"]

    def __str__(self) -> str:
        return f"PayoutItem {self.id} ({self.payout_id}: {self.amount})"
