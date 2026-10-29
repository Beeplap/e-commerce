from __future__ import annotations

from uuid import UUID

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from apps.accounts.serializers import EmptySerializer
from apps.accounts.views import BrowserAPIView
from apps.cart.services import get_or_create_cart
from apps.payments.services import remember_guest_order

from . import services
from .review import ReviewConflict, address_snapshot, issue_review
from .serializers import (
    CheckoutQuoteInputSerializer,
    CheckoutQuoteOutputSerializer,
    CustomerAddressInputSerializer,
    CustomerAddressOutputSerializer,
    PlaceOrderInputSerializer,
    PlaceOrderOutputSerializer,
    RecoverPlacementInputSerializer,
    RecoverPlacementOutputSerializer,
)


class CustomerAddressListView(BrowserAPIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: CustomerAddressOutputSerializer(many=True)},
        tags=["Checkout"],
        operation_id="checkout_addresses_list",
    )
    def get(self, request: Request) -> Response:
        addresses = services.list_customer_addresses(request.user)
        serializer = CustomerAddressOutputSerializer(addresses, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        request=CustomerAddressInputSerializer,
        responses={201: CustomerAddressOutputSerializer},
        tags=["Checkout"],
        operation_id="checkout_addresses_create",
    )
    def post(self, request: Request) -> Response:
        serializer = CustomerAddressInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        address = services.create_customer_address(request.user, serializer.validated_data)
        output = CustomerAddressOutputSerializer(address)
        return Response(output.data, status=status.HTTP_201_CREATED)


class CustomerAddressDetailView(BrowserAPIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=CustomerAddressInputSerializer,
        responses={200: CustomerAddressOutputSerializer},
        tags=["Checkout"],
        operation_id="checkout_addresses_update",
    )
    def patch(self, request: Request, address_id: UUID) -> Response:
        serializer = CustomerAddressInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        address = services.update_customer_address(
            request.user, address_id, serializer.validated_data
        )
        output = CustomerAddressOutputSerializer(address)
        return Response(output.data, status=status.HTTP_200_OK)

    @extend_schema(
        responses={204: EmptySerializer},
        tags=["Checkout"],
        operation_id="checkout_addresses_delete",
    )
    def delete(self, request: Request, address_id: UUID) -> Response:
        services.delete_customer_address(request.user, address_id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CheckoutQuoteView(BrowserAPIView):
    permission_classes = [AllowAny]

    @extend_schema(
        request=CheckoutQuoteInputSerializer,
        responses={200: CheckoutQuoteOutputSerializer},
        tags=["Checkout"],
        operation_id="checkout_quote",
    )
    def post(self, request: Request) -> Response:
        serializer = CheckoutQuoteInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        cart = get_or_create_cart(request)

        # Resolve address
        shipping_address = data.get("shipping_address") or {}
        address_id = data.get("address_id")
        user = getattr(request, "user", None)

        if address_id:
            if not user or not user.is_authenticated:
                raise ValidationError(
                    {"address_id": "Authentication required to use a saved address."}
                )
            addr = services.get_customer_address(user, address_id)
            shipping_address = {
                "full_name": addr.full_name,
                "phone": addr.phone,
                "line1": addr.line1,
                "line2": addr.line2,
                "city": addr.city,
                "state": addr.state,
                "postal_code": addr.postal_code,
                "country": addr.country,
            }

        quote = services.calculate_checkout_quote(
            cart=cart,
            shipping_address=shipping_address,
            shipping_selections=data.get("shipping_selections"),
            coupon_code=data.get("coupon_code"),
            customer=user,
        )
        if (
            address_id
            and data.get("shipping_address")
            and address_snapshot(data["shipping_address"]) != address_snapshot(shipping_address)
        ):
            raise ReviewConflict()
        quote["quote_token"] = issue_review(cart, shipping_address, quote)
        return Response(quote, status=status.HTTP_200_OK)


class PlaceOrderView(BrowserAPIView):
    permission_classes = [AllowAny]

    @extend_schema(
        request=PlaceOrderInputSerializer,
        responses={201: PlaceOrderOutputSerializer},
        tags=["Checkout"],
        operation_id="checkout_place_order",
    )
    def post(self, request: Request) -> Response:
        serializer = PlaceOrderInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        result = services.place_order(
            request=request,
            shipping_address_data=data.get("shipping_address"),
            address_id=data.get("address_id"),
            billing_address_data=data.get("billing_address"),
            customer_email=data.get("customer_email"),
            shipping_selections=data.get("shipping_selections"),
            coupon_code=data.get("coupon_code"),
            idempotency_key=data.get("idempotency_key"),
            expected_cart_id=data.get("cart_id"),
            quote_token=data.get("quote_token"),
        )
        if not request.user.is_authenticated:
            remember_guest_order(request, UUID(str(result["order_id"])))
        return Response(result, status=status.HTTP_201_CREATED)


class RecoverPlacementView(BrowserAPIView):
    permission_classes = [AllowAny]

    @extend_schema(
        request=RecoverPlacementInputSerializer,
        responses={200: RecoverPlacementOutputSerializer},
        description=(
            "Find the committed order or permanently close an uncommitted attempt key in the "
            "owned cart. Requires CSRF, including for guests. Never repeats placement or payment."
        ),
        tags=["Checkout"],
        operation_id="checkout_recover_placement",
    )
    def post(self, request: Request) -> Response:
        serializer = RecoverPlacementInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        result = services.recover_placement(
            request=request, cart_id=data["cart_id"], key=data["idempotency_key"]
        )
        if result["order_id"] is not None and not request.user.is_authenticated:
            remember_guest_order(request, result["order_id"])
        return Response(RecoverPlacementOutputSerializer(result).data)
