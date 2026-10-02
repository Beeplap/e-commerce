import uuid

from django.db import models


class OutboxEvent(models.Model):
    """Authoritative transactional outbox record for asynchronous event publishing.

    Guarantees at-least-once delivery for critical domain state changes
    (orders, payouts, settlements).
    """

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        PROCESSING = "PROCESSING", "Processing"
        PROCESSED = "PROCESSED", "Processed"
        FAILED = "FAILED", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    topic = models.CharField(max_length=100, db_index=True)
    event_key = models.CharField(max_length=255, db_index=True)
    payload = models.JSONField()
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    retry_count = models.PositiveIntegerField(default=0)
    max_retries = models.PositiveIntegerField(default=5)
    last_error = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "events_outbox"
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["status", "created_at"], name="outbox_status_created_idx"),
            models.Index(fields=["topic", "event_key"], name="outbox_topic_key_idx"),
        ]

    def __str__(self) -> str:
        return f"OutboxEvent({self.topic}, {self.event_key}, {self.status})"
