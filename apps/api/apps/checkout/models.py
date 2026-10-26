from __future__ import annotations

import uuid
from typing import Any

from django.conf import settings
from django.db import models, transaction


class CheckoutAttempt(models.Model):
    """Successful placement replay evidence, accessible only through its owned cart."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cart = models.ForeignKey(
        "cart.Cart", on_delete=models.CASCADE, related_name="checkout_attempts"
    )
    order = models.ForeignKey(
        "orders.Order", on_delete=models.PROTECT, related_name="checkout_attempts"
    )
    key = models.CharField(max_length=128)
    request_digest = models.CharField(max_length=64)
    response = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["cart", "key"], name="checkout_attempt_cart_key_unique"
            ),
        ]


class CustomerAddress(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="customer_addresses",
    )
    full_name = models.CharField(max_length=120)
    phone = models.CharField(max_length=32)
    line1 = models.CharField(max_length=255)
    line2 = models.CharField(max_length=255, blank=True, default="")
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=32)
    country = models.CharField(max_length=2, default="US")
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-is_default", "-created_at"]

    def __str__(self) -> str:
        return f"{self.full_name}, {self.line1}, {self.city}"

    def save(self, *args: Any, **kwargs: Any) -> None:
        if self.is_default:
            with transaction.atomic():
                CustomerAddress.objects.filter(user=self.user, is_default=True).exclude(
                    pk=self.pk
                ).update(is_default=False)
                super().save(*args, **kwargs)
        else:
            # If this is the user's only address, make it default automatically
            if not CustomerAddress.objects.filter(user=self.user).exclude(pk=self.pk).exists():
                self.is_default = True
            super().save(*args, **kwargs)
