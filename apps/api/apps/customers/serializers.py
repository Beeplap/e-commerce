from __future__ import annotations

from typing import Any

from rest_framework import serializers

from apps.accounts.serializers import StrictSerializer
from apps.fulfillment.models import ReturnRequest, TrackingEvent
from apps.orders.models import Order, OrderItem, SellerOrder
from apps.reviews.models import ProductReview


def compute_order_status(order: Order) -> str:
    if order.fulfillment_status == Order.FulfillmentStatus.CANCELLED:
        return "cancelled"
    if order.payment_status == Order.PaymentStatus.FAILED:
        return "failed"
    if order.payment_status == Order.PaymentStatus.REFUNDED:
        return "refunded"
    if order.fulfillment_status == Order.FulfillmentStatus.FULFILLED:
        return "delivered"
    if order.seller_orders.filter(status=SellerOrder.Status.SHIPPED).exists():
        return "shipped"
    if order.seller_orders.filter(status=SellerOrder.Status.PROCESSING).exists():
        return "processing"
    if order.payment_status == Order.PaymentStatus.PAID:
        return "confirmed"
    return "pending"


class CustomerProfileSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    email = serializers.EmailField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    phone = serializers.CharField()
    is_email_verified = serializers.BooleanField()
    created_at = serializers.DateTimeField()


class CustomerProfileUpdateSerializer(StrictSerializer):
    first_name = serializers.CharField(max_length=150, required=False)
    last_name = serializers.CharField(max_length=150, required=False)
    email = serializers.EmailField(required=False)
    phone = serializers.CharField(max_length=32, required=False, allow_blank=True)


class CustomerOrderItemSerializer(serializers.ModelSerializer[OrderItem]):
    product_title = serializers.CharField(source="product_name_snapshot")
    variant_name = serializers.SerializerMethodField()
    sku = serializers.CharField(source="sku_snapshot")
    total_price = serializers.DecimalField(max_digits=14, decimal_places=2, source="total")
    can_review = serializers.SerializerMethodField()
    can_return = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = [
            "id",
            "product_id",
            "product_title",
            "variant_id",
            "variant_name",
            "sku",
            "quantity",
            "unit_price",
            "total_price",
            "can_review",
            "can_return",
        ]

    def get_variant_name(self, obj: OrderItem) -> str:
        if isinstance(obj.variant_snapshot, dict):
            return obj.variant_snapshot.get("name") or obj.sku_snapshot
        return obj.sku_snapshot

    def get_can_review(self, obj: OrderItem) -> bool:
        return obj.seller_order.status == SellerOrder.Status.DELIVERED

    def get_can_return(self, obj: OrderItem) -> bool:
        return obj.seller_order.status in (
            SellerOrder.Status.SHIPPED,
            SellerOrder.Status.DELIVERED,
        )


class TrackingEventSerializer(serializers.ModelSerializer[TrackingEvent]):
    class Meta:
        model = TrackingEvent
        fields = ["id", "status", "location", "description", "timestamp"]


class CustomerPackageSerializer(serializers.ModelSerializer[SellerOrder]):
    seller_order_id = serializers.UUIDField(source="id")
    seller_id = serializers.UUIDField(source="seller.id")
    seller_name = serializers.CharField(source="seller.display_name")
    carrier = serializers.SerializerMethodField()
    tracking_number = serializers.SerializerMethodField()
    items = CustomerOrderItemSerializer(many=True)
    tracking_events = serializers.SerializerMethodField()

    class Meta:
        model = SellerOrder
        fields = [
            "seller_order_id",
            "seller_id",
            "seller_name",
            "status",
            "carrier",
            "tracking_number",
            "items",
            "tracking_events",
        ]

    def get_carrier(self, obj: SellerOrder) -> str:
        shipment = obj.shipments.first()
        return shipment.carrier if shipment else ""

    def get_tracking_number(self, obj: SellerOrder) -> str:
        shipment = obj.shipments.first()
        return shipment.tracking_number if shipment else ""

    def get_tracking_events(self, obj: SellerOrder) -> list[dict[str, Any]]:
        events: list[dict[str, Any]] = []
        for shipment in obj.shipments.all():
            for te in shipment.tracking_events.all():
                events.append(
                    {
                        "id": str(te.id),
                        "status": te.status,
                        "location": te.location,
                        "description": te.description,
                        "timestamp": te.timestamp.isoformat(),
                    }
                )
        return events


class CustomerOrderListSerializer(serializers.ModelSerializer[Order]):
    status = serializers.SerializerMethodField()
    total_items = serializers.SerializerMethodField()
    packages_count = serializers.SerializerMethodField()
    items_preview = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id",
            "order_number",
            "created_at",
            "status",
            "payment_status",
            "fulfillment_status",
            "grand_total",
            "currency",
            "total_items",
            "packages_count",
            "items_preview",
        ]

    def get_status(self, obj: Order) -> str:
        return compute_order_status(obj)

    def get_total_items(self, obj: Order) -> int:
        return sum(so.items.count() for so in obj.seller_orders.all())

    def get_packages_count(self, obj: Order) -> int:
        return obj.seller_orders.count()

    def get_items_preview(self, obj: Order) -> list[dict[str, Any]]:
        previews: list[dict[str, Any]] = []
        for so in obj.seller_orders.all():
            for item in so.items.all()[:3]:
                variant_name = (
                    item.variant_snapshot.get("name")
                    if isinstance(item.variant_snapshot, dict)
                    else item.sku_snapshot
                )
                previews.append(
                    {
                        "id": str(item.id),
                        "product_title": item.product_name_snapshot,
                        "variant_name": variant_name or item.sku_snapshot,
                        "quantity": item.quantity,
                        "unit_price": str(item.unit_price),
                    }
                )
                if len(previews) >= 3:
                    return previews
        return previews


class CustomerOrderDetailSerializer(serializers.ModelSerializer[Order]):
    status = serializers.SerializerMethodField()
    shipping_address = serializers.JSONField(source="shipping_address_snapshot")
    billing_address = serializers.JSONField(source="billing_address_snapshot")
    packages = CustomerPackageSerializer(source="seller_orders", many=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "order_number",
            "created_at",
            "status",
            "payment_status",
            "fulfillment_status",
            "subtotal",
            "shipping_total",
            "discount_total",
            "grand_total",
            "currency",
            "shipping_address",
            "billing_address",
            "packages",
        ]

    def get_status(self, obj: Order) -> str:
        return compute_order_status(obj)


class CustomerCancelOrderInputSerializer(StrictSerializer):
    reason = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")


class CustomerReviewInputSerializer(StrictSerializer):
    order_item_id = serializers.UUIDField()
    rating = serializers.IntegerField(min_value=1, max_value=5)
    title = serializers.CharField(max_length=200)
    body = serializers.CharField(max_length=5000)


class CustomerReviewOutputSerializer(serializers.ModelSerializer[ProductReview]):
    class Meta:
        model = ProductReview
        fields = [
            "id",
            "product_id",
            "rating",
            "title",
            "body",
            "status",
            "verified_purchase",
            "created_at",
        ]


class CustomerReturnInputSerializer(StrictSerializer):
    order_item_id = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=1)
    reason = serializers.CharField(max_length=64)
    customer_notes = serializers.CharField(
        max_length=1000, required=False, allow_blank=True, default=""
    )


class CustomerReturnOutputSerializer(serializers.ModelSerializer[ReturnRequest]):
    seller_name = serializers.CharField(source="seller.display_name")

    class Meta:
        model = ReturnRequest
        fields = [
            "id",
            "return_number",
            "seller_order_id",
            "seller_name",
            "status",
            "reason",
            "customer_notes",
            "created_at",
        ]
