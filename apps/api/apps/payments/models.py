from __future__ import annotations

import uuid
from decimal import Decimal

from django.db import models


class Payment(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        AUTHORIZED = "authorized", "Authorized"
        CAPTURED = "captured", "Captured"
        FAILED = "failed", "Failed"
        REFUNDED = "refunded", "Refunded"

    ACTIVE_STATUSES = (Status.PENDING, Status.AUTHORIZED, Status.CAPTURED)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(
        "orders.Order",
        on_delete=models.PROTECT,
        related_name="payments",
    )
    # Amount and currency are snapshotted from the order when the intent is created.
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=3)
    status = models.CharField(
        max_length=32,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    provider = models.CharField(max_length=32, default="mock")
    reference_id = models.CharField(max_length=128, blank=True, default="", db_index=True)
    idempotency_key = models.CharField(max_length=128, unique=True)
    error_code = models.CharField(max_length=64, blank=True, default="")
    error_message = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gte=Decimal("0.00")),
                name="payment_amount_nonnegative",
            ),
            # At most one pending/authorized/captured payment per order prevents double charging.
            models.UniqueConstraint(
                fields=["order"],
                condition=models.Q(status__in=["pending", "authorized", "captured"]),
                name="payment_one_active_per_order",
            ),
        ]

    def __str__(self) -> str:
        return f"Payment {self.id} ({self.status})"


class PaymentTransaction(models.Model):
    """Append-only record of gateway interactions (enforced by a PostgreSQL trigger)."""

    class Type(models.TextChoices):
        INTENT_CREATED = "intent_created", "Intent Created"
        AUTHORIZED = "authorized", "Authorized"
        CAPTURED = "captured", "Captured"
        FAILED = "failed", "Failed"
        REFUNDED = "refunded", "Refunded"
        WEBHOOK_RECEIVED = "webhook_received", "Webhook Received"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payment = models.ForeignKey(
        Payment,
        on_delete=models.PROTECT,
        related_name="transactions",
    )
    transaction_type = models.CharField(
        max_length=32,
        choices=Type.choices,
        db_index=True,
    )
    gateway_reference = models.CharField(max_length=128, blank=True, default="")
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=3)
    success = models.BooleanField(default=True)
    error_code = models.CharField(max_length=64, blank=True, default="")
    error_message = models.CharField(max_length=255, blank=True, default="")
    # Safe, non-sensitive metadata only. Never card data, secrets or raw webhook bodies.
    details = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            # A signed gateway event is processed at most once.
            models.UniqueConstraint(
                fields=["gateway_reference"],
                condition=models.Q(transaction_type="webhook_received"),
                name="payment_txn_unique_webhook_event",
            ),
        ]

    def __str__(self) -> str:
        return f"PaymentTransaction {self.transaction_type} for {self.payment_id}"
