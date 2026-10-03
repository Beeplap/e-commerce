from __future__ import annotations

from uuid import uuid4

from django.conf import settings
from django.db import models
from django.utils import timezone


class Cart(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="carts",
    )
    session_key = models.CharField(max_length=40, null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(user__isnull=False) | models.Q(session_key__isnull=False),
                name="cart_user_or_session_required",
            ),
            models.UniqueConstraint(
                fields=["user"],
                condition=models.Q(user__isnull=False),
                name="cart_unique_active_user",
            ),
            models.UniqueConstraint(
                fields=["session_key"],
                condition=models.Q(session_key__isnull=False),
                name="cart_unique_active_session",
            ),
        ]

    def __str__(self) -> str:
        owner = f"user:{self.user_id}" if self.user_id else f"session:{self.session_key}"
        return f"Cart {self.id} ({owner})"


class CartItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name="items")
    variant = models.ForeignKey(
        "catalog.ProductVariant", on_delete=models.PROTECT, related_name="cart_items"
    )
    quantity = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["cart", "variant"], name="cart_item_cart_variant_unique"
            ),
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0), name="cart_item_quantity_positive"
            ),
        ]

    def __str__(self) -> str:
        return f"CartItem {self.id} (variant:{self.variant_id} x {self.quantity})"
