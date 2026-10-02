from decimal import Decimal
from typing import Any

from rest_framework import serializers

from apps.promotions.models import Coupon, Promotion


class CouponSerializer(serializers.ModelSerializer[Coupon]):
    promotion_id = serializers.UUIDField(source="promotion.id", read_only=True)
    promotion_name = serializers.CharField(source="promotion.name", read_only=True)

    class Meta:
        model = Coupon
        fields = [
            "id",
            "promotion_id",
            "promotion_name",
            "code",
            "usage_limit",
            "usage_limit_per_customer",
            "usage_count",
            "is_active",
            "expires_at",
            "created_at",
        ]


class PromotionSerializer(serializers.ModelSerializer[Promotion]):
    coupons = CouponSerializer(many=True, read_only=True)
    discount_value = serializers.CharField()
    min_order_amount = serializers.CharField()
    max_discount_amount = serializers.CharField(allow_null=True)

    class Meta:
        model = Promotion
        fields = [
            "id",
            "seller_id",
            "scope",
            "name",
            "description",
            "discount_type",
            "discount_value",
            "min_order_amount",
            "max_discount_amount",
            "start_date",
            "end_date",
            "is_active",
            "stackable",
            "priority",
            "coupons",
            "created_at",
        ]


class PromotionCreateInputSerializer(serializers.Serializer[Any]):
    name = serializers.CharField(max_length=120)
    description = serializers.CharField(max_length=1000, required=False, default="")
    discount_type = serializers.ChoiceField(choices=Promotion.DiscountType.choices)
    discount_value = serializers.DecimalField(max_digits=12, decimal_places=4)
    start_date = serializers.DateTimeField()
    end_date = serializers.DateTimeField()
    min_order_amount = serializers.DecimalField(
        max_digits=12, decimal_places=4, required=False, default=Decimal("0.0000")
    )
    max_discount_amount = serializers.DecimalField(
        max_digits=12, decimal_places=4, required=False, allow_null=True, default=None
    )
    stackable = serializers.BooleanField(required=False, default=False)
    priority = serializers.IntegerField(required=False, default=0)
    target_product_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, default=list
    )
    target_category_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, default=list
    )
    target_seller_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, default=list
    )


class PromotionUpdateInputSerializer(serializers.Serializer[Any]):
    name = serializers.CharField(max_length=120, required=False)
    description = serializers.CharField(max_length=1000, required=False)
    discount_value = serializers.DecimalField(max_digits=12, decimal_places=4, required=False)
    is_active = serializers.BooleanField(required=False)
    stackable = serializers.BooleanField(required=False)
    priority = serializers.IntegerField(required=False)


class CouponCreateInputSerializer(serializers.Serializer[Any]):
    code = serializers.CharField(max_length=32)
    usage_limit = serializers.IntegerField(required=False, allow_null=True, default=None)
    usage_limit_per_customer = serializers.IntegerField(
        required=False, allow_null=True, default=None
    )
    expires_at = serializers.DateTimeField(required=False, allow_null=True, default=None)


class CouponUpdateInputSerializer(serializers.Serializer[Any]):
    is_active = serializers.BooleanField(required=False)
    usage_limit = serializers.IntegerField(required=False, allow_null=True)


class ValidateCouponInputSerializer(serializers.Serializer[Any]):
    code = serializers.CharField(max_length=32)
    seller_id = serializers.UUIDField()
    order_subtotal = serializers.DecimalField(max_digits=12, decimal_places=4)


class CouponValidationResultSerializer(serializers.Serializer[Any]):
    valid = serializers.BooleanField()
    discount_amount = serializers.CharField()
    error_message = serializers.CharField(allow_null=True)
    coupon = CouponSerializer(allow_null=True)
    promotion = PromotionSerializer(allow_null=True)
