from typing import Any

from rest_framework import serializers

from apps.reviews.models import ProductReview, ReviewModeration, ReviewReport, SellerReviewResponse


class SellerReviewResponseSerializer(serializers.ModelSerializer[SellerReviewResponse]):
    responder_email = serializers.EmailField(source="responder.email", read_only=True)

    class Meta:
        model = SellerReviewResponse
        fields = ["id", "response", "responder_email", "created_at", "updated_at"]


class ProductReviewSerializer(serializers.ModelSerializer[ProductReview]):
    customer_name = serializers.SerializerMethodField()
    product_name = serializers.CharField(source="product.name", read_only=True)
    seller_id = serializers.UUIDField(source="product.seller_id", read_only=True)
    seller_name = serializers.CharField(source="product.seller.display_name", read_only=True)
    seller_response = SellerReviewResponseSerializer(read_only=True)

    class Meta:
        model = ProductReview
        fields = [
            "id",
            "product_id",
            "product_name",
            "seller_id",
            "seller_name",
            "customer_name",
            "rating",
            "title",
            "body",
            "status",
            "verified_purchase",
            "seller_response",
            "created_at",
        ]

    def get_customer_name(self, obj: ProductReview) -> str:
        first = obj.customer.first_name
        last = obj.customer.last_name
        if first or last:
            return f"{first} {last}".strip()
        email = obj.customer.email
        return email.split("@")[0]


class ReviewCreateInputSerializer(serializers.Serializer[Any]):
    product_id = serializers.UUIDField()
    order_item_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    rating = serializers.IntegerField(min_value=1, max_value=5)
    title = serializers.CharField(max_length=200)
    body = serializers.CharField(max_length=5000)


class SellerReviewResponseInputSerializer(serializers.Serializer[Any]):
    response = serializers.CharField(max_length=2000)


class ReviewReportSerializer(serializers.ModelSerializer[ReviewReport]):
    reporter_email = serializers.EmailField(source="reporter.email", read_only=True)
    review_title = serializers.CharField(source="review.title", read_only=True)
    product_name = serializers.CharField(source="review.product.name", read_only=True)

    class Meta:
        model = ReviewReport
        fields = [
            "id",
            "review_id",
            "review_title",
            "product_name",
            "reporter_email",
            "reason",
            "details",
            "status",
            "created_at",
        ]


class ReviewReportInputSerializer(serializers.Serializer[Any]):
    reason = serializers.ChoiceField(choices=ReviewReport.Reason.choices)
    details = serializers.CharField(max_length=1000, required=False, default="")


class ReviewModerationSerializer(serializers.ModelSerializer[ReviewModeration]):
    moderator_email = serializers.EmailField(source="moderator.email", read_only=True)

    class Meta:
        model = ReviewModeration
        fields = ["id", "review_id", "moderator_email", "action", "reason", "created_at"]


class ReviewModerationInputSerializer(serializers.Serializer[Any]):
    action = serializers.ChoiceField(choices=ReviewModeration.Action.choices)
    reason = serializers.CharField(max_length=500)


class ReviewReportResolveInputSerializer(serializers.Serializer[Any]):
    status = serializers.ChoiceField(
        choices=[ReviewReport.Status.REVIEWED, ReviewReport.Status.DISMISSED]
    )
