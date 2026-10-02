from __future__ import annotations

from typing import Any

from rest_framework import serializers

from apps.orders.models import Order, OrderItem, OrderStatusHistory, SellerOrder
from apps.sellers.lifecycle_serializers import PageSerializer


class SellerOrderFilterSerializer(serializers.Serializer[Any]):
    status = serializers.ChoiceField(
        choices=SellerOrder.Status.choices,
        required=False,
        allow_null=True,
        default=None,
    )
    search = serializers.CharField(required=False, allow_blank=True, default=None)


class PlatformOrderFilterSerializer(serializers.Serializer[Any]):
    payment_status = serializers.ChoiceField(
        choices=Order.PaymentStatus.choices,
        required=False,
        allow_null=True,
        default=None,
    )
    fulfillment_status = serializers.ChoiceField(
        choices=Order.FulfillmentStatus.choices,
        required=False,
        allow_null=True,
        default=None,
    )
    search = serializers.CharField(required=False, allow_blank=True, default=None)


class SellerOrderShipInputSerializer(serializers.Serializer[Any]):
    tracking_number = serializers.CharField(
        required=False, allow_blank=True, default="", max_length=128
    )
    carrier = serializers.CharField(required=False, allow_blank=True, default="", max_length=64)


class SellerOrderCancelInputSerializer(serializers.Serializer[Any]):
    reason = serializers.CharField(required=True, min_length=1, max_length=500)


class OrderItemOutputSerializer(serializers.ModelSerializer[OrderItem]):
    unit_price = serializers.CharField()
    discount_amount = serializers.CharField()
    tax_amount = serializers.CharField()
    total = serializers.CharField()
    commission_amount = serializers.CharField()
    seller_net_amount = serializers.CharField()

    class Meta:
        model = OrderItem
        fields = [
            "id",
            "product_id",
            "variant_id",
            "warehouse_id",
            "product_name_snapshot",
            "sku_snapshot",
            "variant_snapshot",
            "quantity",
            "unit_price",
            "discount_amount",
            "tax_amount",
            "total",
            "commission_amount",
            "seller_net_amount",
        ]


class OrderStatusHistoryOutputSerializer(serializers.ModelSerializer[OrderStatusHistory]):
    class Meta:
        model = OrderStatusHistory
        fields = [
            "id",
            "actor_id",
            "from_status",
            "to_status",
            "notes",
            "created_at",
        ]


class SellerOrderListOutputSerializer(serializers.ModelSerializer[SellerOrder]):
    order_number = serializers.CharField(source="order.order_number")
    currency = serializers.CharField(source="order.currency")
    subtotal = serializers.CharField()
    discount_total = serializers.CharField()
    tax_total = serializers.CharField()
    shipping_total = serializers.CharField()
    commission_total = serializers.CharField()
    seller_net_total = serializers.CharField()
    items_count = serializers.SerializerMethodField()

    class Meta:
        model = SellerOrder
        fields = [
            "id",
            "order_id",
            "order_number",
            "seller_order_number",
            "currency",
            "subtotal",
            "discount_total",
            "tax_total",
            "shipping_total",
            "commission_total",
            "seller_net_total",
            "status",
            "items_count",
            "created_at",
            "updated_at",
        ]

    def get_items_count(self, obj: SellerOrder) -> int:
        return obj.items.count()


class SellerOrderDetailOutputSerializer(serializers.ModelSerializer[SellerOrder]):
    order_number = serializers.CharField(source="order.order_number")
    currency = serializers.CharField(source="order.currency")
    customer_email = serializers.CharField(source="order.customer_email")
    shipping_address_snapshot = serializers.JSONField(source="order.shipping_address_snapshot")
    billing_address_snapshot = serializers.JSONField(source="order.billing_address_snapshot")
    subtotal = serializers.CharField()
    discount_total = serializers.CharField()
    tax_total = serializers.CharField()
    shipping_total = serializers.CharField()
    commission_total = serializers.CharField()
    seller_net_total = serializers.CharField()
    items = OrderItemOutputSerializer(many=True, read_only=True)
    status_history = OrderStatusHistoryOutputSerializer(many=True, read_only=True)

    class Meta:
        model = SellerOrder
        fields = [
            "id",
            "order_id",
            "order_number",
            "seller_order_number",
            "currency",
            "customer_email",
            "subtotal",
            "discount_total",
            "tax_total",
            "shipping_total",
            "commission_total",
            "seller_net_total",
            "status",
            "shipping_address_snapshot",
            "billing_address_snapshot",
            "items",
            "status_history",
            "created_at",
            "updated_at",
        ]


class PlatformSellerOrderSummarySerializer(serializers.ModelSerializer[SellerOrder]):
    seller_name = serializers.CharField(source="seller.display_name")
    subtotal = serializers.CharField()
    discount_total = serializers.CharField()
    tax_total = serializers.CharField()
    shipping_total = serializers.CharField()
    commission_total = serializers.CharField()
    seller_net_total = serializers.CharField()
    items = OrderItemOutputSerializer(many=True, read_only=True)
    status_history = OrderStatusHistoryOutputSerializer(many=True, read_only=True)

    class Meta:
        model = SellerOrder
        fields = [
            "id",
            "seller_id",
            "seller_name",
            "seller_order_number",
            "subtotal",
            "discount_total",
            "tax_total",
            "shipping_total",
            "commission_total",
            "seller_net_total",
            "status",
            "items",
            "status_history",
            "created_at",
            "updated_at",
        ]


class PlatformOrderListOutputSerializer(serializers.ModelSerializer[Order]):
    subtotal = serializers.CharField()
    discount_total = serializers.CharField()
    tax_total = serializers.CharField()
    shipping_total = serializers.CharField()
    grand_total = serializers.CharField()
    seller_orders_count = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id",
            "order_number",
            "customer_email",
            "currency",
            "subtotal",
            "discount_total",
            "tax_total",
            "shipping_total",
            "grand_total",
            "payment_status",
            "fulfillment_status",
            "seller_orders_count",
            "created_at",
            "updated_at",
        ]

    def get_seller_orders_count(self, obj: Order) -> int:
        return obj.seller_orders.count()


class PlatformOrderDetailOutputSerializer(serializers.ModelSerializer[Order]):
    subtotal = serializers.CharField()
    discount_total = serializers.CharField()
    tax_total = serializers.CharField()
    shipping_total = serializers.CharField()
    grand_total = serializers.CharField()
    seller_orders = PlatformSellerOrderSummarySerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "order_number",
            "customer_id",
            "customer_email",
            "currency",
            "subtotal",
            "discount_total",
            "tax_total",
            "shipping_total",
            "grand_total",
            "payment_status",
            "fulfillment_status",
            "billing_address_snapshot",
            "shipping_address_snapshot",
            "seller_orders",
            "created_at",
            "updated_at",
        ]


class SellerOrderPage(PageSerializer):
    results = SellerOrderListOutputSerializer(many=True)


class PlatformOrderPage(PageSerializer):
    results = PlatformOrderListOutputSerializer(many=True)
