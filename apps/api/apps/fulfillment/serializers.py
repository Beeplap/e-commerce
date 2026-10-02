from __future__ import annotations

from decimal import Decimal
from typing import Any

from rest_framework import serializers

from apps.fulfillment.models import (
    Refund,
    RefundTransaction,
    ReturnItem,
    ReturnRequest,
    ReturnStatusHistory,
    Shipment,
    ShipmentItem,
    ShippingMethod,
    ShippingRate,
    ShippingZone,
    TrackingEvent,
)


class ShippingZoneSerializer(serializers.ModelSerializer[ShippingZone]):
    class Meta:
        model = ShippingZone
        fields = [
            "id",
            "seller_id",
            "name",
            "countries",
            "is_active",
            "created_at",
            "updated_at",
        ]


class ShippingMethodSerializer(serializers.ModelSerializer[ShippingMethod]):
    class Meta:
        model = ShippingMethod
        fields = [
            "id",
            "seller_id",
            "name",
            "code",
            "carrier",
            "estimated_delivery_days_min",
            "estimated_delivery_days_max",
            "is_active",
            "created_at",
            "updated_at",
        ]


class ShippingRateSerializer(serializers.ModelSerializer[ShippingRate]):
    zone = ShippingZoneSerializer(read_only=True)
    method = ShippingMethodSerializer(read_only=True)

    class Meta:
        model = ShippingRate
        fields = [
            "id",
            "zone",
            "method",
            "min_order_amount",
            "max_order_amount",
            "weight_min",
            "weight_max",
            "rate",
            "currency",
            "created_at",
            "updated_at",
        ]


class ShipmentItemSerializer(serializers.ModelSerializer[ShipmentItem]):
    sku_snapshot = serializers.CharField(source="order_item.sku_snapshot", read_only=True)
    product_name_snapshot = serializers.CharField(
        source="order_item.product_name_snapshot", read_only=True
    )

    class Meta:
        model = ShipmentItem
        fields = [
            "id",
            "order_item_id",
            "sku_snapshot",
            "product_name_snapshot",
            "quantity",
            "created_at",
        ]


class TrackingEventSerializer(serializers.ModelSerializer[TrackingEvent]):
    class Meta:
        model = TrackingEvent
        fields = [
            "id",
            "status",
            "location",
            "description",
            "timestamp",
            "created_at",
        ]


class ShipmentSerializer(serializers.ModelSerializer[Shipment]):
    items = ShipmentItemSerializer(many=True, read_only=True)
    tracking_events = TrackingEventSerializer(many=True, read_only=True)
    seller_order_number = serializers.CharField(
        source="seller_order.seller_order_number", read_only=True
    )
    seller_name = serializers.CharField(source="seller.display_name", read_only=True)

    class Meta:
        model = Shipment
        fields = [
            "id",
            "shipment_number",
            "seller_id",
            "seller_name",
            "seller_order_id",
            "seller_order_number",
            "shipping_method_id",
            "carrier",
            "tracking_number",
            "tracking_url",
            "status",
            "shipped_at",
            "delivered_at",
            "estimated_delivery_at",
            "shipping_label_url",
            "notes",
            "items",
            "tracking_events",
            "created_at",
            "updated_at",
        ]


class CreateShipmentItemInputSerializer(serializers.Serializer[Any]):
    order_item_id = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=1)


class CreateShipmentInputSerializer(serializers.Serializer[Any]):
    seller_order_id = serializers.UUIDField()
    carrier = serializers.CharField(max_length=64)
    tracking_number = serializers.CharField(
        max_length=120, required=False, allow_blank=True, default=""
    )
    tracking_url = serializers.URLField(required=False, allow_blank=True, default="")
    shipping_method_id = serializers.UUIDField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    items = CreateShipmentItemInputSerializer(many=True)


class AddTrackingEventInputSerializer(serializers.Serializer[Any]):
    status = serializers.CharField(max_length=32)
    location = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    description = serializers.CharField(required=False, allow_blank=True, default="")


class ReturnItemSerializer(serializers.ModelSerializer[ReturnItem]):
    sku_snapshot = serializers.CharField(source="order_item.sku_snapshot", read_only=True)
    product_name_snapshot = serializers.CharField(
        source="order_item.product_name_snapshot", read_only=True
    )

    class Meta:
        model = ReturnItem
        fields = [
            "id",
            "order_item_id",
            "sku_snapshot",
            "product_name_snapshot",
            "quantity",
            "reason",
            "condition",
            "restock_inventory",
            "warehouse_id",
            "refund_amount",
        ]


class ReturnStatusHistorySerializer(serializers.ModelSerializer[ReturnStatusHistory]):
    class Meta:
        model = ReturnStatusHistory
        fields = [
            "id",
            "actor_id",
            "from_status",
            "to_status",
            "notes",
            "created_at",
        ]


class ReturnRequestSerializer(serializers.ModelSerializer[ReturnRequest]):
    items = ReturnItemSerializer(many=True, read_only=True)
    status_history = ReturnStatusHistorySerializer(many=True, read_only=True)
    seller_order_number = serializers.CharField(
        source="seller_order.seller_order_number", read_only=True
    )
    seller_name = serializers.CharField(source="seller.display_name", read_only=True)
    customer_email = serializers.EmailField(source="customer.email", read_only=True)

    class Meta:
        model = ReturnRequest
        fields = [
            "id",
            "return_number",
            "seller_id",
            "seller_name",
            "seller_order_id",
            "seller_order_number",
            "customer_id",
            "customer_email",
            "status",
            "reason",
            "customer_notes",
            "rejection_reason",
            "return_tracking_number",
            "return_carrier",
            "requested_at",
            "approved_at",
            "received_at",
            "closed_at",
            "items",
            "status_history",
            "created_at",
            "updated_at",
        ]


class CreateReturnItemInputSerializer(serializers.Serializer[Any]):
    order_item_id = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=1)
    reason = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")


class CreateReturnRequestInputSerializer(serializers.Serializer[Any]):
    seller_order_id = serializers.UUIDField()
    reason = serializers.CharField(max_length=64)
    customer_notes = serializers.CharField(required=False, allow_blank=True, default="")
    items = CreateReturnItemInputSerializer(many=True)


class ApproveReturnInputSerializer(serializers.Serializer[Any]):
    return_carrier = serializers.CharField(
        max_length=64, required=False, allow_blank=True, default=""
    )
    return_tracking_number = serializers.CharField(
        max_length=120, required=False, allow_blank=True, default=""
    )


class RejectReturnInputSerializer(serializers.Serializer[Any]):
    reason = serializers.CharField(max_length=255)


class ReceiveReturnItemInspectionInputSerializer(serializers.Serializer[Any]):
    return_item_id = serializers.UUIDField()
    condition = serializers.CharField(max_length=64, default="unopened")
    restock_inventory = serializers.BooleanField(default=True)
    warehouse_id = serializers.UUIDField(required=False, allow_null=True)


class ReceiveReturnInputSerializer(serializers.Serializer[Any]):
    items = ReceiveReturnItemInspectionInputSerializer(many=True, required=False, default=list)


class RefundTransactionSerializer(serializers.ModelSerializer[RefundTransaction]):
    class Meta:
        model = RefundTransaction
        fields = [
            "id",
            "transaction_type",
            "amount",
            "gateway_reference",
            "status",
            "raw_response",
            "created_at",
        ]


class RefundSerializer(serializers.ModelSerializer[Refund]):
    transactions = RefundTransactionSerializer(many=True, read_only=True)
    seller_order_number = serializers.CharField(
        source="seller_order.seller_order_number", read_only=True
    )
    seller_name = serializers.CharField(source="seller.display_name", read_only=True)

    class Meta:
        model = Refund
        fields = [
            "id",
            "refund_number",
            "seller_id",
            "seller_name",
            "seller_order_id",
            "seller_order_number",
            "return_request_id",
            "amount",
            "currency",
            "status",
            "reason",
            "commission_reversed",
            "seller_deduction",
            "created_by_id",
            "transactions",
            "created_at",
            "completed_at",
        ]


class CreateRefundInputSerializer(serializers.Serializer[Any]):
    seller_order_id = serializers.UUIDField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    reason = serializers.CharField(max_length=120)
    return_request_id = serializers.UUIDField(required=False, allow_null=True)
