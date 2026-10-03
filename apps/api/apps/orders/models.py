from __future__ import annotations

import uuid
from decimal import Decimal

from django.conf import settings
from django.db import models


class Order(models.Model):
    class PaymentStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        AUTHORIZED = "authorized", "Authorized"
        PAID = "paid", "Paid"
        FAILED = "failed", "Failed"
        REFUNDED = "refunded", "Refunded"

    class FulfillmentStatus(models.TextChoices):
        UNFULFILLED = "unfulfilled", "Unfulfilled"
        PARTIALLY_FULFILLED = "partially_fulfilled", "Partially Fulfilled"
        FULFILLED = "fulfilled", "Fulfilled"
        CANCELLED = "cancelled", "Cancelled"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order_number = models.CharField(max_length=64, unique=True, db_index=True)
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="orders",
        null=True,
        blank=True,
    )
    customer_email = models.EmailField(max_length=255)
    currency = models.CharField(max_length=3)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    discount_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    tax_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    shipping_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    grand_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    payment_status = models.CharField(
        max_length=32,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING,
        db_index=True,
    )
    fulfillment_status = models.CharField(
        max_length=32,
        choices=FulfillmentStatus.choices,
        default=FulfillmentStatus.UNFULFILLED,
        db_index=True,
    )
    billing_address_snapshot = models.JSONField(default=dict)
    shipping_address_snapshot = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(subtotal__gte=Decimal("0.00")),
                name="order_subtotal_nonnegative",
            ),
            models.CheckConstraint(
                condition=models.Q(discount_total__gte=Decimal("0.00")),
                name="order_discount_total_nonnegative",
            ),
            models.CheckConstraint(
                condition=models.Q(tax_total__gte=Decimal("0.00")),
                name="order_tax_total_nonnegative",
            ),
            models.CheckConstraint(
                condition=models.Q(shipping_total__gte=Decimal("0.00")),
                name="order_shipping_total_nonnegative",
            ),
            models.CheckConstraint(
                condition=models.Q(grand_total__gte=Decimal("0.00")),
                name="order_grand_total_nonnegative",
            ),
        ]

    def __str__(self) -> str:
        return self.order_number


class SellerOrder(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        CONFIRMED = "confirmed", "Confirmed"
        PROCESSING = "processing", "Processing"
        SHIPPED = "shipped", "Shipped"
        DELIVERED = "delivered", "Delivered"
        CANCELLED = "cancelled", "Cancelled"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(
        Order,
        on_delete=models.PROTECT,
        related_name="seller_orders",
    )
    seller = models.ForeignKey(
        "sellers.Seller",
        on_delete=models.PROTECT,
        related_name="orders",
    )
    seller_order_number = models.CharField(max_length=64, unique=True, db_index=True)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    discount_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    tax_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    shipping_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    commission_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    seller_net_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    status = models.CharField(
        max_length=32,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    # Set when payment capture converts the reservation into sale ledger entries.
    inventory_committed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["order", "seller"],
                name="seller_order_unique_per_order",
            ),
            models.CheckConstraint(
                condition=models.Q(subtotal__gte=Decimal("0.00")),
                name="seller_order_subtotal_nonnegative",
            ),
            models.CheckConstraint(
                condition=models.Q(discount_total__gte=Decimal("0.00")),
                name="seller_order_discount_total_nonnegative",
            ),
            models.CheckConstraint(
                condition=models.Q(tax_total__gte=Decimal("0.00")),
                name="seller_order_tax_total_nonnegative",
            ),
            models.CheckConstraint(
                condition=models.Q(shipping_total__gte=Decimal("0.00")),
                name="seller_order_shipping_total_nonnegative",
            ),
            models.CheckConstraint(
                condition=models.Q(commission_total__gte=Decimal("0.00")),
                name="seller_order_commission_total_nonnegative",
            ),
            models.CheckConstraint(
                condition=models.Q(seller_net_total__gte=Decimal("0.00")),
                name="seller_order_seller_net_total_nonnegative",
            ),
        ]

    def __str__(self) -> str:
        return self.seller_order_number


class OrderItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    seller_order = models.ForeignKey(
        SellerOrder,
        on_delete=models.PROTECT,
        related_name="items",
    )
    product = models.ForeignKey(
        "catalog.Product",
        on_delete=models.PROTECT,
        related_name="order_items",
        null=True,
    )
    variant = models.ForeignKey(
        "catalog.ProductVariant",
        on_delete=models.PROTECT,
        related_name="order_items",
        null=True,
    )
    warehouse = models.ForeignKey(
        "inventory.Warehouse",
        on_delete=models.PROTECT,
        related_name="order_items",
        null=True,
    )
    product_name_snapshot = models.CharField(max_length=255)
    sku_snapshot = models.CharField(max_length=64)
    variant_snapshot = models.JSONField(default=dict)
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=14, decimal_places=2)
    discount_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    tax_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    total = models.DecimalField(max_digits=14, decimal_places=2)
    commission_amount = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal("0.00")
    )
    seller_net_amount = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        ordering = ["id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0),
                name="order_item_quantity_positive",
            ),
            models.CheckConstraint(
                condition=models.Q(unit_price__gte=Decimal("0.00")),
                name="order_item_unit_price_nonnegative",
            ),
            models.CheckConstraint(
                condition=models.Q(discount_amount__gte=Decimal("0.00")),
                name="order_item_discount_amount_nonnegative",
            ),
            models.CheckConstraint(
                condition=models.Q(tax_amount__gte=Decimal("0.00")),
                name="order_item_tax_amount_nonnegative",
            ),
            models.CheckConstraint(
                condition=models.Q(total__gte=Decimal("0.00")),
                name="order_item_total_nonnegative",
            ),
            models.CheckConstraint(
                condition=models.Q(commission_amount__gte=Decimal("0.00")),
                name="order_item_commission_amount_nonnegative",
            ),
            models.CheckConstraint(
                condition=models.Q(seller_net_amount__gte=Decimal("0.00")),
                name="order_item_seller_net_amount_nonnegative",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.sku_snapshot} x {self.quantity}"


class OrderStatusHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    seller_order = models.ForeignKey(
        SellerOrder,
        on_delete=models.PROTECT,
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
        return f"{self.seller_order.seller_order_number}: {self.from_status} -> {self.to_status}"
