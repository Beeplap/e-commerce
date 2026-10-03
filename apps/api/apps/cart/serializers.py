from __future__ import annotations

from typing import Any

from rest_framework import serializers

from apps.accounts.serializers import StrictSerializer


class CartItemAddInputSerializer(StrictSerializer):
    variant_id = serializers.UUIDField(required=True)
    quantity = serializers.IntegerField(required=False, default=1, min_value=1)


class CartItemUpdateInputSerializer(StrictSerializer):
    quantity = serializers.IntegerField(required=True, min_value=0)


class CartItemOutputSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    variant_id = serializers.UUIDField()
    product_id = serializers.UUIDField()
    product_title = serializers.CharField()
    product_slug = serializers.CharField()
    variant_name = serializers.CharField()
    sku = serializers.CharField()
    thumbnail_url = serializers.CharField(allow_null=True)
    unit_price = serializers.CharField()
    compare_at_price = serializers.CharField(allow_null=True)
    quantity = serializers.IntegerField()
    line_subtotal = serializers.CharField()
    available_stock = serializers.IntegerField()
    is_available = serializers.BooleanField()
    stock_warning = serializers.CharField(allow_null=True)


class SellerCartGroupSerializer(serializers.Serializer[Any]):
    seller_id = serializers.UUIDField()
    seller_name = serializers.CharField()
    seller_slug = serializers.CharField()
    subtotal = serializers.CharField()
    item_count = serializers.IntegerField()
    items = CartItemOutputSerializer(many=True)


class CartOutputSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    total_items = serializers.IntegerField()
    total_unique_items = serializers.IntegerField()
    subtotal = serializers.CharField()
    currency = serializers.CharField()
    has_out_of_stock_items = serializers.BooleanField()
    sellers = SellerCartGroupSerializer(many=True)


class CartStockIssueSerializer(serializers.Serializer[Any]):
    item_id = serializers.UUIDField()
    variant_id = serializers.UUIDField()
    sku = serializers.CharField()
    requested_quantity = serializers.IntegerField()
    available_stock = serializers.IntegerField()
    issue = serializers.CharField()
    message = serializers.CharField()


class CartStockValidationSerializer(serializers.Serializer[Any]):
    valid = serializers.BooleanField()
    issues = CartStockIssueSerializer(many=True)
