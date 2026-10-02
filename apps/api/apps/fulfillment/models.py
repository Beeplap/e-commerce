from __future__ import annotations

from decimal import Decimal
from uuid import uuid4

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone


class ShippingZone(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    seller = models.ForeignKey(
        "sellers.Seller",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="shipping_zones",
    )
    name = models.CharField(max_length=120)
    countries = models.JSONField(default=list)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name", "id"]

    def __str__(self) -> str:
        owner = self.seller.slug if self.seller else "Platform"
        return f"Zone({self.name}, {owner})"


class ShippingMethod(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    seller = models.ForeignKey(
        "sellers.Seller",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="shipping_methods",
    )
    name = models.CharField(max_length=120)
    code = models.CharField(max_length=64)
    carrier = models.CharField(max_length=64)
    estimated_delivery_days_min = models.PositiveIntegerField(default=1)
    estimated_delivery_days_max = models.PositiveIntegerField(default=5)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name", "id"]
        constraints = [
            models.CheckConstraint(
                condition=Q(
                    estimated_delivery_days_min__lte=models.F("estimated_delivery_days_max")
                ),
                name="delivery_days_range_valid",
            )
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.carrier})"


class ShippingRate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    zone = models.ForeignKey(
        ShippingZone,
        on_delete=models.CASCADE,
        related_name="rates",
    )
    method = models.ForeignKey(
        ShippingMethod,
        on_delete=models.CASCADE,
        related_name="rates",
    )
    min_order_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    max_order_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )
    weight_min = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    weight_max = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )
    rate = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    currency = models.CharField(max_length=3, default="USD")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["rate", "id"]
        constraints = [
            models.CheckConstraint(
                condition=Q(min_order_amount__gte=0),
                name="min_order_amount_nonnegative",
            ),
            models.CheckConstraint(
                condition=Q(rate__gte=0),
                name="shipping_rate_nonnegative",
            ),
        ]

    def __str__(self) -> str:
        return f"Rate({self.method.name} -> {self.zone.name}: {self.currency} {self.rate})"


class Shipment(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PREPARING = "preparing", "Preparing"
        SHIPPED = "shipped", "Shipped"
        IN_TRANSIT = "in_transit", "In Transit"
        OUT_FOR_DELIVERY = "out_for_delivery", "Out for Delivery"
        DELIVERED = "delivered", "Delivered"
        FAILED = "failed", "Failed"
        CANCELLED = "cancelled", "Cancelled"

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    shipment_number = models.CharField(max_length=64, unique=True, db_index=True)
    seller_order = models.ForeignKey(
        "orders.SellerOrder",
        on_delete=models.PROTECT,
        related_name="shipments",
    )
    seller = models.ForeignKey(
        "sellers.Seller",
        on_delete=models.PROTECT,
        related_name="shipments",
    )
    shipping_method = models.ForeignKey(
        ShippingMethod,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="shipments",
    )
    carrier = models.CharField(max_length=64)
    tracking_number = models.CharField(max_length=120, blank=True, default="")
    tracking_url = models.URLField(blank=True, default="")
    status = models.CharField(
        max_length=32,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    shipped_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    estimated_delivery_at = models.DateTimeField(null=True, blank=True)
    shipping_label_url = models.CharField(max_length=255, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self) -> str:
        return f"Shipment {self.shipment_number} ({self.seller.slug}: {self.status})"


class ShipmentItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    shipment = models.ForeignKey(
        Shipment,
        on_delete=models.CASCADE,
        related_name="items",
    )
    order_item = models.ForeignKey(
        "orders.OrderItem",
        on_delete=models.PROTECT,
        related_name="shipment_items",
    )
    quantity = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]
        constraints = [
            models.CheckConstraint(
                condition=Q(quantity__gt=0),
                name="shipment_item_quantity_positive",
            )
        ]

    def __str__(self) -> str:
        return f"{self.shipment.shipment_number} - {self.order_item.sku_snapshot} x {self.quantity}"


class TrackingEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    shipment = models.ForeignKey(
        Shipment,
        on_delete=models.CASCADE,
        related_name="tracking_events",
    )
    status = models.CharField(max_length=32)
    location = models.CharField(max_length=255, blank=True, default="")
    description = models.TextField(blank=True, default="")
    timestamp = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-timestamp", "-created_at"]

    def __str__(self) -> str:
        return f"{self.shipment.shipment_number}: {self.status} at {self.location}"


class ReturnRequest(models.Model):
    class Status(models.TextChoices):
        REQUESTED = "requested", "Requested"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        IN_TRANSIT = "in_transit", "In Transit"
        RECEIVED = "received", "Received"
        REFUND_PENDING = "refund_pending", "Refund Pending"
        REFUNDED = "refunded", "Refunded"
        CLOSED = "closed", "Closed"

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    return_number = models.CharField(max_length=64, unique=True, db_index=True)
    seller_order = models.ForeignKey(
        "orders.SellerOrder",
        on_delete=models.PROTECT,
        related_name="return_requests",
    )
    seller = models.ForeignKey(
        "sellers.Seller",
        on_delete=models.PROTECT,
        related_name="return_requests",
    )
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="return_requests",
    )
    status = models.CharField(
        max_length=32,
        choices=Status.choices,
        default=Status.REQUESTED,
        db_index=True,
    )
    reason = models.CharField(max_length=64)
    customer_notes = models.TextField(blank=True, default="")
    rejection_reason = models.TextField(blank=True, default="")
    return_tracking_number = models.CharField(max_length=120, blank=True, default="")
    return_carrier = models.CharField(max_length=64, blank=True, default="")
    requested_at = models.DateTimeField(auto_now_add=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    received_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self) -> str:
        return f"Return {self.return_number} ({self.seller.slug}: {self.status})"


class ReturnItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    return_request = models.ForeignKey(
        ReturnRequest,
        on_delete=models.CASCADE,
        related_name="items",
    )
    order_item = models.ForeignKey(
        "orders.OrderItem",
        on_delete=models.PROTECT,
        related_name="return_items",
    )
    quantity = models.PositiveIntegerField()
    reason = models.CharField(max_length=120, blank=True, default="")
    condition = models.CharField(max_length=64, blank=True, default="unopened")
    restock_inventory = models.BooleanField(default=True)
    warehouse = models.ForeignKey(
        "inventory.Warehouse",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="returned_items",
    )
    refund_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
    )

    class Meta:
        ordering = ["id"]
        constraints = [
            models.CheckConstraint(
                condition=Q(quantity__gt=0),
                name="return_item_quantity_positive",
            ),
            models.CheckConstraint(
                condition=Q(refund_amount__gte=0),
                name="return_item_refund_amount_nonnegative",
            ),
        ]

    def __str__(self) -> str:
        sku = self.order_item.sku_snapshot
        return f"{self.return_request.return_number} - {sku} x {self.quantity}"


class ReturnStatusHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    return_request = models.ForeignKey(
        ReturnRequest,
        on_delete=models.CASCADE,
        related_name="status_history",
    )
    actor_id = models.UUIDField(null=True, blank=True)
    from_status = models.CharField(max_length=32)
    to_status = models.CharField(max_length=32)
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self) -> str:
        return f"{self.return_request.return_number}: {self.from_status} -> {self.to_status}"


class Refund(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    refund_number = models.CharField(max_length=64, unique=True, db_index=True)
    seller_order = models.ForeignKey(
        "orders.SellerOrder",
        on_delete=models.PROTECT,
        related_name="refunds",
    )
    seller = models.ForeignKey(
        "sellers.Seller",
        on_delete=models.PROTECT,
        related_name="refunds",
    )
    return_request = models.ForeignKey(
        ReturnRequest,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="refunds",
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default="USD")
    status = models.CharField(
        max_length=32,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    reason = models.CharField(max_length=120)
    commission_reversed = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    seller_deduction = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="created_refunds",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=Q(amount__gt=0),
                name="refund_amount_positive",
            ),
            models.CheckConstraint(
                condition=Q(commission_reversed__gte=0),
                name="refund_commission_reversed_nonnegative",
            ),
            models.CheckConstraint(
                condition=Q(seller_deduction__gte=0),
                name="refund_seller_deduction_nonnegative",
            ),
        ]

    def __str__(self) -> str:
        return f"Refund {self.refund_number} ({self.seller.slug}: {self.currency} {self.amount})"


class RefundTransaction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    refund = models.ForeignKey(
        Refund,
        on_delete=models.CASCADE,
        related_name="transactions",
    )
    transaction_type = models.CharField(max_length=32)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    gateway_reference = models.CharField(max_length=120, blank=True, default="")
    status = models.CharField(max_length=32)
    raw_response = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self) -> str:
        return f"{self.refund.refund_number}: {self.transaction_type} {self.amount}"
