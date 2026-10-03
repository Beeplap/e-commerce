from __future__ import annotations

from uuid import UUID

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

from apps.accounts.serializers import EmptySerializer
from apps.accounts.views import BrowserAPIView

from . import services
from .serializers import (
    CartItemAddInputSerializer,
    CartItemUpdateInputSerializer,
    CartOutputSerializer,
    CartStockValidationSerializer,
)


class CartView(BrowserAPIView):
    permission_classes = [AllowAny]

    @extend_schema(
        responses={200: CartOutputSerializer},
        tags=["Cart"],
        operation_id="cart_get",
    )
    def get(self, request: Request) -> Response:
        cart = services.get_or_create_cart(request)
        data = services.format_cart_response(cart)
        return Response(data, status=status.HTTP_200_OK)


class CartItemAddView(BrowserAPIView):
    permission_classes = [AllowAny]

    @extend_schema(
        request=CartItemAddInputSerializer,
        responses={201: CartOutputSerializer},
        tags=["Cart"],
        operation_id="cart_items_add",
    )
    def post(self, request: Request) -> Response:
        serializer = CartItemAddInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cart = services.get_or_create_cart(request)
        services.add_item_to_cart(
            cart,
            variant_id=serializer.validated_data["variant_id"],
            quantity=serializer.validated_data.get("quantity", 1),
        )
        data = services.format_cart_response(cart)
        return Response(data, status=status.HTTP_201_CREATED)


class CartItemDetailView(BrowserAPIView):
    permission_classes = [AllowAny]

    @extend_schema(
        request=CartItemUpdateInputSerializer,
        responses={200: CartOutputSerializer},
        tags=["Cart"],
        operation_id="cart_items_update",
    )
    def patch(self, request: Request, item_id: UUID) -> Response:
        serializer = CartItemUpdateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cart = services.get_or_create_cart(request)
        services.update_item_quantity(
            cart,
            item_id=item_id,
            quantity=serializer.validated_data["quantity"],
        )
        data = services.format_cart_response(cart)
        return Response(data, status=status.HTTP_200_OK)

    @extend_schema(
        responses={200: CartOutputSerializer},
        tags=["Cart"],
        operation_id="cart_items_delete",
    )
    def delete(self, request: Request, item_id: UUID) -> Response:
        cart = services.get_or_create_cart(request)
        services.remove_item_from_cart(cart, item_id=item_id)
        data = services.format_cart_response(cart)
        return Response(data, status=status.HTTP_200_OK)


class CartClearView(BrowserAPIView):
    permission_classes = [AllowAny]

    @extend_schema(
        request=EmptySerializer,
        responses={200: CartOutputSerializer},
        tags=["Cart"],
        operation_id="cart_clear",
    )
    def post(self, request: Request) -> Response:
        cart = services.get_or_create_cart(request)
        services.clear_cart(cart)
        data = services.format_cart_response(cart)
        return Response(data, status=status.HTTP_200_OK)


class CartStockValidateView(BrowserAPIView):
    permission_classes = [AllowAny]

    @extend_schema(
        responses={200: CartStockValidationSerializer},
        tags=["Cart"],
        operation_id="cart_validate_stock",
    )
    def get(self, request: Request) -> Response:
        cart = services.get_or_create_cart(request)
        valid, issues = services.validate_cart_stock(cart)
        return Response({"valid": valid, "issues": issues}, status=status.HTTP_200_OK)

    @extend_schema(
        request=EmptySerializer,
        responses={200: CartStockValidationSerializer},
        tags=["Cart"],
        operation_id="cart_validate_stock_post",
    )
    def post(self, request: Request) -> Response:
        cart = services.get_or_create_cart(request)
        valid, issues = services.validate_cart_stock(cart)
        return Response({"valid": valid, "issues": issues}, status=status.HTTP_200_OK)
