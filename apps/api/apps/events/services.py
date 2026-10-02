import logging
import uuid
from datetime import timedelta
from typing import Any

from django.db import models, transaction
from django.utils import timezone

from apps.events.models import OutboxEvent

logger = logging.getLogger("apps.events")


def publish_outbox_event(
    topic: str,
    event_key: str,
    payload: dict[str, Any],
    max_retries: int = 5,
    trigger_async: bool = True,
) -> OutboxEvent:
    """Publishes a domain event into the transactional outbox table within current transaction."""
    event = OutboxEvent.objects.create(
        topic=topic,
        event_key=event_key,
        payload=payload,
        max_retries=max_retries,
        status=OutboxEvent.Status.PENDING,
    )

    if trigger_async:
        # Enqueue processing only after the enclosing database transaction has committed
        def enqueue() -> None:
            try:
                from apps.events.tasks import trigger_outbox_processing

                trigger_outbox_processing.delay()
            except Exception as exc:
                logger.warning("Failed to enqueue immediate outbox processing task: %s", exc)

        transaction.on_commit(enqueue)

    return event


def dispatch_event(topic: str, event_key: str, payload: dict[str, Any]) -> None:
    """Dispatches the event to appropriate domain subscribers or external sinks."""
    # Simulation / dispatch hook for domain subscribers
    logger.info(
        "Dispatched outbox event topic=%s key=%s",
        topic,
        event_key,
        extra={"topic": topic, "event_key": event_key},
    )


def process_outbox_event(event_id: uuid.UUID) -> bool:
    """Processes a single outbox event with row-level locking and idempotency."""
    with transaction.atomic():
        event = OutboxEvent.objects.select_for_update(skip_locked=True).filter(id=event_id).first()
        if not event:
            return False

        if event.status == OutboxEvent.Status.PROCESSED:
            return True

        event.status = OutboxEvent.Status.PROCESSING
        event.save(update_fields=["status"])

    # Perform actual dispatch outside row lock
    try:
        dispatch_event(event.topic, event.event_key, event.payload)
        with transaction.atomic():
            event = OutboxEvent.objects.select_for_update().get(id=event_id)
            event.status = OutboxEvent.Status.PROCESSED
            event.processed_at = timezone.now()
            event.last_error = ""
            event.save(update_fields=["status", "processed_at", "last_error"])
        return True
    except Exception as exc:
        logger.error(
            "Error processing outbox event %s: %s",
            event_id,
            exc,
            exc_info=True,
            extra={"event_id": str(event_id), "topic": event.topic},
        )
        with transaction.atomic():
            event = OutboxEvent.objects.select_for_update().get(id=event_id)
            event.retry_count += 1
            event.last_error = str(exc)[:1000]
            if event.retry_count >= event.max_retries:
                event.status = OutboxEvent.Status.FAILED
            else:
                event.status = OutboxEvent.Status.PENDING
            event.save(update_fields=["status", "retry_count", "last_error"])
        return False


def process_pending_outbox_batch(batch_size: int = 50) -> int:
    """Processes a batch of pending outbox events or events stuck in PROCESSING."""
    stale_cutoff = timezone.now() - timedelta(minutes=15)
    candidates = list(
        OutboxEvent.objects.filter(
            models.Q(status=OutboxEvent.Status.PENDING)
            | models.Q(status=OutboxEvent.Status.PROCESSING, created_at__lt=stale_cutoff)
        )
        .order_by("created_at")
        .values_list("id", flat=True)[:batch_size]
    )

    processed_count = 0
    for event_id in candidates:
        if process_outbox_event(event_id):
            processed_count += 1

    return processed_count
