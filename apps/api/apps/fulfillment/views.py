from __future__ import annotations

from uuid import UUID

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from apps.accounts.models import User
from apps.accounts.views import BrowserAPIView
from apps.fulfillment import selectors, services
from apps.fulfillment import serializers as schemas
from apps.platform_access.models import PlatformAccess
from apps.platform_access.permissions import PlatformCapabilityRequired
from apps.sellers.permissions import SellerCapabilityRequired
from apps.sellers.selectors import SellerAccess
from config.pagination import paginated_response

HEADER = OpenApiParameter("X-Seller-ID", OpenApiTypes.UUID, OpenApiParameter.HEADER, required=True)


# -------------------------------------------------------------------------
# Base View Classes
# -------------------------------------------------------------------------


class SellerFulfillmentReadBase(BrowserAPIView):
    permission_classes = [SellerCapabilityRequired]
    seller_capability = "fulfillment.read"
    seller_access: SellerAccess


class SellerFulfillmentManageBase(BrowserAPIView):
    permission_classes = [SellerCapabilityRequired]
    seller_capability = "fulfillment.manage"
    seller_access: SellerAccess


class SellerReturnsReadBase(BrowserAPIView):
    permission_classes = [SellerCapabilityRequired]
    seller_capability = "returns.read"
    seller_access: SellerAccess


class SellerReturnsManageBase(BrowserAPIView):
    permission_classes = [SellerCapabilityRequired]
    seller_capability = "returns.manage"
    seller_access: SellerAccess


class AdminFulfillmentReadBase(BrowserAPIView):
    permission_classes = [PlatformCapabilityRequired]
    platform_capability = "platform.fulfillment.read"


class AdminFulfillmentManageBase(BrowserAPIView):
    permission_classes = [PlatformCapabilityRequired]
    platform_capability = "platform.fulfillment.manage"


class AdminReturnsReadBase(BrowserAPIView):
    permission_classes = [PlatformCapabilityRequired]
    platform_capability = "platform.returns.read"


class AdminReturnsManageBase(BrowserAPIView):
    permission_classes = [PlatformCapabilityRequired]
    platform_capability = "platform.returns.manage"


# -------------------------------------------------------------------------
# Seller Shipment Views
# -------------------------------------------------------------------------


@extend_schema(parameters=[HEADER], tags=["Seller fulfillment"])
class SellerShipmentListView(SellerFulfillmentReadBase):
    @extend_schema(
        responses=schemas.ShipmentSerializer(many=True),
        operation_id="seller_fulfillment_list_shipments",
    )
    def get(self, request: Request) -> Response:
        status_filter = request.query_params.get("status")
        order_filter = request.query_params.get("seller_order_id")
        so_id = UUID(order_filter) if order_filter else None
        qs = selectors.list_seller_shipments(
            self.seller_access.seller.id,
            status=status_filter,
            seller_order_id=so_id,
        )
        return paginated_response(self, request, qs, schemas.ShipmentSerializer)

    @extend_schema(
        request=schemas.CreateShipmentInputSerializer,
        responses={201: schemas.ShipmentSerializer},
        operation_id="seller_fulfillment_create_shipment",
    )
    def post(self, request: Request) -> Response:
        if "fulfillment.manage" not in self.seller_access.permissions:
            return Response(
                {"detail": "You do not have permission to create shipments."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = schemas.CreateShipmentInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        shipment = services.create_shipment(
            actor=request.user,
            seller_id=self.seller_access.seller.id,
            seller_order_id=serializer.validated_data["seller_order_id"],
            carrier=serializer.validated_data["carrier"],
            tracking_number=serializer.validated_data.get("tracking_number", ""),
            tracking_url=serializer.validated_data.get("tracking_url", ""),
            shipping_method_id=serializer.validated_data.get("shipping_method_id"),
            items_data=serializer.validated_data["items"],
            notes=serializer.validated_data.get("notes", ""),
        )
        return Response(schemas.ShipmentSerializer(shipment).data, status=status.HTTP_201_CREATED)


@extend_schema(parameters=[HEADER], tags=["Seller fulfillment"])
class SellerShipmentDetailView(SellerFulfillmentReadBase):
    @extend_schema(
        responses=schemas.ShipmentSerializer,
        operation_id="seller_fulfillment_get_shipment",
    )
    def get(self, request: Request, shipment_id: UUID) -> Response:
        shipment = selectors.get_seller_shipment(self.seller_access.seller.id, shipment_id)
        return Response(schemas.ShipmentSerializer(shipment).data)


@extend_schema(parameters=[HEADER], tags=["Seller fulfillment"])
class SellerShipmentAddTrackingEventView(SellerFulfillmentManageBase):
    @extend_schema(
        request=schemas.AddTrackingEventInputSerializer,
        responses={201: schemas.TrackingEventSerializer},
        operation_id="seller_fulfillment_add_tracking_event",
    )
    def post(self, request: Request, shipment_id: UUID) -> Response:
        serializer = schemas.AddTrackingEventInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        event = services.add_tracking_event(
            actor=request.user,
            seller_id=self.seller_access.seller.id,
            shipment_id=shipment_id,
            status=serializer.validated_data["status"],
            location=serializer.validated_data.get("location", ""),
            description=serializer.validated_data.get("description", ""),
        )
        return Response(schemas.TrackingEventSerializer(event).data, status=status.HTTP_201_CREATED)


@extend_schema(parameters=[HEADER], tags=["Seller fulfillment"])
class SellerShipmentDeliverView(SellerFulfillmentManageBase):
    @extend_schema(
        request=None,
        responses={200: schemas.ShipmentSerializer},
        operation_id="seller_fulfillment_deliver_shipment",
    )
    def post(self, request: Request, shipment_id: UUID) -> Response:
        shipment = services.mark_shipment_delivered(
            actor=request.user,
            seller_id=self.seller_access.seller.id,
            shipment_id=shipment_id,
        )
        return Response(schemas.ShipmentSerializer(shipment).data)


# -------------------------------------------------------------------------
# Seller Return Views
# -------------------------------------------------------------------------


@extend_schema(parameters=[HEADER], tags=["Seller returns"])
class SellerReturnListView(SellerReturnsReadBase):
    @extend_schema(
        responses=schemas.ReturnRequestSerializer(many=True),
        operation_id="seller_returns_list",
    )
    def get(self, request: Request) -> Response:
        status_filter = request.query_params.get("status")
        order_filter = request.query_params.get("seller_order_id")
        so_id = UUID(order_filter) if order_filter else None
        qs = selectors.list_seller_returns(
            self.seller_access.seller.id,
            status=status_filter,
            seller_order_id=so_id,
        )
        return paginated_response(self, request, qs, schemas.ReturnRequestSerializer)

    @extend_schema(
        request=schemas.CreateReturnRequestInputSerializer,
        responses={201: schemas.ReturnRequestSerializer},
        operation_id="seller_returns_create",
    )
    def post(self, request: Request) -> Response:
        serializer = schemas.CreateReturnRequestInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return_req = services.create_return_request(
            actor=request.user,
            seller_order_id=serializer.validated_data["seller_order_id"],
            reason=serializer.validated_data["reason"],
            customer_notes=serializer.validated_data.get("customer_notes", ""),
            items_data=serializer.validated_data["items"],
        )
        return Response(
            schemas.ReturnRequestSerializer(return_req).data,
            status=status.HTTP_201_CREATED,
        )


@extend_schema(parameters=[HEADER], tags=["Seller returns"])
class SellerReturnDetailView(SellerReturnsReadBase):
    @extend_schema(
        responses=schemas.ReturnRequestSerializer,
        operation_id="seller_returns_detail",
    )
    def get(self, request: Request, return_id: UUID) -> Response:
        return_req = selectors.get_seller_return(self.seller_access.seller.id, return_id)
        return Response(schemas.ReturnRequestSerializer(return_req).data)


@extend_schema(parameters=[HEADER], tags=["Seller returns"])
class SellerReturnApproveView(SellerReturnsManageBase):
    @extend_schema(
        request=schemas.ApproveReturnInputSerializer,
        responses={200: schemas.ReturnRequestSerializer},
        operation_id="seller_returns_approve",
    )
    def post(self, request: Request, return_id: UUID) -> Response:
        serializer = schemas.ApproveReturnInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return_req = services.approve_return_request(
            actor=request.user,
            seller_id=self.seller_access.seller.id,
            return_id=return_id,
            return_carrier=serializer.validated_data.get("return_carrier", ""),
            return_tracking_number=serializer.validated_data.get("return_tracking_number", ""),
        )
        return Response(schemas.ReturnRequestSerializer(return_req).data)


@extend_schema(parameters=[HEADER], tags=["Seller returns"])
class SellerReturnRejectView(SellerReturnsManageBase):
    @extend_schema(
        request=schemas.RejectReturnInputSerializer,
        responses={200: schemas.ReturnRequestSerializer},
        operation_id="seller_returns_reject",
    )
    def post(self, request: Request, return_id: UUID) -> Response:
        serializer = schemas.RejectReturnInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return_req = services.reject_return_request(
            actor=request.user,
            seller_id=self.seller_access.seller.id,
            return_id=return_id,
            reason=serializer.validated_data["reason"],
        )
        return Response(schemas.ReturnRequestSerializer(return_req).data)


@extend_schema(parameters=[HEADER], tags=["Seller returns"])
class SellerReturnReceiveView(SellerReturnsManageBase):
    @extend_schema(
        request=schemas.ReceiveReturnInputSerializer,
        responses={200: schemas.ReturnRequestSerializer},
        operation_id="seller_returns_receive",
    )
    def post(self, request: Request, return_id: UUID) -> Response:
        serializer = schemas.ReceiveReturnInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return_req = services.receive_return_request(
            actor=request.user,
            seller_id=self.seller_access.seller.id,
            return_id=return_id,
            items_inspection=serializer.validated_data.get("items"),
        )
        return Response(schemas.ReturnRequestSerializer(return_req).data)


# -------------------------------------------------------------------------
# Seller Refund Views
# -------------------------------------------------------------------------


@extend_schema(parameters=[HEADER], tags=["Seller refunds"])
class SellerRefundListView(SellerReturnsReadBase):
    @extend_schema(
        responses=schemas.RefundSerializer(many=True),
        operation_id="seller_refunds_list",
    )
    def get(self, request: Request) -> Response:
        status_filter = request.query_params.get("status")
        order_filter = request.query_params.get("seller_order_id")
        so_id = UUID(order_filter) if order_filter else None
        qs = selectors.list_seller_refunds(
            self.seller_access.seller.id,
            status=status_filter,
            seller_order_id=so_id,
        )
        return paginated_response(self, request, qs, schemas.RefundSerializer)

    @extend_schema(
        request=schemas.CreateRefundInputSerializer,
        responses={201: schemas.RefundSerializer},
        operation_id="seller_refunds_create",
    )
    def post(self, request: Request) -> Response:
        if "returns.manage" not in self.seller_access.permissions:
            return Response(
                {"detail": "You do not have permission to issue refunds."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = schemas.CreateRefundInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        refund = services.process_refund(
            actor=request.user,
            seller_id=self.seller_access.seller.id,
            seller_order_id=serializer.validated_data["seller_order_id"],
            amount=serializer.validated_data["amount"],
            reason=serializer.validated_data["reason"],
            return_request_id=serializer.validated_data.get("return_request_id"),
        )
        return Response(schemas.RefundSerializer(refund).data, status=status.HTTP_201_CREATED)


@extend_schema(parameters=[HEADER], tags=["Seller refunds"])
class SellerRefundDetailView(SellerReturnsReadBase):
    @extend_schema(
        responses=schemas.RefundSerializer,
        operation_id="seller_refunds_detail",
    )
    def get(self, request: Request, refund_id: UUID) -> Response:
        refund = selectors.get_seller_refund(self.seller_access.seller.id, refund_id)
        return Response(schemas.RefundSerializer(refund).data)


# -------------------------------------------------------------------------
# Platform Admin Views
# -------------------------------------------------------------------------


@extend_schema(tags=["Platform fulfillment"])
class AdminShipmentListView(AdminFulfillmentReadBase):
    @extend_schema(
        responses=schemas.ShipmentSerializer(many=True),
        operation_id="platform_fulfillment_list_shipments",
    )
    def get(self, request: Request) -> Response:
        status_filter = request.query_params.get("status")
        seller_filter = request.query_params.get("seller_id")
        s_id = UUID(seller_filter) if seller_filter else None
        qs = selectors.list_platform_shipments(status=status_filter, seller_id=s_id)
        return paginated_response(self, request, qs, schemas.ShipmentSerializer)


@extend_schema(tags=["Platform fulfillment"])
class AdminShipmentDetailView(AdminFulfillmentReadBase):
    @extend_schema(
        responses=schemas.ShipmentSerializer,
        operation_id="platform_fulfillment_get_shipment",
    )
    def get(self, request: Request, shipment_id: UUID) -> Response:
        shipment = selectors.get_platform_shipment(shipment_id)
        return Response(schemas.ShipmentSerializer(shipment).data)


@extend_schema(tags=["Platform returns"])
class AdminReturnListView(AdminReturnsReadBase):
    @extend_schema(
        responses=schemas.ReturnRequestSerializer(many=True),
        operation_id="platform_returns_list",
    )
    def get(self, request: Request) -> Response:
        status_filter = request.query_params.get("status")
        seller_filter = request.query_params.get("seller_id")
        s_id = UUID(seller_filter) if seller_filter else None
        qs = selectors.list_platform_returns(status=status_filter, seller_id=s_id)
        return paginated_response(self, request, qs, schemas.ReturnRequestSerializer)


@extend_schema(tags=["Platform returns"])
class AdminReturnDetailView(AdminReturnsReadBase):
    @extend_schema(
        responses=schemas.ReturnRequestSerializer,
        operation_id="platform_returns_detail",
    )
    def get(self, request: Request, return_id: UUID) -> Response:
        return_req = selectors.get_platform_return(return_id)
        return Response(schemas.ReturnRequestSerializer(return_req).data)


@extend_schema(tags=["Platform refunds"])
class AdminRefundListView(BrowserAPIView):
    permission_classes = [PlatformCapabilityRequired]
    platform_capability = "platform.fulfillment.read"

    @extend_schema(
        responses=schemas.RefundSerializer(many=True),
        operation_id="platform_refunds_list",
    )
    def get(self, request: Request) -> Response:
        status_filter = request.query_params.get("status")
        seller_filter = request.query_params.get("seller_id")
        s_id = UUID(seller_filter) if seller_filter else None
        qs = selectors.list_platform_refunds(status=status_filter, seller_id=s_id)
        return paginated_response(self, request, qs, schemas.RefundSerializer)

    @extend_schema(
        request=schemas.CreateRefundInputSerializer,
        responses={201: schemas.RefundSerializer},
        operation_id="platform_refunds_create",
    )
    def post(self, request: Request) -> Response:
        if (
            not isinstance(request.user, User)
            or not PlatformAccess.objects.filter(
                user=request.user,
                is_active=True,
                role__permissions__code="platform.refunds.manage",
            ).exists()
        ):
            return Response(
                {"detail": "Platform refunds manage capability required."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = schemas.CreateRefundInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        refund = services.process_platform_refund(
            actor=request.user,
            seller_order_id=serializer.validated_data["seller_order_id"],
            amount=serializer.validated_data["amount"],
            reason=serializer.validated_data["reason"],
            return_request_id=serializer.validated_data.get("return_request_id"),
        )
        return Response(schemas.RefundSerializer(refund).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["Platform refunds"])
class AdminRefundDetailView(BrowserAPIView):
    permission_classes = [PlatformCapabilityRequired]
    platform_capability = "platform.fulfillment.read"

    @extend_schema(
        responses=schemas.RefundSerializer,
        operation_id="platform_refunds_detail",
    )
    def get(self, request: Request, refund_id: UUID) -> Response:
        refund = selectors.get_platform_refund(refund_id)
        return Response(schemas.RefundSerializer(refund).data)
