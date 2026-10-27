from __future__ import annotations

from typing import Any
from uuid import UUID

from django.db import transaction
from django.db.models import QuerySet
from django.shortcuts import get_object_or_404

from apps.orders.models import Order
from apps.payments.models import Payment


@transaction.atomic
def order_payment_state(*, orders: QuerySet[Order], order_id: UUID) -> dict[str, Any]:
    """Read bounded recovery evidence only after resolving session/customer ownership.

    Holding Order while reading its payment gives a coherent snapshot against intent,
    confirmation and webhook commands. This read never acquires Seller/child locks or
    calls a gateway, so it cannot reverse the mutation lock order.
    """
    order = get_object_or_404(orders.select_for_update(), pk=order_id)
    payment = Payment.objects.filter(order=order).order_by("-created_at", "-pk").first()
    if payment is not None:
        payment.order = order
    resumable = (
        payment is not None
        and payment.status == Payment.Status.PENDING
        and order.payment_status == Order.PaymentStatus.PENDING
        and order.fulfillment_status != Order.FulfillmentStatus.CANCELLED
    )
    return {
        "order_id": order.pk,
        "order_number": order.order_number,
        "grand_total": order.grand_total,
        "currency": order.currency,
        "payment_status": order.payment_status,
        "fulfillment_status": order.fulfillment_status,
        "payment": payment,
        # A replay identifier, never authorization: every confirmation rechecks ownership.
        "resume_key": payment.idempotency_key if payment is not None and resumable else None,
    }
