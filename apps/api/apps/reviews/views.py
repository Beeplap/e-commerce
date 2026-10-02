from typing import cast
from uuid import UUID

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from apps.accounts.models import User
from apps.accounts.views import BrowserAPIView
from apps.catalog.models import Product
from apps.platform_access.permissions import PlatformCapabilityRequired
from apps.reviews.models import ProductReview, ReviewReport
from apps.reviews.serializers import (
    ProductReviewSerializer,
    ReviewCreateInputSerializer,
    ReviewModerationInputSerializer,
    ReviewReportInputSerializer,
    ReviewReportResolveInputSerializer,
    ReviewReportSerializer,
    SellerReviewResponseInputSerializer,
    SellerReviewResponseSerializer,
)
from apps.reviews.services import (
    moderate_review,
    report_product_review,
    resolve_review_report,
    respond_to_review,
    submit_product_review,
)
from apps.sellers.permissions import SellerCapabilityRequired
from apps.sellers.selectors import SellerAccess
from config.pagination import BoundedPagination


class ProductReviewListView(BrowserAPIView):
    permission_classes = [AllowAny]

    @extend_schema(responses={200: ProductReviewSerializer(many=True)}, tags=["Product reviews"])
    def get(self, request: Request, product_id: UUID) -> Response:
        product = get_object_or_404(Product, pk=product_id)
        reviews = (
            ProductReview.objects.filter(product=product, status=ProductReview.Status.APPROVED)
            .select_related(
                "customer",
                "product",
                "product__seller",
                "seller_response",
                "seller_response__responder",
            )
            .order_by("-created_at")
        )
        pagination = BoundedPagination()
        page = pagination.paginate_queryset(reviews, request, self)
        return pagination.get_paginated_response(ProductReviewSerializer(page, many=True).data)


class ReviewCreateView(BrowserAPIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=ReviewCreateInputSerializer,
        responses={201: ProductReviewSerializer},
        tags=["Product reviews"],
    )
    def post(self, request: Request) -> Response:
        serializer = ReviewCreateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = cast(User, request.user)
        review = submit_product_review(
            customer=user,
            product_id=serializer.validated_data["product_id"],
            rating=serializer.validated_data["rating"],
            title=serializer.validated_data["title"],
            body=serializer.validated_data["body"],
            order_item_id=serializer.validated_data.get("order_item_id"),
        )
        return Response(ProductReviewSerializer(review).data, status=status.HTTP_201_CREATED)


class ReviewReportCreateView(BrowserAPIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=ReviewReportInputSerializer,
        responses={201: ReviewReportSerializer},
        tags=["Product reviews"],
    )
    def post(self, request: Request, review_id: UUID) -> Response:
        serializer = ReviewReportInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = cast(User, request.user)
        report = report_product_review(
            reporter=user,
            review_id=review_id,
            reason=serializer.validated_data["reason"],
            details=serializer.validated_data.get("details", ""),
        )
        return Response(ReviewReportSerializer(report).data, status=status.HTTP_201_CREATED)


class SellerReviewListView(BrowserAPIView):
    permission_classes = [SellerCapabilityRequired]
    seller_capability = "reviews.read"
    seller_access: SellerAccess

    @extend_schema(responses={200: ProductReviewSerializer(many=True)}, tags=["Seller reviews"])
    def get(self, request: Request) -> Response:
        seller = self.seller_access.seller
        reviews = (
            ProductReview.objects.filter(product__seller=seller)
            .select_related(
                "customer",
                "product",
                "product__seller",
                "seller_response",
                "seller_response__responder",
            )
            .order_by("-created_at")
        )
        pagination = BoundedPagination()
        page = pagination.paginate_queryset(reviews, request, self)
        return pagination.get_paginated_response(ProductReviewSerializer(page, many=True).data)


class SellerReviewRespondView(BrowserAPIView):
    permission_classes = [SellerCapabilityRequired]
    seller_capability = "reviews.respond"
    seller_access: SellerAccess

    @extend_schema(
        request=SellerReviewResponseInputSerializer,
        responses={200: SellerReviewResponseSerializer},
        tags=["Seller reviews"],
    )
    def post(self, request: Request, review_id: UUID) -> Response:
        serializer = SellerReviewResponseInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = cast(User, request.user)
        resp = respond_to_review(
            actor=user,
            seller_id=self.seller_access.seller.pk,
            review_id=review_id,
            response_text=serializer.validated_data["response"],
            remote_ip=getattr(request, "client_ip", None),
        )
        return Response(SellerReviewResponseSerializer(resp).data)


class PlatformReviewListView(BrowserAPIView):
    permission_classes = [PlatformCapabilityRequired]
    platform_capability = "platform.reviews.read"

    @extend_schema(responses={200: ProductReviewSerializer(many=True)}, tags=["Platform reviews"])
    def get(self, request: Request) -> Response:
        reviews = (
            ProductReview.objects.all()
            .select_related(
                "customer",
                "product",
                "product__seller",
                "seller_response",
                "seller_response__responder",
            )
            .order_by("-created_at")
        )
        pagination = BoundedPagination()
        page = pagination.paginate_queryset(reviews, request, self)
        return pagination.get_paginated_response(ProductReviewSerializer(page, many=True).data)


class PlatformReviewModerateView(BrowserAPIView):
    permission_classes = [PlatformCapabilityRequired]
    platform_capability = "platform.reviews.moderate"

    @extend_schema(
        request=ReviewModerationInputSerializer,
        responses={200: ProductReviewSerializer},
        tags=["Platform reviews"],
    )
    def post(self, request: Request, review_id: UUID) -> Response:
        serializer = ReviewModerationInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = cast(User, request.user)
        review = moderate_review(
            moderator=user,
            review_id=review_id,
            action=serializer.validated_data["action"],
            reason=serializer.validated_data["reason"],
            remote_ip=getattr(request, "client_ip", None),
        )
        return Response(ProductReviewSerializer(review).data)


class PlatformReviewReportListView(BrowserAPIView):
    permission_classes = [PlatformCapabilityRequired]
    platform_capability = "platform.reviews.read"

    @extend_schema(responses={200: ReviewReportSerializer(many=True)}, tags=["Platform reviews"])
    def get(self, request: Request) -> Response:
        reports = (
            ReviewReport.objects.all()
            .select_related("reporter", "review", "review__product")
            .order_by("-created_at")
        )
        pagination = BoundedPagination()
        page = pagination.paginate_queryset(reports, request, self)
        return pagination.get_paginated_response(ReviewReportSerializer(page, many=True).data)


class PlatformReviewReportResolveView(BrowserAPIView):
    permission_classes = [PlatformCapabilityRequired]
    platform_capability = "platform.reviews.moderate"

    @extend_schema(
        request=ReviewReportResolveInputSerializer,
        responses={200: ReviewReportSerializer},
        tags=["Platform reviews"],
    )
    def post(self, request: Request, report_id: UUID) -> Response:
        serializer = ReviewReportResolveInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = cast(User, request.user)
        report = resolve_review_report(
            moderator=user,
            report_id=report_id,
            status=serializer.validated_data["status"],
            remote_ip=getattr(request, "client_ip", None),
        )
        return Response(ReviewReportSerializer(report).data)
