from decimal import Decimal
from typing import Any

from rest_framework import serializers

from apps.finance.models import (
    CommissionPlan,
    CommissionRule,
    Payout,
    PayoutItem,
    SellerBalance,
    SellerLedgerEntry,
)
from apps.sellers.lifecycle_serializers import PageSerializer


class SellerLedgerFilterSerializer(serializers.Serializer[Any]):
    entry_type = serializers.ChoiceField(
        choices=SellerLedgerEntry.EntryType.choices, required=False, allow_null=True
    )


class SellerPayoutFilterSerializer(serializers.Serializer[Any]):
    status = serializers.ChoiceField(choices=Payout.Status.choices, required=False, allow_null=True)


class AdminPayoutFilterSerializer(serializers.Serializer[Any]):
    status = serializers.ChoiceField(choices=Payout.Status.choices, required=False, allow_null=True)
    seller_id = serializers.UUIDField(required=False, allow_null=True)


class AdminSellerBalanceFilterSerializer(serializers.Serializer[Any]):
    search = serializers.CharField(required=False, allow_blank=True, max_length=100)


class SellerBalanceSerializer(serializers.ModelSerializer[SellerBalance]):
    class Meta:
        model = SellerBalance
        fields = [
            "seller_id",
            "currency",
            "current_balance",
            "pending_balance",
            "total_paid_out",
            "updated_at",
        ]


class AdminSellerBalanceSerializer(serializers.ModelSerializer[SellerBalance]):
    seller_name = serializers.CharField(source="seller.display_name", read_only=True)
    seller_slug = serializers.CharField(source="seller.slug", read_only=True)

    class Meta:
        model = SellerBalance
        fields = [
            "seller_id",
            "seller_name",
            "seller_slug",
            "currency",
            "current_balance",
            "pending_balance",
            "total_paid_out",
            "updated_at",
        ]


class SellerLedgerEntrySerializer(serializers.ModelSerializer[SellerLedgerEntry]):
    seller_order_number = serializers.CharField(
        source="seller_order.seller_order_number", read_only=True, allow_null=True
    )
    payout_number = serializers.CharField(
        source="payout.payout_number", read_only=True, allow_null=True
    )

    class Meta:
        model = SellerLedgerEntry
        fields = [
            "id",
            "seller_id",
            "entry_type",
            "amount",
            "balance_after",
            "currency",
            "seller_order_id",
            "seller_order_number",
            "payout_id",
            "payout_number",
            "payment_reference",
            "payout_reference",
            "description",
            "created_at",
        ]


class PayoutItemSerializer(serializers.ModelSerializer[PayoutItem]):
    class Meta:
        model = PayoutItem
        fields = ["id", "ledger_entry_id", "amount"]


class PayoutSerializer(serializers.ModelSerializer[Payout]):
    seller_name = serializers.CharField(source="seller.display_name", read_only=True)
    created_by_email = serializers.CharField(
        source="created_by.email", read_only=True, allow_null=True
    )
    approved_by_email = serializers.CharField(
        source="approved_by.email", read_only=True, allow_null=True
    )
    processed_by_email = serializers.CharField(
        source="processed_by.email", read_only=True, allow_null=True
    )
    items = PayoutItemSerializer(many=True, read_only=True)

    class Meta:
        model = Payout
        fields = [
            "id",
            "payout_number",
            "seller_id",
            "seller_name",
            "amount",
            "currency",
            "status",
            "period_start",
            "period_end",
            "created_at",
            "approved_at",
            "processed_at",
            "created_by_email",
            "approved_by_email",
            "processed_by_email",
            "notes",
            "rejection_reason",
            "items",
        ]


class PayoutRequestSerializer(serializers.Serializer[Any]):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    notes = serializers.CharField(required=False, allow_blank=True, default="", max_length=500)
    period_start = serializers.DateTimeField(required=False, allow_null=True, default=None)
    period_end = serializers.DateTimeField(required=False, allow_null=True, default=None)


class PayoutProcessSerializer(serializers.Serializer[Any]):
    payout_reference = serializers.CharField(
        required=False, allow_blank=True, default="", max_length=120
    )


class PayoutRejectSerializer(serializers.Serializer[Any]):
    reason = serializers.CharField(required=True, min_length=1, max_length=1000)


class CommissionRuleSerializer(serializers.ModelSerializer[CommissionRule]):
    seller_name = serializers.CharField(
        source="seller.display_name", read_only=True, allow_null=True
    )
    category_name = serializers.CharField(source="category.name", read_only=True, allow_null=True)

    class Meta:
        model = CommissionRule
        fields = [
            "id",
            "plan_id",
            "seller_id",
            "seller_name",
            "category_id",
            "category_name",
            "percentage",
            "fixed_fee",
            "priority",
            "is_active",
            "created_at",
            "updated_at",
        ]


class CommissionRuleCreateSerializer(serializers.Serializer[Any]):
    seller_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    category_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    percentage = serializers.DecimalField(
        max_digits=5,
        decimal_places=2,
        min_value=Decimal("0.00"),
        max_value=Decimal("100.00"),
    )
    fixed_fee = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0.00"),
        default=Decimal("0.00"),
    )
    priority = serializers.IntegerField(default=0, min_value=0)


class CommissionRuleUpdateSerializer(serializers.Serializer[Any]):
    percentage = serializers.DecimalField(
        max_digits=5,
        decimal_places=2,
        min_value=Decimal("0.00"),
        max_value=Decimal("100.00"),
    )
    fixed_fee = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0.00"),
        default=Decimal("0.00"),
    )
    priority = serializers.IntegerField(default=0, min_value=0)
    is_active = serializers.BooleanField(default=True)


class CommissionPlanSerializer(serializers.ModelSerializer[CommissionPlan]):
    rules_count = serializers.IntegerField(source="rules.count", read_only=True)
    rules = CommissionRuleSerializer(many=True, read_only=True)

    class Meta:
        model = CommissionPlan
        fields = [
            "id",
            "name",
            "description",
            "default_percentage",
            "is_active",
            "is_default",
            "rules_count",
            "rules",
            "created_at",
            "updated_at",
        ]


class CommissionPlanCreateSerializer(serializers.Serializer[Any]):
    name = serializers.CharField(max_length=120)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    default_percentage = serializers.DecimalField(
        max_digits=5,
        decimal_places=2,
        min_value=Decimal("0.00"),
        max_value=Decimal("100.00"),
    )
    is_default = serializers.BooleanField(default=False)


class CommissionPlanUpdateSerializer(serializers.Serializer[Any]):
    name = serializers.CharField(max_length=120)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    default_percentage = serializers.DecimalField(
        max_digits=5,
        decimal_places=2,
        min_value=Decimal("0.00"),
        max_value=Decimal("100.00"),
    )
    is_active = serializers.BooleanField(default=True)
    is_default = serializers.BooleanField(default=False)


class AdminBalanceAdjustmentSerializer(serializers.Serializer[Any]):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    description = serializers.CharField(min_length=3, max_length=500)


class AdminFinanceSummarySerializer(serializers.Serializer[Any]):
    total_gross_sales = serializers.DecimalField(max_digits=16, decimal_places=2)
    total_commissions = serializers.DecimalField(max_digits=16, decimal_places=2)
    total_available_balances = serializers.DecimalField(max_digits=16, decimal_places=2)
    total_pending_balances = serializers.DecimalField(max_digits=16, decimal_places=2)
    total_paid_out = serializers.DecimalField(max_digits=16, decimal_places=2)
    pending_payouts_count = serializers.IntegerField()
    active_plans_count = serializers.IntegerField()


class CommissionCalculationPreviewSerializer(serializers.Serializer[Any]):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    seller_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    category_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    plan_id = serializers.UUIDField(required=False, allow_null=True, default=None)


class CommissionCalculationResultSerializer(serializers.Serializer[Any]):
    plan_id = serializers.UUIDField()
    rule_id = serializers.UUIDField(allow_null=True)
    percentage = serializers.DecimalField(max_digits=5, decimal_places=2)
    fixed_fee = serializers.DecimalField(max_digits=12, decimal_places=2)
    commission_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    seller_net_amount = serializers.DecimalField(max_digits=12, decimal_places=2)


class SellerLedgerEntryPage(PageSerializer):
    results = SellerLedgerEntrySerializer(many=True)


class PayoutPage(PageSerializer):
    results = PayoutSerializer(many=True)


class CommissionPlanPage(PageSerializer):
    results = CommissionPlanSerializer(many=True)


class AdminSellerBalancePage(PageSerializer):
    results = AdminSellerBalanceSerializer(many=True)
