from __future__ import annotations

from uuid import UUID

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from apps.accounts.views import BrowserAPIView
from apps.orders import selectors, services
from apps.orders import serializers as schemas
from apps.platform_access.permissions import PlatformCapabilityRequired
from apps.sellers.permissions import SellerCapabilityRequired
from apps.sellers.selectors import SellerAccess
from config.pagination import paginated_response

HEADER = OpenApiParameter("X-Seller-ID", OpenApiTypes.UUID, OpenApiParameter.HEADER, required=True)


class SellerOrderBase(BrowserAPIView):
    permission_classes = [SellerCapabilityRequired]
    seller_capability = "orders.read"
    seller_access: SellerAccess


@extend_schema(parameters=[HEADER], tags=["Seller orders"])
class SellerOrdersView(SellerOrderBase):
    allowed_query_parameters = frozenset({"page", "status", "search"})

    @extend_schema(
        responses=schemas.SellerOrderPage,
        parameters=[schemas.SellerOrderFilterSerializer],
        operation_id="seller_orders_list",
    )
    def get(self, request: Request) -> Response:
        filter_serializer = schemas.SellerOrderFilterSerializer(data=request.query_params)
        filter_serializer.is_valid(raise_exception=True)
        orders = selectors.list_seller_orders(
            seller_id=self.seller_access.seller.pk,
            actor=request.user,
            status=filter_serializer.validated_data.get("status"),
            search=filter_serializer.validated_data.get("search"),
        )
        return paginated_response(self, request, orders, schemas.SellerOrderListOutputSerializer)


@extend_schema(parameters=[HEADER], tags=["Seller orders"])
class SellerOrderDetailView(SellerOrderBase):
    @extend_schema(
        responses=schemas.SellerOrderDetailOutputSerializer,
        operation_id="seller_orders_detail",
    )
    def get(self, request: Request, id: UUID) -> Response:
        order = selectors.get_seller_order(
            seller_id=self.seller_access.seller.pk,
            actor=request.user,
            seller_order_id=id,
        )
        return Response(schemas.SellerOrderDetailOutputSerializer(order).data)


@extend_schema(parameters=[HEADER], tags=["Seller orders"])
class SellerOrderConfirmView(SellerOrderBase):
    seller_capability = "orders.update"

    @extend_schema(
        request=None,
        responses={200: schemas.SellerOrderDetailOutputSerializer},
        operation_id="seller_orders_confirm",
    )
    def post(self, request: Request, id: UUID) -> Response:
        order = services.confirm_seller_order(
            seller_id=self.seller_access.seller.pk,
            actor=request.user,
            seller_order_id=id,
        )
        return Response(schemas.SellerOrderDetailOutputSerializer(order).data)


@extend_schema(parameters=[HEADER], tags=["Seller orders"])
class SellerOrderBeginProcessingView(SellerOrderBase):
    seller_capability = "orders.update"

    @extend_schema(
        request=None,
        responses={200: schemas.SellerOrderDetailOutputSerializer},
        operation_id="seller_orders_begin_processing",
    )
    def post(self, request: Request, id: UUID) -> Response:
        order = services.begin_processing_seller_order(
            seller_id=self.seller_access.seller.pk,
            actor=request.user,
            seller_order_id=id,
        )
        return Response(schemas.SellerOrderDetailOutputSerializer(order).data)


@extend_schema(parameters=[HEADER], tags=["Seller orders"])
class SellerOrderShipView(SellerOrderBase):
    seller_capability = "orders.update"

    @extend_schema(
        request=schemas.SellerOrderShipInputSerializer,
        responses={200: schemas.SellerOrderDetailOutputSerializer},
        operation_id="seller_orders_ship",
    )
    def post(self, request: Request, id: UUID) -> Response:
        serializer = schemas.SellerOrderShipInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = services.ship_seller_order(
            seller_id=self.seller_access.seller.pk,
            actor=request.user,
            seller_order_id=id,
            tracking_number=serializer.validated_data.get("tracking_number", ""),
            carrier=serializer.validated_data.get("carrier", ""),
        )
        return Response(schemas.SellerOrderDetailOutputSerializer(order).data)


@extend_schema(parameters=[HEADER], tags=["Seller orders"])
class SellerOrderDeliverView(SellerOrderBase):
    seller_capability = "orders.update"

    @extend_schema(
        request=None,
        responses={200: schemas.SellerOrderDetailOutputSerializer},
        operation_id="seller_orders_deliver",
    )
    def post(self, request: Request, id: UUID) -> Response:
        order = services.deliver_seller_order(
            seller_id=self.seller_access.seller.pk,
            actor=request.user,
            seller_order_id=id,
        )
        return Response(schemas.SellerOrderDetailOutputSerializer(order).data)


@extend_schema(parameters=[HEADER], tags=["Seller orders"])
class SellerOrderCancelView(SellerOrderBase):
    seller_capability = "orders.cancel"

    @extend_schema(
        request=schemas.SellerOrderCancelInputSerializer,
        responses={200: schemas.SellerOrderDetailOutputSerializer},
        operation_id="seller_orders_cancel",
    )
    def post(self, request: Request, id: UUID) -> Response:
        serializer = schemas.SellerOrderCancelInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = services.cancel_seller_order(
            seller_id=self.seller_access.seller.pk,
            actor=request.user,
            seller_order_id=id,
            reason=serializer.validated_data["reason"],
        )
        return Response(schemas.SellerOrderDetailOutputSerializer(order).data)


class PlatformOrderBase(BrowserAPIView):
    permission_classes = [PlatformCapabilityRequired]
    platform_capability = "platform.orders.read"


@extend_schema(tags=["Platform orders"])
class PlatformOrdersView(PlatformOrderBase):
    allowed_query_parameters = frozenset({"page", "payment_status", "fulfillment_status", "search"})

    @extend_schema(
        responses=schemas.PlatformOrderPage,
        parameters=[schemas.PlatformOrderFilterSerializer],
        operation_id="platform_orders_list",
    )
    def get(self, request: Request) -> Response:
        filter_serializer = schemas.PlatformOrderFilterSerializer(data=request.query_params)
        filter_serializer.is_valid(raise_exception=True)
        orders = selectors.list_platform_orders(
            actor=request.user,
            payment_status=filter_serializer.validated_data.get("payment_status"),
            fulfillment_status=filter_serializer.validated_data.get("fulfillment_status"),
            search=filter_serializer.validated_data.get("search"),
        )
        return paginated_response(self, request, orders, schemas.PlatformOrderListOutputSerializer)


@extend_schema(tags=["Platform orders"])
class PlatformOrderDetailView(PlatformOrderBase):
    @extend_schema(
        responses=schemas.PlatformOrderDetailOutputSerializer,
        operation_id="platform_orders_detail",
    )
    def get(self, request: Request, id: UUID) -> Response:
        order = selectors.get_platform_order(
            actor=request.user,
            order_id=id,
        )
        return Response(schemas.PlatformOrderDetailOutputSerializer(order).data)
