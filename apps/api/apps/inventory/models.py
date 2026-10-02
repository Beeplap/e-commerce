from uuid import uuid4

from django.conf import settings
from django.db import models
from django.utils import timezone


class Warehouse(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    seller = models.ForeignKey(
        "sellers.Seller", on_delete=models.PROTECT, related_name="warehouses"
    )
    name = models.CharField(max_length=120)
    code = models.SlugField(max_length=50)
    address = models.CharField(max_length=500, blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name", "code"]
        constraints = [
            models.UniqueConstraint(fields=["seller", "code"], name="warehouse_seller_code_unique"),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.code})"


class Inventory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="inventories")
    variant = models.ForeignKey(
        "catalog.ProductVariant", on_delete=models.PROTECT, related_name="inventories"
    )
    quantity_on_hand = models.IntegerField(default=0)
    quantity_reserved = models.IntegerField(default=0)
    reorder_level = models.IntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["warehouse", "variant"], name="inventory_warehouse_variant_unique"
            ),
            models.CheckConstraint(
                condition=models.Q(quantity_on_hand__gte=0), name="inventory_on_hand_nonnegative"
            ),
            models.CheckConstraint(
                condition=models.Q(quantity_reserved__gte=0), name="inventory_reserved_nonnegative"
            ),
            models.CheckConstraint(
                condition=models.Q(reorder_level__gte=0), name="inventory_reorder_level_nonnegative"
            ),
            models.CheckConstraint(
                condition=models.Q(quantity_on_hand__gte=models.F("quantity_reserved")),
                name="inventory_reserved_not_exceed_on_hand",
            ),
        ]

    @property
    def available_quantity(self) -> int:
        return self.quantity_on_hand - self.quantity_reserved

    @property
    def is_low_stock(self) -> bool:
        return self.available_quantity <= self.reorder_level

    def __str__(self) -> str:
        return f"{self.warehouse.code}:{self.variant.sku} ({self.quantity_on_hand})"


class InventoryTransaction(models.Model):
    class Type(models.TextChoices):
        PURCHASE = "purchase", "Purchase"
        SALE = "sale", "Sale"
        RETURN = "return", "Return"
        ADJUSTMENT = "adjustment", "Adjustment"
        RESERVATION = "reservation", "Reservation"
        RELEASE = "release", "Release"

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    inventory = models.ForeignKey(Inventory, on_delete=models.PROTECT, related_name="transactions")
    type = models.CharField(max_length=20, choices=Type.choices)
    quantity_delta = models.IntegerField()
    reference_type = models.CharField(max_length=50, blank=True, default="")
    reference_id = models.CharField(max_length=100, blank=True, default="")
    reason = models.CharField(max_length=500, blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self) -> str:
        return f"{self.inventory_id}: {self.type} {self.quantity_delta:+d} ({self.reason})"
