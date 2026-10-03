from __future__ import annotations

from typing import Any

from rest_framework import serializers

from apps.accounts.serializers import StrictSerializer


class CustomerAddressInputSerializer(StrictSerializer):
    full_name = serializers.CharField(max_length=120, required=True)
    phone = serializers.CharField(max_length=32, required=True)
    line1 = serializers.CharField(max_length=255, required=True)
    line2 = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    city = serializers.CharField(max_length=100, required=True)
    state = serializers.CharField(max_length=100, required=True)
    postal_code = serializers.CharField(max_length=32, required=True)
    country = serializers.CharField(max_length=2, required=False, default="US")
    is_default = serializers.BooleanField(required=False, default=False)


class CustomerAddressOutputSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    full_name = serializers.CharField()
    phone = serializers.CharField()
    line1 = serializers.CharField()
    line2 = serializers.CharField()
    city = serializers.CharField()
    state = serializers.CharField()
    postal_code = serializers.CharField()
    country = serializers.CharField()
    is_default = serializers.BooleanField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()


class ShippingOptionSerializer(serializers.Serializer[Any]):
    method_id = serializers.CharField()
    name = serializers.CharField()
    carrier = serializers.CharField()
    code = serializers.CharField()
    min_days = serializers.IntegerField()
    max_days = serializers.IntegerField()
    rate = serializers.CharField()


class CheckoutQuoteItemSerializer(serializers.Serializer[Any]):
    item_id = serializers.CharField()
    variant_id = serializers.CharField()
    product_id = serializers.CharField()
    product_title = serializers.CharField()
    sku = serializers.CharField()
    quantity = serializers.IntegerField()
    unit_price = serializers.CharField()
    line_subtotal = serializers.CharField()
    available_stock = serializers.IntegerField()
    is_in_stock = serializers.BooleanField()


class CheckoutQuoteSellerSerializer(serializers.Serializer[Any]):
    seller_id = serializers.CharField()
    seller_name = serializers.CharField()
    seller_slug = serializers.CharField()
    subtotal = serializers.CharField()
    shipping_fee = serializers.CharField()
    discount_amount = serializers.CharField()
    tax_amount = serializers.CharField()
    total = serializers.CharField()
    available_shipping_methods = ShippingOptionSerializer(many=True)
    selected_shipping_method = ShippingOptionSerializer(allow_null=True)
    items = CheckoutQuoteItemSerializer(many=True)


class CouponSummarySerializer(serializers.Serializer[Any]):
    code = serializers.CharField(allow_null=True)
    valid = serializers.BooleanField()
    discount_amount = serializers.CharField()
    error_message = serializers.CharField(allow_null=True)


class CheckoutQuoteOutputSerializer(serializers.Serializer[Any]):
    total_items = serializers.IntegerField()
    subtotal = serializers.CharField()
    shipping_total = serializers.CharField()
    discount_total = serializers.CharField()
    tax_total = serializers.CharField()
    grand_total = serializers.CharField()
    currency = serializers.CharField()
    coupon = CouponSummarySerializer()
    sellers = CheckoutQuoteSellerSerializer(many=True)


class CheckoutQuoteInputSerializer(StrictSerializer):
    shipping_address = serializers.DictField(required=False, default=dict)
    address_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    shipping_selections = serializers.DictField(
        child=serializers.CharField(), required=False, default=dict
    )
    coupon_code = serializers.CharField(
        required=False, allow_blank=True, allow_null=True, default=None
    )


class PlaceOrderInputSerializer(StrictSerializer):
    shipping_address = serializers.DictField(required=False, default=dict)
    address_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    billing_address = serializers.DictField(required=False, allow_null=True, default=None)
    customer_email = serializers.EmailField(
        required=False, allow_blank=True, allow_null=True, default=None
    )
    shipping_selections = serializers.DictField(
        child=serializers.CharField(), required=False, default=dict
    )
    coupon_code = serializers.CharField(
        required=False, allow_blank=True, allow_null=True, default=None
    )
    idempotency_key = serializers.CharField(
        required=False, allow_blank=True, allow_null=True, default=None
    )


class PlacedSellerOrderSerializer(serializers.Serializer[Any]):
    id = serializers.CharField()
    seller_order_number = serializers.CharField()
    seller_name = serializers.CharField()
    subtotal = serializers.CharField()
    shipping_total = serializers.CharField()
    seller_net_total = serializers.CharField()


class PlaceOrderOutputSerializer(serializers.Serializer[Any]):
    order_id = serializers.CharField()
    order_number = serializers.CharField()
    customer_email = serializers.CharField()
    grand_total = serializers.CharField()
    currency = serializers.CharField()
    payment_status = serializers.CharField()
    seller_orders = PlacedSellerOrderSerializer(many=True)
    payment_instructions = serializers.DictField()
