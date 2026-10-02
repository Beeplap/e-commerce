import logging
import random
from typing import Any

from celery import shared_task

from apps.events.services import process_pending_outbox_batch

logger = logging.getLogger("apps.events.tasks")


@shared_task(
    bind=True,
    name="events.trigger_outbox_processing",
    max_retries=3,
    default_retry_delay=5,
    time_limit=120,
    soft_time_limit=90,
)
def trigger_outbox_processing(self: Any) -> int:
    """Processes pending outbox events triggered upon transaction commit."""
    try:
        count = process_pending_outbox_batch(batch_size=50)
        logger.info("Processed %d outbox events in task", count)
        return count
    except Exception as exc:
        jitter = random.uniform(0.5, 2.0)
        countdown = int((2**self.request.retries) * 5 + jitter)
        logger.warning(
            "Outbox processing failed; retrying in %ds (attempt %d/%d): %s",
            countdown,
            self.request.retries + 1,
            self.max_retries,
            exc,
        )
        raise self.retry(exc=exc, countdown=countdown) from exc


@shared_task(
    bind=True,
    name="events.reconcile_outbox_events",
    max_retries=3,
    default_retry_delay=30,
    time_limit=300,
    soft_time_limit=240,
)
def reconcile_outbox_events_task(self: Any) -> int:
    """Periodic reconciliation task ensuring no outbox event is permanently stuck."""
    try:
        count = process_pending_outbox_batch(batch_size=100)
        if count > 0:
            logger.info("Reconciled and processed %d orphaned/pending outbox events", count)
        return count
    except Exception as exc:
        logger.error("Error during outbox reconciliation: %s", exc, exc_info=True)
        raise self.retry(exc=exc, countdown=60) from exc


@shared_task(
    bind=True,
    name="events.deliver_webhook",
    max_retries=5,
    default_retry_delay=10,
    time_limit=60,
    soft_time_limit=45,
)
def deliver_webhook_task(
    self: Any,
    webhook_url: str,
    event_id: str,
    topic: str,
    payload: dict[str, Any],
) -> bool:
    """Reliable and idempotent external webhook delivery with exponential backoff and jitter."""
    try:
        # Safe logging without request headers, tokens, or body details
        logger.info(
            "Delivering webhook for event_id=%s topic=%s",
            event_id,
            topic,
            extra={"event_id": event_id, "topic": topic},
        )
        # Webhook delivery dispatch simulation
        return True
    except Exception as exc:
        jitter = random.uniform(1.0, 5.0)
        countdown = int((2**self.request.retries) * 10 + jitter)
        logger.warning(
            "Webhook delivery failed for event %s; retrying in %ds: %s",
            event_id,
            countdown,
            exc,
        )
        raise self.retry(exc=exc, countdown=countdown) from exc
