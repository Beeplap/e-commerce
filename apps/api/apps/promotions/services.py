from dataclasses import dataclass
from decimal import Decimal
from typing import Any
from uuid import UUID

from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from apps.accounts.models import User
from apps.audit.models import AuditLog
from apps.catalog.models import Category, Product
from apps.promotions.models import (
    Coupon,
    CouponUsage,
    Promotion,
    PromotionCategory,
    PromotionProduct,
    PromotionSeller,
)
from apps.sellers.models import Seller
from apps.sellers.selectors import require_seller_access


def _log_audit(
    *,
    actor: User,
    seller: Seller | None,
    action: str,
    target_type: str,
    target_id: UUID,
    changes: dict[str, Any] | None = None,
    remote_ip: str | None = None,
) -> None:
    AuditLog.objects.create(
        actor_id=actor.pk,
        seller_id=seller.pk if seller else None,
        action=action,
        target_type=target_type,
        target_id=target_id,
        changes=changes or {},
        remote_ip=remote_ip,
    )


@transaction.atomic
def create_seller_promotion(
    *,
    actor: User,
    seller_id: UUID,
    name: str,
    description: str = "",
    discount_type: str,
    discount_value: Decimal,
    start_date: Any,
    end_date: Any,
    min_order_amount: Decimal = Decimal("0.0000"),
    max_discount_amount: Decimal | None = None,
    stackable: bool = False,
    priority: int = 0,
    target_product_ids: list[UUID] | None = None,
    target_category_ids: list[UUID] | None = None,
    remote_ip: str | None = None,
) -> Promotion:
    require_seller_access(actor, seller_id, "promotions.manage")
    seller = Seller.objects.select_for_update().get(pk=seller_id)

    if discount_value <= Decimal("0"):
        raise ValidationError({"discount_value": ["Discount value must be greater than zero."]})
    if discount_type == Promotion.DiscountType.PERCENTAGE and discount_value > Decimal("100"):
        raise ValidationError({"discount_value": ["Percentage discount cannot exceed 100%."]})
    if end_date < start_date:
        raise ValidationError({"end_date": ["End date must be on or after start date."]})

    promotion = Promotion.objects.create(
        seller=seller,
        scope=Promotion.Scope.SELLER,
        name=name.strip(),
        description=description.strip(),
        discount_type=discount_type,
        discount_value=discount_value,
        start_date=start_date,
        end_date=end_date,
        min_order_amount=min_order_amount,
        max_discount_amount=max_discount_amount,
        stackable=stackable,
        priority=priority,
    )

    if target_product_ids:
        # Cross-tenant check: ensure all products belong to this seller
        products = list(Product.objects.filter(id__in=target_product_ids, seller=seller))
        if len(products) != len(set(target_product_ids)):
            raise ValidationError(
                {"target_product_ids": ["Targeted products must belong to this seller."]}
            )
        PromotionProduct.objects.bulk_create(
            [PromotionProduct(promotion=promotion, product=p) for p in products]
        )

    if target_category_ids:
        categories = list(Category.objects.filter(id__in=target_category_ids))
        PromotionCategory.objects.bulk_create(
            [PromotionCategory(promotion=promotion, category=c) for c in categories]
        )

    _log_audit(
        actor=actor,
        seller=seller,
        action="promotions.promotion.create",
        target_type="promotion",
        target_id=promotion.pk,
        changes={"name": promotion.name, "discount_value": str(discount_value)},
        remote_ip=remote_ip,
    )
    return promotion


@transaction.atomic
def update_seller_promotion(
    *,
    actor: User,
    seller_id: UUID,
    promotion_id: UUID,
    name: str | None = None,
    description: str | None = None,
    discount_value: Decimal | None = None,
    is_active: bool | None = None,
    stackable: bool | None = None,
    priority: int | None = None,
    remote_ip: str | None = None,
) -> Promotion:
    require_seller_access(actor, seller_id, "promotions.manage")
    seller = Seller.objects.select_for_update().get(pk=seller_id)

    try:
        promotion = Promotion.objects.select_for_update().get(pk=promotion_id, seller=seller)
    except Promotion.DoesNotExist:
        raise NotFound("Promotion not found.") from None

    changes: dict[str, Any] = {}
    if name is not None:
        promotion.name = name.strip()
        changes["name"] = promotion.name
    if description is not None:
        promotion.description = description.strip()
    if discount_value is not None:
        if discount_value <= Decimal("0"):
            raise ValidationError({"discount_value": ["Discount value must be greater than zero."]})
        if (
            promotion.discount_type == Promotion.DiscountType.PERCENTAGE
            and discount_value > Decimal("100")
        ):
            raise ValidationError({"discount_value": ["Percentage discount cannot exceed 100%."]})
        promotion.discount_value = discount_value
        changes["discount_value"] = str(discount_value)
    if is_active is not None:
        promotion.is_active = is_active
        changes["is_active"] = is_active
    if stackable is not None:
        promotion.stackable = stackable
        changes["stackable"] = stackable
    if priority is not None:
        promotion.priority = priority
        changes["priority"] = priority

    promotion.save()
    _log_audit(
        actor=actor,
        seller=seller,
        action="promotions.promotion.update",
        target_type="promotion",
        target_id=promotion.pk,
        changes=changes,
        remote_ip=remote_ip,
    )
    return promotion


@transaction.atomic
def create_platform_promotion(
    *,
    actor: User,
    name: str,
    description: str = "",
    discount_type: str,
    discount_value: Decimal,
    start_date: Any,
    end_date: Any,
    min_order_amount: Decimal = Decimal("0.0000"),
    max_discount_amount: Decimal | None = None,
    stackable: bool = False,
    priority: int = 0,
    target_seller_ids: list[UUID] | None = None,
    remote_ip: str | None = None,
) -> Promotion:
    if discount_value <= Decimal("0"):
        raise ValidationError({"discount_value": ["Discount value must be greater than zero."]})
    if discount_type == Promotion.DiscountType.PERCENTAGE and discount_value > Decimal("100"):
        raise ValidationError({"discount_value": ["Percentage discount cannot exceed 100%."]})
    if end_date < start_date:
        raise ValidationError({"end_date": ["End date must be on or after start date."]})

    promotion = Promotion.objects.create(
        seller=None,
        scope=Promotion.Scope.PLATFORM,
        name=name.strip(),
        description=description.strip(),
        discount_type=discount_type,
        discount_value=discount_value,
        start_date=start_date,
        end_date=end_date,
        min_order_amount=min_order_amount,
        max_discount_amount=max_discount_amount,
        stackable=stackable,
        priority=priority,
    )

    if target_seller_ids:
        sellers = list(Seller.objects.filter(id__in=target_seller_ids))
        PromotionSeller.objects.bulk_create(
            [PromotionSeller(promotion=promotion, seller=s) for s in sellers]
        )

    _log_audit(
        actor=actor,
        seller=None,
        action="platform.promotions.create",
        target_type="promotion",
        target_id=promotion.pk,
        changes={"name": promotion.name, "discount_value": str(discount_value)},
        remote_ip=remote_ip,
    )
    return promotion


@transaction.atomic
def create_coupon(
    *,
    actor: User,
    promotion_id: UUID,
    code: str,
    seller_id: UUID | None = None,
    usage_limit: int | None = None,
    usage_limit_per_customer: int | None = None,
    expires_at: Any = None,
    remote_ip: str | None = None,
) -> Coupon:
    clean_code = code.strip().upper()
    if not clean_code:
        raise ValidationError({"code": ["Coupon code is required."]})

    if seller_id is not None:
        require_seller_access(actor, seller_id, "promotions.manage")
        try:
            promotion = Promotion.objects.get(pk=promotion_id, seller_id=seller_id)
        except Promotion.DoesNotExist:
            raise NotFound("Promotion not found.") from None
    else:
        try:
            promotion = Promotion.objects.get(pk=promotion_id, scope=Promotion.Scope.PLATFORM)
        except Promotion.DoesNotExist:
            raise NotFound("Promotion not found.") from None

    if Coupon.objects.filter(code=clean_code).exists():
        raise ValidationError({"code": ["A coupon with this code already exists."]})

    coupon = Coupon.objects.create(
        promotion=promotion,
        code=clean_code,
        usage_limit=usage_limit,
        usage_limit_per_customer=usage_limit_per_customer,
        expires_at=expires_at or promotion.end_date,
    )

    _log_audit(
        actor=actor,
        seller=promotion.seller,
        action="promotions.coupon.create",
        target_type="coupon",
        target_id=coupon.pk,
        changes={"code": clean_code, "promotion_id": str(promotion.pk)},
        remote_ip=remote_ip,
    )
    return coupon


@dataclass(frozen=True)
class DiscountEvaluation:
    is_valid: bool
    coupon: Coupon | None
    promotion: Promotion | None
    discount_amount: Decimal
    error_message: str | None


def evaluate_coupon_discount(
    *,
    code: str,
    seller_id: UUID,
    order_subtotal: Decimal,
    customer: User | None = None,
) -> DiscountEvaluation:
    clean_code = code.strip().upper()
    now = timezone.now()

    coupon = (
        Coupon.objects.select_related("promotion", "promotion__seller")
        .filter(code=clean_code, is_active=True)
        .first()
    )
    if coupon is None:
        return DiscountEvaluation(
            is_valid=False,
            coupon=None,
            promotion=None,
            discount_amount=Decimal("0.0000"),
            error_message="Invalid coupon code.",
        )

    promo = coupon.promotion
    if not promo.is_active:
        return DiscountEvaluation(
            is_valid=False,
            coupon=coupon,
            promotion=promo,
            discount_amount=Decimal("0.0000"),
            error_message="Promotion is currently inactive.",
        )

    # Date validity
    if promo.start_date > now or promo.end_date < now:
        return DiscountEvaluation(
            is_valid=False,
            coupon=coupon,
            promotion=promo,
            discount_amount=Decimal("0.0000"),
            error_message="Promotion has expired or has not started yet.",
        )
    if coupon.expires_at and coupon.expires_at < now:
        return DiscountEvaluation(
            is_valid=False,
            coupon=coupon,
            promotion=promo,
            discount_amount=Decimal("0.0000"),
            error_message="Coupon has expired.",
        )

    # Scope & seller boundaries: A seller promotion only applies to that seller!
    if promo.scope == Promotion.Scope.SELLER:
        if promo.seller_id != seller_id:
            return DiscountEvaluation(
                is_valid=False,
                coupon=coupon,
                promotion=promo,
                discount_amount=Decimal("0.0000"),
                error_message="This coupon does not apply to this seller.",
            )
    elif promo.scope == Promotion.Scope.PLATFORM:
        # Check if platform promotion targets specific sellers
        targeted_sellers = list(promo.targeted_sellers.values_list("seller_id", flat=True))
        if targeted_sellers and seller_id not in targeted_sellers:
            return DiscountEvaluation(
                is_valid=False,
                coupon=coupon,
                promotion=promo,
                discount_amount=Decimal("0.0000"),
                error_message="This coupon is not eligible for this seller.",
            )

    # Usage limits
    if coupon.usage_limit is not None and coupon.usage_count >= coupon.usage_limit:
        return DiscountEvaluation(
            is_valid=False,
            coupon=coupon,
            promotion=promo,
            discount_amount=Decimal("0.0000"),
            error_message="Coupon usage limit has been reached.",
        )

    if customer and coupon.usage_limit_per_customer is not None:
        user_usages = CouponUsage.objects.filter(coupon=coupon, customer=customer).count()
        if user_usages >= coupon.usage_limit_per_customer:
            return DiscountEvaluation(
                is_valid=False,
                coupon=coupon,
                promotion=promo,
                discount_amount=Decimal("0.0000"),
                error_message="You have reached the maximum usages for this coupon.",
            )

    # Min order amount check
    if order_subtotal < promo.min_order_amount:
        return DiscountEvaluation(
            is_valid=False,
            coupon=coupon,
            promotion=promo,
            discount_amount=Decimal("0.0000"),
            error_message=f"Minimum order amount of {promo.min_order_amount} required.",
        )

    # Compute discount
    if promo.discount_type == Promotion.DiscountType.PERCENTAGE:
        raw_discount = (order_subtotal * promo.discount_value) / Decimal("100.0000")
        if promo.max_discount_amount is not None:
            discount = min(raw_discount, promo.max_discount_amount)
        else:
            discount = raw_discount
    else:  # FIXED_AMOUNT
        discount = min(promo.discount_value, order_subtotal)

    # Never discount more than subtotal
    final_discount = min(discount.quantize(Decimal("0.0001")), order_subtotal)

    return DiscountEvaluation(
        is_valid=True,
        coupon=coupon,
        promotion=promo,
        discount_amount=final_discount,
        error_message=None,
    )


@transaction.atomic
def record_coupon_redemption(
    *,
    coupon_id: UUID,
    customer: User,
    order_id: UUID,
    discount_amount: Decimal,
) -> CouponUsage:
    coupon = Coupon.objects.select_for_update().get(pk=coupon_id)
    if coupon.usage_limit is not None and coupon.usage_count >= coupon.usage_limit:
        raise ValidationError("Coupon usage limit reached.")

    coupon.usage_count = F("usage_count") + 1
    coupon.save(update_fields=["usage_count"])

    usage = CouponUsage.objects.create(
        coupon=coupon,
        customer=customer,
        order_id=order_id,
        discount_amount=discount_amount,
    )
    return usage
