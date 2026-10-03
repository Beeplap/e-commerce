from __future__ import annotations

from uuid import UUID

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from apps.accounts.serializers import EmptySerializer
from apps.accounts.views import BrowserAPIView
from apps.checkout.serializers import (
    CustomerAddressInputSerializer,
    CustomerAddressOutputSerializer,
)
from apps.checkout.views import CustomerAddressDetailView, CustomerAddressListView
from config.pagination import paginated_response

from . import services
from .serializers import (
    CustomerCancelOrderInputSerializer,
    CustomerOrderDetailSerializer,
    CustomerOrderListSerializer,
    CustomerProfileSerializer,
    CustomerProfileUpdateSerializer,
    CustomerReturnInputSerializer,
    CustomerReturnOutputSerializer,
    CustomerReviewInputSerializer,
    CustomerReviewOutputSerializer,
)


class CustomerPortalAddressListView(CustomerAddressListView):
    @extend_schema(
        responses={200: CustomerAddressOutputSerializer(many=True)},
        tags=["Customer Account"],
        operation_id="customer_addresses_list",
    )
    def get(self, request: Request) -> Response:
        return super().get(request)

    @extend_schema(
        request=CustomerAddressInputSerializer,
        responses={201: CustomerAddressOutputSerializer},
        tags=["Customer Account"],
        operation_id="customer_addresses_create",
    )
    def post(self, request: Request) -> Response:
        return super().post(request)


class CustomerPortalAddressDetailView(CustomerAddressDetailView):
    @extend_schema(
        request=CustomerAddressInputSerializer,
        responses={200: CustomerAddressOutputSerializer},
        tags=["Customer Account"],
        operation_id="customer_addresses_update",
    )
    def patch(self, request: Request, address_id: UUID) -> Response:
        return super().patch(request, address_id)

    @extend_schema(
        responses={204: EmptySerializer},
        tags=["Customer Account"],
        operation_id="customer_addresses_delete",
    )
    def delete(self, request: Request, address_id: UUID) -> Response:
        return super().delete(request, address_id)


class CustomerProfileView(BrowserAPIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: CustomerProfileSerializer},
        tags=["Customer Account"],
        operation_id="customer_profile_read",
    )
    def get(self, request: Request) -> Response:
        profile = services.get_customer_profile(request.user)
        return Response(CustomerProfileSerializer(profile).data, status=status.HTTP_200_OK)

    @extend_schema(
        request=CustomerProfileUpdateSerializer,
        responses={200: CustomerProfileSerializer},
        tags=["Customer Account"],
        operation_id="customer_profile_update",
    )
    def patch(self, request: Request) -> Response:
        serializer = CustomerProfileUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = services.update_customer_profile(request.user, serializer.validated_data)
        return Response(CustomerProfileSerializer(updated).data, status=status.HTTP_200_OK)


class CustomerOrdersListView(BrowserAPIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: CustomerOrderListSerializer(many=True)},
        tags=["Customer Account"],
        operation_id="customer_orders_list",
    )
    def get(self, request: Request) -> Response:
        orders = services.list_customer_orders(request.user)
        return paginated_response(self, request, orders, CustomerOrderListSerializer)


class CustomerOrderDetailView(BrowserAPIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: CustomerOrderDetailSerializer},
        tags=["Customer Account"],
        operation_id="customer_order_detail",
    )
    def get(self, request: Request, order_id: UUID) -> Response:
        order = services.get_customer_order(request.user, order_id)
        return Response(CustomerOrderDetailSerializer(order).data, status=status.HTTP_200_OK)


class CustomerCancelOrderView(BrowserAPIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=CustomerCancelOrderInputSerializer,
        responses={200: CustomerOrderDetailSerializer},
        tags=["Customer Account"],
        operation_id="customer_order_cancel",
    )
    def post(self, request: Request, order_id: UUID) -> Response:
        serializer = CustomerCancelOrderInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = services.cancel_customer_order(
            request.user,
            order_id,
            reason=serializer.validated_data.get("reason", ""),
        )
        return Response(CustomerOrderDetailSerializer(order).data, status=status.HTTP_200_OK)


class CustomerReviewView(BrowserAPIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=CustomerReviewInputSerializer,
        responses={201: CustomerReviewOutputSerializer},
        tags=["Customer Account"],
        operation_id="customer_review_create",
    )
    def post(self, request: Request) -> Response:
        serializer = CustomerReviewInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        review = services.submit_customer_review(
            customer=request.user,
            order_item_id=serializer.validated_data["order_item_id"],
            rating=serializer.validated_data["rating"],
            title=serializer.validated_data["title"],
            body=serializer.validated_data["body"],
        )
        return Response(
            CustomerReviewOutputSerializer(review).data,
            status=status.HTTP_201_CREATED,
        )


class CustomerReturnView(BrowserAPIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=CustomerReturnInputSerializer,
        responses={201: CustomerReturnOutputSerializer},
        tags=["Customer Account"],
        operation_id="customer_return_create",
    )
    def post(self, request: Request) -> Response:
        serializer = CustomerReturnInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rma = services.submit_customer_return(
            customer=request.user,
            order_item_id=serializer.validated_data["order_item_id"],
            quantity=serializer.validated_data["quantity"],
            reason=serializer.validated_data["reason"],
            customer_notes=serializer.validated_data.get("customer_notes", ""),
        )
        return Response(
            CustomerReturnOutputSerializer(rma).data,
            status=status.HTTP_201_CREATED,
        )
