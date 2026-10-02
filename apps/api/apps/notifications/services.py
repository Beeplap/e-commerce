import logging
from typing import Any
from uuid import UUID

from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.notifications.models import Notification, NotificationDelivery
from apps.sellers.models import Seller

logger = logging.getLogger(__name__)


def send_notification(
    *,
    recipient: User,
    type: str,
    title: str,
    message: str,
    seller: Seller | None = None,
    data: dict[str, Any] | None = None,
    channels: tuple[str, ...] = ("in_app", "email"),
) -> Notification:
    """
    Creates notification and attempts delivery across specified channels.
    Failures in delivery channels (e.g. Email/SMS) NEVER roll back the business transaction.
    """
    now = timezone.now()
    notification = Notification.objects.create(
        recipient=recipient,
        seller=seller,
        type=type,
        title=title.strip(),
        message=message.strip(),
        data=data or {},
    )

    # In-app delivery is immediate and persistent
    if "in_app" in channels:
        NotificationDelivery.objects.create(
            notification=notification,
            channel=NotificationDelivery.Channel.IN_APP,
            status=NotificationDelivery.Status.SENT,
            sent_at=now,
        )

    # Email delivery with isolated failure handling
    if "email" in channels:
        try:
            # Simulate or dispatch email safely
            if recipient.email:
                send_mail(
                    subject=title,
                    message=message,
                    from_email=None,
                    recipient_list=[recipient.email],
                    fail_silently=False,
                )
            NotificationDelivery.objects.create(
                notification=notification,
                channel=NotificationDelivery.Channel.EMAIL,
                status=NotificationDelivery.Status.SENT,
                sent_at=timezone.now(),
            )
        except Exception as exc:
            # Record failure in delivery ledger without failing the transaction
            logger.warning(
                "Failed to send email notification to %s: %s",
                recipient.email,
                exc,
                exc_info=True,
            )
            NotificationDelivery.objects.create(
                notification=notification,
                channel=NotificationDelivery.Channel.EMAIL,
                status=NotificationDelivery.Status.FAILED,
                error_message=str(exc),
            )

    return notification


@transaction.atomic
def mark_notification_read(*, notification_id: UUID, user: User) -> Notification | None:
    notification = Notification.objects.filter(pk=notification_id, recipient=user).first()
    if notification and notification.read_at is None:
        notification.read_at = timezone.now()
        notification.save(update_fields=["read_at"])
    return notification


@transaction.atomic
def mark_all_notifications_read(*, user: User) -> int:
    return Notification.objects.filter(recipient=user, read_at__isnull=True).update(
        read_at=timezone.now()
    )
