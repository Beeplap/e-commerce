from __future__ import annotations

from typing import Any

from rest_framework import serializers

from apps.accounts.serializers import StrictSerializer
from apps.payments.services import SUPPORTED_PROVIDERS


class PaymentIntentInputSerializer(StrictSerializer):
    order_id = serializers.UUIDField()
    idempotency_key = serializers.CharField(min_length=16, max_length=128)
    provider = serializers.ChoiceField(choices=SUPPORTED_PROVIDERS, default="mock")


class ConfirmPaymentInputSerializer(StrictSerializer):
    payment_id = serializers.UUIDField()
    idempotency_key = serializers.CharField(min_length=16, max_length=128)
    # Opaque gateway token produced in the browser; the backend never receives card numbers.
    payment_token = serializers.CharField(max_length=64)


class PaymentOutputSerializer(serializers.Serializer[Any]):
    payment_id = serializers.UUIDField(source="id")
    order_id = serializers.UUIDField()
    order_number = serializers.CharField(source="order.order_number")
    amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    currency = serializers.CharField()
    status = serializers.CharField()
    provider = serializers.CharField()
    error_code = serializers.CharField()
    error_message = serializers.CharField()
    created_at = serializers.DateTimeField()


class WebhookResultSerializer(serializers.Serializer[Any]):
    received = serializers.BooleanField()
    status = serializers.CharField()
