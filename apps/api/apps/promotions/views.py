from typing import cast
from uuid import UUID

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

from apps.accounts.models import User
from apps.accounts.views import BrowserAPIView
from apps.platform_access.permissions import PlatformCapabilityRequired
from apps.promotions.models import Coupon, Promotion
from apps.promotions.serializers import (
    CouponCreateInputSerializer,
    CouponSerializer,
    CouponValidationResultSerializer,
    PromotionCreateInputSerializer,
    PromotionSerializer,
    PromotionUpdateInputSerializer,
    ValidateCouponInputSerializer,
)
from apps.promotions.services import (
    create_coupon,
    create_platform_promotion,
    create_seller_promotion,
    evaluate_coupon_discount,
    update_seller_promotion,
)
from apps.sellers.permissions import SellerCapabilityRequired
from apps.sellers.selectors import SellerAccess
from config.pagination import BoundedPagination


class SellerPromotionListCreateView(BrowserAPIView):
    permission_classes = [SellerCapabilityRequired]
    seller_capability = "promotions.read"
    seller_access: SellerAccess

    @extend_schema(responses={200: PromotionSerializer(many=True)}, tags=["Seller promotions"])
    def get(self, request: Request) -> Response:
        seller = self.seller_access.seller
        promos = (
            Promotion.objects.filter(seller=seller)
            .prefetch_related("coupons")
            .order_by("-priority", "-created_at")
        )
        pagination = BoundedPagination()
        page = pagination.paginate_queryset(promos, request, self)
        return pagination.get_paginated_response(PromotionSerializer(page, many=True).data)

    @extend_schema(
        request=PromotionCreateInputSerializer,
        responses={201: PromotionSerializer},
        tags=["Seller promotions"],
    )
    def post(self, request: Request) -> Response:
        if "promotions.manage" not in self.seller_access.permissions:
            return Response(
                {"detail": "You do not have permission to manage promotions."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = PromotionCreateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = cast(User, request.user)
        promo = create_seller_promotion(
            actor=user,
            seller_id=self.seller_access.seller.pk,
            name=serializer.validated_data["name"],
            description=serializer.validated_data.get("description", ""),
            discount_type=serializer.validated_data["discount_type"],
            discount_value=serializer.validated_data["discount_value"],
            start_date=serializer.validated_data["start_date"],
            end_date=serializer.validated_data["end_date"],
            min_order_amount=serializer.validated_data.get("min_order_amount"),
            max_discount_amount=serializer.validated_data.get("max_discount_amount"),
            stackable=serializer.validated_data.get("stackable", False),
            priority=serializer.validated_data.get("priority", 0),
            target_product_ids=serializer.validated_data.get("target_product_ids"),
            target_category_ids=serializer.validated_data.get("target_category_ids"),
            remote_ip=getattr(request, "client_ip", None),
        )
        return Response(PromotionSerializer(promo).data, status=status.HTTP_201_CREATED)


class SellerPromotionDetailView(BrowserAPIView):
    permission_classes = [SellerCapabilityRequired]
    seller_capability = "promotions.read"
    seller_access: SellerAccess

    @extend_schema(responses={200: PromotionSerializer}, tags=["Seller promotions"])
    def get(self, request: Request, promotion_id: UUID) -> Response:
        promo = get_object_or_404(
            Promotion.objects.prefetch_related("coupons"),
            pk=promotion_id,
            seller=self.seller_access.seller,
        )
        return Response(PromotionSerializer(promo).data)

    @extend_schema(
        request=PromotionUpdateInputSerializer,
        responses={200: PromotionSerializer},
        tags=["Seller promotions"],
    )
    def patch(self, request: Request, promotion_id: UUID) -> Response:
        if "promotions.manage" not in self.seller_access.permissions:
            return Response(
                {"detail": "You do not have permission to manage promotions."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = PromotionUpdateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = cast(User, request.user)
        promo = update_seller_promotion(
            actor=user,
            seller_id=self.seller_access.seller.pk,
            promotion_id=promotion_id,
            name=serializer.validated_data.get("name"),
            description=serializer.validated_data.get("description"),
            discount_value=serializer.validated_data.get("discount_value"),
            is_active=serializer.validated_data.get("is_active"),
            stackable=serializer.validated_data.get("stackable"),
            priority=serializer.validated_data.get("priority"),
            remote_ip=getattr(request, "client_ip", None),
        )
        return Response(PromotionSerializer(promo).data)


class SellerCouponListView(BrowserAPIView):
    permission_classes = [SellerCapabilityRequired]
    seller_capability = "promotions.read"
    seller_access: SellerAccess

    @extend_schema(responses={200: CouponSerializer(many=True)}, tags=["Seller coupons"])
    def get(self, request: Request) -> Response:
        seller = self.seller_access.seller
        coupons = (
            Coupon.objects.filter(promotion__seller=seller)
            .select_related("promotion")
            .order_by("-created_at")
        )
        pagination = BoundedPagination()
        page = pagination.paginate_queryset(coupons, request, self)
        return pagination.get_paginated_response(CouponSerializer(page, many=True).data)


class SellerCouponCreateView(BrowserAPIView):
    permission_classes = [SellerCapabilityRequired]
    seller_capability = "promotions.manage"
    seller_access: SellerAccess

    @extend_schema(
        request=CouponCreateInputSerializer,
        responses={201: CouponSerializer},
        tags=["Seller coupons"],
    )
    def post(self, request: Request, promotion_id: UUID) -> Response:
        serializer = CouponCreateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = cast(User, request.user)
        coupon = create_coupon(
            actor=user,
            promotion_id=promotion_id,
            code=serializer.validated_data["code"],
            seller_id=self.seller_access.seller.pk,
            usage_limit=serializer.validated_data.get("usage_limit"),
            usage_limit_per_customer=serializer.validated_data.get("usage_limit_per_customer"),
            expires_at=serializer.validated_data.get("expires_at"),
            remote_ip=getattr(request, "client_ip", None),
        )
        return Response(CouponSerializer(coupon).data, status=status.HTTP_201_CREATED)


class PlatformPromotionListCreateView(BrowserAPIView):
    permission_classes = [PlatformCapabilityRequired]
    platform_capability = "platform.promotions.read"

    @extend_schema(responses={200: PromotionSerializer(many=True)}, tags=["Platform promotions"])
    def get(self, request: Request) -> Response:
        promos = (
            Promotion.objects.all().prefetch_related("coupons").order_by("-priority", "-created_at")
        )
        pagination = BoundedPagination()
        page = pagination.paginate_queryset(promos, request, self)
        return pagination.get_paginated_response(PromotionSerializer(page, many=True).data)

    @extend_schema(
        request=PromotionCreateInputSerializer,
        responses={201: PromotionSerializer},
        tags=["Platform promotions"],
    )
    def post(self, request: Request) -> Response:
        # Creating requires platform.promotions.manage
        user = cast(User, request.user)
        serializer = PromotionCreateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        promo = create_platform_promotion(
            actor=user,
            name=serializer.validated_data["name"],
            description=serializer.validated_data.get("description", ""),
            discount_type=serializer.validated_data["discount_type"],
            discount_value=serializer.validated_data["discount_value"],
            start_date=serializer.validated_data["start_date"],
            end_date=serializer.validated_data["end_date"],
            min_order_amount=serializer.validated_data.get("min_order_amount"),
            max_discount_amount=serializer.validated_data.get("max_discount_amount"),
            stackable=serializer.validated_data.get("stackable", False),
            priority=serializer.validated_data.get("priority", 0),
            target_seller_ids=serializer.validated_data.get("target_seller_ids"),
            remote_ip=getattr(request, "client_ip", None),
        )
        return Response(PromotionSerializer(promo).data, status=status.HTTP_201_CREATED)


class PlatformPromotionDetailView(BrowserAPIView):
    permission_classes = [PlatformCapabilityRequired]
    platform_capability = "platform.promotions.read"

    @extend_schema(responses={200: PromotionSerializer}, tags=["Platform promotions"])
    def get(self, request: Request, promotion_id: UUID) -> Response:
        promo = get_object_or_404(Promotion.objects.prefetch_related("coupons"), pk=promotion_id)
        return Response(PromotionSerializer(promo).data)


class PlatformCouponCreateView(BrowserAPIView):
    permission_classes = [PlatformCapabilityRequired]
    platform_capability = "platform.promotions.manage"

    @extend_schema(
        request=CouponCreateInputSerializer,
        responses={201: CouponSerializer},
        tags=["Platform promotions"],
    )
    def post(self, request: Request, promotion_id: UUID) -> Response:
        serializer = CouponCreateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = cast(User, request.user)
        coupon = create_coupon(
            actor=user,
            promotion_id=promotion_id,
            code=serializer.validated_data["code"],
            seller_id=None,
            usage_limit=serializer.validated_data.get("usage_limit"),
            usage_limit_per_customer=serializer.validated_data.get("usage_limit_per_customer"),
            expires_at=serializer.validated_data.get("expires_at"),
            remote_ip=getattr(request, "client_ip", None),
        )
        return Response(CouponSerializer(coupon).data, status=status.HTTP_201_CREATED)


class CouponValidateView(BrowserAPIView):
    permission_classes = [AllowAny]

    @extend_schema(
        request=ValidateCouponInputSerializer,
        responses={200: CouponValidationResultSerializer},
        tags=["Promotions public"],
    )
    def post(self, request: Request) -> Response:
        serializer = ValidateCouponInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        customer: User | None = request.user if isinstance(request.user, User) else None
        result = evaluate_coupon_discount(
            code=serializer.validated_data["code"],
            seller_id=serializer.validated_data["seller_id"],
            order_subtotal=serializer.validated_data["order_subtotal"],
            customer=customer,
        )
        return Response(
            {
                "valid": result.is_valid,
                "discount_amount": str(result.discount_amount),
                "error_message": result.error_message,
                "coupon": CouponSerializer(result.coupon).data if result.coupon else None,
                "promotion": PromotionSerializer(result.promotion).data
                if result.promotion
                else None,
            }
        )
