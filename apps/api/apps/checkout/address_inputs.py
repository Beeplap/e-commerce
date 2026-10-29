"""Bounded address contracts shared by API and checkout service boundaries."""

import re
from typing import Any

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.accounts.serializers import StrictSerializer


class AddressText(serializers.CharField):
    def to_internal_value(self, data: Any) -> str:
        if not isinstance(data, str) or any(ord(char) < 32 or ord(char) == 127 for char in data):
            self.fail("invalid")
        return str(super().to_internal_value(data))


class CheckoutAddressInput(StrictSerializer):
    full_name = AddressText(max_length=120)
    phone = AddressText(max_length=32)
    line1 = AddressText(max_length=255)
    line2 = AddressText(max_length=255, required=False, allow_blank=True, default="")
    city = AddressText(max_length=100)
    state = AddressText(max_length=100)
    postal_code = AddressText(max_length=32)
    country = AddressText(min_length=2, max_length=2, required=False, default="US")

    def validate_country(self, value: str) -> str:
        if not re.fullmatch(r"[A-Za-z]{2}", value):
            raise serializers.ValidationError("Use a two-letter country code.")
        return value.upper()


class QuoteAddressInput(CheckoutAddressInput):
    def get_fields(self) -> dict[str, Any]:
        fields = super().get_fields()
        for field in fields.values():
            field.required = False
        return fields


@extend_schema_field(CheckoutAddressInput)
class AddressObjectField(serializers.DictField):
    address_schema = CheckoutAddressInput

    def to_internal_value(self, data: Any) -> dict[str, Any]:
        value: dict[str, Any] = super().to_internal_value(data)
        if not value and self.allow_empty:
            return value
        serializer = self.address_schema(data=value)
        serializer.is_valid(raise_exception=True)
        # Retain exact valid request evidence for existing idempotency digests.
        # Services use normalized values only after successful replay lookup.
        return value


@extend_schema_field(QuoteAddressInput)
class QuoteAddressObjectField(AddressObjectField):
    address_schema = QuoteAddressInput


def validate_address(
    data: dict[str, Any], *, field: str = "shipping_address", estimate: bool = False
) -> dict[str, Any]:
    serializer = (QuoteAddressInput if estimate else CheckoutAddressInput)(data=data)
    if not serializer.is_valid():
        raise serializers.ValidationError({field: serializer.errors})
    return dict(serializer.validated_data)
