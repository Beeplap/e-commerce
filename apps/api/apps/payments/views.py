from __future__ import annotations

from uuid import UUID

from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.views import BrowserAPIView
from apps.payments.models import Payment

from . import selectors, services
from .serializers import (
    ConfirmPaymentInputSerializer,
    OrderPaymentStateSerializer,
    PaymentIntentInputSerializer,
    PaymentOutputSerializer,
    WebhookResultSerializer,
)


class OrderPaymentStateView(BrowserAPIView):
    # Not a public order lookup: guest UUIDs must already belong to this server session.
    permission_classes = [AllowAny]

    @extend_schema(
        responses={200: OrderPaymentStateSerializer},
        description=(
            "Read minimal payment recovery evidence for the customer's own order or an order "
            "already bound to this guest's Django session. Does not create or charge a payment."
        ),
        tags=["Payments"],
        operation_id="payments_order_state",
    )
    def get(self, request: Request, order_id: UUID) -> Response:
        state = selectors.order_payment_state(
            orders=services.payable_orders_for(request), order_id=order_id
        )
        return Response(OrderPaymentStateSerializer(state).data)


class PaymentIntentView(BrowserAPIView):
    # Guests may pay, but only for orders bound to their own server-side session; customers
    # only for their own orders. Ownership is enforced in the service via payable_orders_for.
    permission_classes = [AllowAny]

    @extend_schema(
        request=PaymentIntentInputSerializer,
        responses={200: PaymentOutputSerializer, 201: PaymentOutputSerializer},
        tags=["Payments"],
        operation_id="payments_create_intent",
    )
    def post(self, request: Request) -> Response:
        serializer = PaymentIntentInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        payment, created = services.create_payment_intent(
            orders=services.payable_orders_for(request),
            order_id=data["order_id"],
            idempotency_key=data["idempotency_key"],
            provider=data["provider"],
            actor=request.user,
        )
        return Response(
            PaymentOutputSerializer(payment).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class ConfirmPaymentView(BrowserAPIView):
    permission_classes = [AllowAny]

    @extend_schema(
        request=ConfirmPaymentInputSerializer,
        responses={
            200: PaymentOutputSerializer,
            402: OpenApiResponse(PaymentOutputSerializer, description="Payment declined."),
        },
        tags=["Payments"],
        operation_id="payments_confirm",
    )
    def post(self, request: Request) -> Response:
        serializer = ConfirmPaymentInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        payment = services.confirm_payment(
            orders=services.payable_orders_for(request),
            payment_id=data["payment_id"],
            idempotency_key=data["idempotency_key"],
            payment_token=data["payment_token"],
            actor=request.user,
        )
        body = dict(PaymentOutputSerializer(payment).data)
        if payment.status == Payment.Status.FAILED:
            body["detail"] = payment.error_message
            return Response(body, status=status.HTTP_402_PAYMENT_REQUIRED)
        return Response(body, status=status.HTTP_200_OK)


class PaymentWebhookView(APIView):
    """Server-to-server gateway callback authenticated only by its HMAC-SHA256 signature."""

    permission_classes = [AllowAny]
    authentication_classes: list[type] = []

    @extend_schema(
        request=None,
        responses={200: WebhookResultSerializer},
        tags=["Payments"],
        operation_id="payments_webhook",
    )
    def post(self, request: Request) -> Response:
        signature = request.headers.get("X-Payment-Signature", "")
        result = services.handle_payment_webhook(payload=request.body, signature=signature)
        return Response({"received": True, **result}, status=status.HTTP_200_OK)
