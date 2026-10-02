import uuid
from decimal import Decimal

from django.conf import settings
from django.db import models


class Promotion(models.Model):
    class Scope(models.TextChoices):
        PLATFORM = "platform", "Platform"
        SELLER = "seller", "Seller"

    class DiscountType(models.TextChoices):
        PERCENTAGE = "percentage", "Percentage"
        FIXED_AMOUNT = "fixed_amount", "Fixed amount"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    seller = models.ForeignKey(
        "sellers.Seller",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="promotions",
    )
    scope = models.CharField(max_length=16, choices=Scope.choices, default=Scope.SELLER)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True, max_length=1000)
    discount_type = models.CharField(max_length=16, choices=DiscountType.choices)
    discount_value = models.DecimalField(max_digits=12, decimal_places=4)
    min_order_amount = models.DecimalField(
        max_digits=12, decimal_places=4, default=Decimal("0.0000")
    )
    max_discount_amount = models.DecimalField(
        max_digits=12, decimal_places=4, null=True, blank=True
    )
    start_date = models.DateTimeField()
    end_date = models.DateTimeField()
    is_active = models.BooleanField(default=True)
    stackable = models.BooleanField(default=False)
    priority = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-priority", "-created_at"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    (models.Q(scope="platform") & models.Q(seller__isnull=True))
                    | (models.Q(scope="seller") & models.Q(seller__isnull=False))
                ),
                name="promotion_scope_seller_consistency",
            ),
            models.CheckConstraint(
                condition=models.Q(discount_value__gt=Decimal("0")),
                name="promotion_discount_value_positive",
            ),
            models.CheckConstraint(
                condition=(
                    ~models.Q(discount_type="percentage")
                    | models.Q(discount_value__lte=Decimal("100.0000"))
                ),
                name="promotion_percentage_discount_bound",
            ),
            models.CheckConstraint(
                condition=models.Q(end_date__gte=models.F("start_date")),
                name="promotion_dates_valid",
            ),
        ]


class Coupon(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    promotion = models.ForeignKey(Promotion, on_delete=models.CASCADE, related_name="coupons")
    code = models.CharField(max_length=32, unique=True)
    usage_limit = models.PositiveIntegerField(null=True, blank=True)
    usage_limit_per_customer = models.PositiveIntegerField(null=True, blank=True)
    usage_count = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["code"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(code__regex=r"^[A-Z0-9_-]{3,32}$"),
                name="coupon_code_format",
            ),
        ]


class CouponUsage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    coupon = models.ForeignKey(Coupon, on_delete=models.PROTECT, related_name="usages")
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="coupon_usages"
    )
    order_id = models.UUIDField()
    discount_amount = models.DecimalField(max_digits=12, decimal_places=4)
    used_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-used_at"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(discount_amount__gt=Decimal("0")),
                name="coupon_usage_discount_positive",
            ),
            models.UniqueConstraint(
                fields=["coupon", "order_id"],
                name="coupon_order_unique",
            ),
        ]


class PromotionProduct(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    promotion = models.ForeignKey(
        Promotion, on_delete=models.CASCADE, related_name="targeted_products"
    )
    product = models.ForeignKey(
        "catalog.Product", on_delete=models.CASCADE, related_name="targeted_promotions"
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["promotion", "product"],
                name="promotion_product_unique",
            )
        ]


class PromotionCategory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    promotion = models.ForeignKey(
        Promotion, on_delete=models.CASCADE, related_name="targeted_categories"
    )
    category = models.ForeignKey(
        "catalog.Category", on_delete=models.CASCADE, related_name="targeted_promotions"
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["promotion", "category"],
                name="promotion_category_unique",
            )
        ]


class PromotionSeller(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    promotion = models.ForeignKey(
        Promotion, on_delete=models.CASCADE, related_name="targeted_sellers"
    )
    seller = models.ForeignKey(
        "sellers.Seller", on_delete=models.CASCADE, related_name="targeted_promotions"
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["promotion", "seller"],
                name="promotion_seller_unique",
            )
        ]
