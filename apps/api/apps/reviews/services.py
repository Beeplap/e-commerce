from typing import Any
from uuid import UUID

from django.db import transaction
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.accounts.models import User
from apps.audit.models import AuditLog
from apps.catalog.models import Product
from apps.orders.models import Order, OrderItem
from apps.reviews.models import ProductReview, ReviewModeration, ReviewReport, SellerReviewResponse
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
def submit_product_review(
    *,
    customer: User,
    product_id: UUID,
    rating: int,
    title: str,
    body: str,
    order_item_id: UUID | None = None,
) -> ProductReview:
    if rating < 1 or rating > 5:
        raise ValidationError({"rating": ["Rating must be between 1 and 5."]})

    try:
        product = Product.objects.get(pk=product_id)
    except Product.DoesNotExist:
        raise NotFound("Product not found.") from None

    if ProductReview.objects.filter(customer=customer, product=product).exists():
        raise ValidationError({"detail": "You have already reviewed this product."})

    verified_purchase = False
    order_item_obj = None

    if order_item_id:
        try:
            order_item = OrderItem.objects.select_related("seller_order__order").get(
                pk=order_item_id,
                product_id=product.pk,
                seller_order__order__customer=customer,
            )
            if order_item.seller_order.order.payment_status == Order.PaymentStatus.PAID:
                verified_purchase = True
                order_item_obj = order_item
        except OrderItem.DoesNotExist:
            pass

    review = ProductReview.objects.create(
        customer=customer,
        product=product,
        order_item=order_item_obj,
        rating=rating,
        title=title.strip(),
        body=body.strip(),
        status=ProductReview.Status.APPROVED,
        verified_purchase=verified_purchase,
    )
    return review


@transaction.atomic
def respond_to_review(
    *,
    actor: User,
    seller_id: UUID,
    review_id: UUID,
    response_text: str,
    remote_ip: str | None = None,
) -> SellerReviewResponse:
    require_seller_access(actor, seller_id, "reviews.respond")
    seller = Seller.objects.select_for_update().get(pk=seller_id)

    try:
        review = ProductReview.objects.select_related("product").get(pk=review_id)
    except ProductReview.DoesNotExist:
        raise NotFound("Review not found.") from None

    if review.product.seller_id != seller.pk:
        raise PermissionDenied("You can only respond to reviews of your own products.")

    clean_text = response_text.strip()
    if not clean_text:
        raise ValidationError({"response": ["Response text cannot be empty."]})

    response_obj, created = SellerReviewResponse.objects.update_or_create(
        review=review,
        defaults={
            "seller": seller,
            "responder": actor,
            "response": clean_text,
        },
    )

    _log_audit(
        actor=actor,
        seller=seller,
        action="reviews.response.submit",
        target_type="seller_review_response",
        target_id=response_obj.pk,
        changes={"review_id": str(review.pk), "created": created},
        remote_ip=remote_ip,
    )
    return response_obj


@transaction.atomic
def report_product_review(
    *,
    reporter: User,
    review_id: UUID,
    reason: str,
    details: str = "",
) -> ReviewReport:
    try:
        review = ProductReview.objects.get(pk=review_id)
    except ProductReview.DoesNotExist:
        raise NotFound("Review not found.") from None

    if ReviewReport.objects.filter(review=review, reporter=reporter).exists():
        raise ValidationError({"detail": "You have already reported this review."})

    report = ReviewReport.objects.create(
        review=review,
        reporter=reporter,
        reason=reason,
        details=details.strip(),
        status=ReviewReport.Status.PENDING,
    )
    return report


@transaction.atomic
def moderate_review(
    *,
    moderator: User,
    review_id: UUID,
    action: str,
    reason: str,
    remote_ip: str | None = None,
) -> ProductReview:
    if action not in ReviewModeration.Action.values:
        raise ValidationError(
            {"action": [f"Invalid moderation action. Choices: {ReviewModeration.Action.values}"]}
        )

    try:
        review = (
            ProductReview.objects.select_for_update().select_related("product").get(pk=review_id)
        )
    except ProductReview.DoesNotExist:
        raise NotFound("Review not found.") from None

    status_map: dict[str, str] = {
        ReviewModeration.Action.APPROVE.value: ProductReview.Status.APPROVED.value,
        ReviewModeration.Action.REJECT.value: ProductReview.Status.REJECTED.value,
        ReviewModeration.Action.HIDE.value: ProductReview.Status.HIDDEN.value,
    }

    new_status = status_map[action]
    review.status = new_status
    review.save(update_fields=["status"])

    ReviewModeration.objects.create(
        review=review,
        moderator=moderator,
        action=action,
        reason=reason.strip(),
    )

    _log_audit(
        actor=moderator,
        seller=review.product.seller,
        action="platform.reviews.moderate",
        target_type="product_review",
        target_id=review.pk,
        changes={"action": action, "status": new_status, "reason": reason},
        remote_ip=remote_ip,
    )
    return review


@transaction.atomic
def resolve_review_report(
    *,
    moderator: User,
    report_id: UUID,
    status: str,
    remote_ip: str | None = None,
) -> ReviewReport:
    if status not in [ReviewReport.Status.REVIEWED, ReviewReport.Status.DISMISSED]:
        raise ValidationError({"status": ["Status must be 'reviewed' or 'dismissed'."]})

    try:
        report = ReviewReport.objects.select_for_update().get(pk=report_id)
    except ReviewReport.DoesNotExist:
        raise NotFound("Review report not found.") from None

    report.status = status
    report.save(update_fields=["status"])

    _log_audit(
        actor=moderator,
        seller=None,
        action="platform.reviews.report_resolve",
        target_type="review_report",
        target_id=report.pk,
        changes={"status": status},
        remote_ip=remote_ip,
    )
    return report
