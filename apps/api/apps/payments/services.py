from __future__ import annotations

import hashlib
import hmac
import json
import re
import uuid
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any, Protocol
from uuid import UUID

from django.conf import settings
from django.db import transaction
from django.db.models import QuerySet
from django.http import HttpRequest
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import APIException, ValidationError

from apps.events.services import publish_outbox_event
from apps.finance.services import settle_seller_order
from apps.inventory.models import Inventory
from apps.inventory.services import consume_order_inventory, release_order_inventory
from apps.orders.models import Order, OrderItem, OrderStatusHistory, SellerOrder
from apps.payments.models import Payment, PaymentTransaction

GUEST_ORDER_SESSION_KEY = "guest_order_ids"
MAX_REMEMBERED_GUEST_ORDERS = 20
IDEMPOTENCY_KEY_PATTERN = re.compile(r"^[A-Za-z0-9_-]{16,128}$")
PAYMENT_TOKEN_PATTERN = re.compile(r"^tok_[A-Za-z0-9_]{1,60}$")
WEBHOOK_EVENT_ID_PATTERN = re.compile(r"^[A-Za-z0-9_.:-]{1,128}$")


class PaymentConflict(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "This payment request conflicts with an existing payment."
    default_code = "payment_conflict"


class PaymentGatewayUnavailable(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "The payment gateway is not available."
    default_code = "payment_gateway_unavailable"


# --------------------------------------------------------------------------------------
# Ownership: customers resolve their own orders; guests only orders placed in this session.
# --------------------------------------------------------------------------------------


def remember_guest_order(request: HttpRequest, order_id: UUID) -> None:
    """Bind a guest order to the server-side session so only that browser can pay for it."""
    remembered = [
        value
        for value in request.session.get(GUEST_ORDER_SESSION_KEY, [])
        if isinstance(value, str) and value != str(order_id)
    ]
    remembered.append(str(order_id))
    request.session[GUEST_ORDER_SESSION_KEY] = remembered[-MAX_REMEMBERED_GUEST_ORDERS:]
    request.session.modified = True


def payable_orders_for(request: HttpRequest) -> QuerySet[Order]:
    user = getattr(request, "user", None)
    if user is not None and user.is_authenticated:
        return Order.objects.filter(customer=user)
    remembered: list[UUID] = []
    for value in request.session.get(GUEST_ORDER_SESSION_KEY, []):
        try:
            remembered.append(UUID(str(value)))
        except ValueError:
            continue
    return Order.objects.filter(customer__isnull=True, pk__in=remembered)


# --------------------------------------------------------------------------------------
# Gateway abstraction
# --------------------------------------------------------------------------------------


@dataclass(frozen=True)
class GatewayResult:
    success: bool
    reference: str = ""
    error_code: str = ""
    error_message: str = ""


class PaymentGateway(Protocol):
    name: str

    def charge(self, *, payment: Payment, token: str) -> GatewayResult: ...


class MockPaymentGateway:
    """Deterministic development gateway. Disabled in production settings.

    Card data never reaches the backend: the browser submits an opaque token. Tokens
    ending in ``_0002`` or equal to ``tok_chargeDeclined`` simulate an issuer decline.
    """

    name = "mock"
    DECLINE_TOKENS = frozenset({"tok_chargeDeclined", "tok_mock_declined"})

    def charge(self, *, payment: Payment, token: str) -> GatewayResult:
        if token in self.DECLINE_TOKENS or token.endswith("_0002"):
            return GatewayResult(
                success=False,
                error_code="card_declined",
                error_message="The card was declined by the issuing bank.",
            )
        return GatewayResult(success=True, reference=f"mock_ch_{uuid.uuid4().hex[:24]}")


SUPPORTED_PROVIDERS = ("mock",)


def get_gateway(provider: str) -> PaymentGateway:
    if provider == "mock":
        if not getattr(settings, "PAYMENT_MOCK_GATEWAY_ENABLED", False):
            raise PaymentGatewayUnavailable()
        return MockPaymentGateway()
    raise PaymentGatewayUnavailable()


# --------------------------------------------------------------------------------------
# Validation helpers
# --------------------------------------------------------------------------------------


def _clean_idempotency_key(value: str) -> str:
    key = (value or "").strip()
    if not IDEMPOTENCY_KEY_PATTERN.fullmatch(key):
        raise ValidationError(
            {"idempotency_key": "Provide a 16-128 character key using letters, digits, - or _."}
        )
    return key


def _lock_order_inventory(order: Order) -> dict[tuple[UUID, UUID], Inventory]:
    """Lock every inventory row touched by the order in (variant, pk) order."""
    items = list(
        OrderItem.objects.filter(seller_order__order=order).values_list(
            "warehouse_id", "variant_id"
        )
    )
    pairs = {(w, v) for w, v in items if w is not None and v is not None}
    if not pairs:
        return {}
    variant_ids = {v for _, v in pairs}
    warehouse_ids = {w for w, _ in pairs}
    rows = (
        Inventory.objects.select_for_update()
        .filter(variant_id__in=variant_ids, warehouse_id__in=warehouse_ids)
        .order_by("variant_id", "pk")
    )
    locked = {(row.warehouse_id, row.variant_id): row for row in rows}
    missing = pairs - locked.keys()
    if missing:
        raise ValidationError({"inventory": "Inventory records for this order are missing."})
    return locked


def _actor_id(actor: Any) -> UUID | None:
    if actor is not None and getattr(actor, "is_authenticated", False):
        return UUID(str(actor.pk))
    return None


# --------------------------------------------------------------------------------------
# Payment intent
# --------------------------------------------------------------------------------------


@transaction.atomic
def create_payment_intent(
    *,
    orders: QuerySet[Order],
    order_id: UUID,
    idempotency_key: str,
    provider: str = "mock",
) -> tuple[Payment, bool]:
    """Create (or idempotently return) the single active payment for an owned order."""
    key = _clean_idempotency_key(idempotency_key)
    get_gateway(provider)  # fail closed before touching state

    order = get_object_or_404(orders.select_for_update(), pk=order_id)

    existing = Payment.objects.select_for_update().filter(idempotency_key=key).first()
    if existing is not None:
        if existing.order_id != order.pk:
            raise PaymentConflict("This idempotency key was already used for another payment.")
        return existing, False

    if order.payment_status in (Order.PaymentStatus.PAID, Order.PaymentStatus.REFUNDED):
        raise PaymentConflict("This order has already been paid.")
    if (
        order.payment_status == Order.PaymentStatus.FAILED
        or order.fulfillment_status == Order.FulfillmentStatus.CANCELLED
    ):
        raise PaymentConflict("This order was cancelled. Please place a new order.")

    active = (
        Payment.objects.select_for_update()
        .filter(order=order, status__in=Payment.ACTIVE_STATUSES)
        .first()
    )
    if active is not None:
        if active.status == Payment.Status.CAPTURED:
            raise PaymentConflict("This order has already been paid.")
        # Another attempt is already in flight for this order; never open a second charge.
        raise PaymentConflict("A payment for this order is already in progress.")

    payment = Payment.objects.create(
        order=order,
        amount=order.grand_total,
        currency=order.currency,
        status=Payment.Status.PENDING,
        provider=provider,
        idempotency_key=key,
    )
    PaymentTransaction.objects.create(
        payment=payment,
        transaction_type=PaymentTransaction.Type.INTENT_CREATED,
        amount=payment.amount,
        currency=payment.currency,
        success=True,
        details={"order_number": order.order_number},
    )
    return payment, True


# --------------------------------------------------------------------------------------
# Capture / failure state transitions (called with Order and Payment rows locked)
# --------------------------------------------------------------------------------------


def _capture(*, order: Order, payment: Payment, reference: str, actor: Any, source: str) -> None:
    inventory = _lock_order_inventory(order)
    seller_orders = list(order.seller_orders.select_for_update().order_by("pk"))

    payment.status = Payment.Status.CAPTURED
    payment.reference_id = reference[:128]
    payment.error_code = ""
    payment.error_message = ""
    payment.save(
        update_fields=["status", "reference_id", "error_code", "error_message", "updated_at"]
    )
    PaymentTransaction.objects.create(
        payment=payment,
        transaction_type=PaymentTransaction.Type.CAPTURED,
        gateway_reference=payment.reference_id,
        amount=payment.amount,
        currency=payment.currency,
        success=True,
        details={"source": source},
    )

    order.payment_status = Order.PaymentStatus.PAID
    order.save(update_fields=["payment_status", "updated_at"])

    for seller_order in seller_orders:
        old_status = seller_order.status
        seller_order.status = SellerOrder.Status.CONFIRMED
        seller_order.inventory_committed = True
        seller_order.save(update_fields=["status", "inventory_committed", "updated_at"])
        OrderStatusHistory.objects.create(
            seller_order=seller_order,
            actor_id=_actor_id(actor),
            from_status=old_status,
            to_status=SellerOrder.Status.CONFIRMED,
            notes="Payment captured; reserved stock converted to sale.",
        )
        for item in seller_order.items.all():
            if item.warehouse_id is None or item.variant_id is None:
                continue
            consume_order_inventory(
                inventory_id=inventory[(item.warehouse_id, item.variant_id)].pk,
                quantity=item.quantity,
                reference_id=str(seller_order.pk),
                reason=f"Payment captured for {seller_order.seller_order_number}",
                actor=actor,
            )
        settle_seller_order(seller_order)

    publish_outbox_event(
        topic="payments.payment.captured",
        event_key=str(payment.pk),
        payload={
            "payment_id": str(payment.pk),
            "order_id": str(order.pk),
            "order_number": order.order_number,
            "amount": str(payment.amount),
            "currency": payment.currency,
        },
    )


def _fail(
    *,
    order: Order,
    payment: Payment,
    error_code: str,
    error_message: str,
    actor: Any,
    source: str,
) -> None:
    inventory = _lock_order_inventory(order)
    seller_orders = list(order.seller_orders.select_for_update().order_by("pk"))

    payment.status = Payment.Status.FAILED
    payment.error_code = error_code[:64]
    payment.error_message = error_message[:255]
    payment.save(update_fields=["status", "error_code", "error_message", "updated_at"])
    PaymentTransaction.objects.create(
        payment=payment,
        transaction_type=PaymentTransaction.Type.FAILED,
        amount=payment.amount,
        currency=payment.currency,
        success=False,
        error_code=payment.error_code,
        error_message=payment.error_message,
        details={"source": source},
    )

    order.payment_status = Order.PaymentStatus.FAILED
    order.fulfillment_status = Order.FulfillmentStatus.CANCELLED
    order.save(update_fields=["payment_status", "fulfillment_status", "updated_at"])

    for seller_order in seller_orders:
        if seller_order.status != SellerOrder.Status.PENDING:
            continue  # already cancelled by the seller; its reservation was released then
        seller_order.status = SellerOrder.Status.CANCELLED
        seller_order.save(update_fields=["status", "updated_at"])
        OrderStatusHistory.objects.create(
            seller_order=seller_order,
            actor_id=_actor_id(actor),
            from_status=SellerOrder.Status.PENDING,
            to_status=SellerOrder.Status.CANCELLED,
            notes="Payment failed; order cancelled and reserved stock released.",
        )
        for item in seller_order.items.all():
            if item.warehouse_id is None or item.variant_id is None:
                continue
            release_order_inventory(
                inventory_id=inventory[(item.warehouse_id, item.variant_id)].pk,
                quantity=item.quantity,
                reference_id=str(seller_order.pk),
                reason=f"Payment failed for {seller_order.seller_order_number}",
                actor=actor,
            )

    publish_outbox_event(
        topic="payments.payment.failed",
        event_key=str(payment.pk),
        payload={
            "payment_id": str(payment.pk),
            "order_id": str(order.pk),
            "order_number": order.order_number,
            "error_code": payment.error_code,
        },
    )


def _lock_payment_and_order(payment_id: UUID) -> tuple[Order, Payment]:
    """Lock Order before Payment (the same order create_payment_intent uses)."""
    order_id = get_object_or_404(Payment.objects.only("order_id"), pk=payment_id).order_id
    order = Order.objects.select_for_update().get(pk=order_id)
    payment = Payment.objects.select_for_update().get(pk=payment_id)
    return order, payment


# --------------------------------------------------------------------------------------
# Client confirmation (development mock gateway)
# --------------------------------------------------------------------------------------


@transaction.atomic
def confirm_payment(
    *,
    orders: QuerySet[Order],
    payment_id: UUID,
    idempotency_key: str,
    payment_token: str,
    actor: Any = None,
) -> Payment:
    key = _clean_idempotency_key(idempotency_key)
    token = (payment_token or "").strip()
    if not PAYMENT_TOKEN_PATTERN.fullmatch(token):
        raise ValidationError({"payment_token": "A valid payment token is required."})

    # Ownership check before any lock: other customers' payments are indistinguishable from 404.
    get_object_or_404(Payment.objects.filter(order__in=orders), pk=payment_id)
    order, payment = _lock_payment_and_order(payment_id)

    if payment.idempotency_key != key:
        raise PaymentConflict("The idempotency key does not match this payment.")

    # Idempotent replay: the same attempt returns its recorded outcome without re-charging.
    if payment.status in (Payment.Status.CAPTURED, Payment.Status.FAILED, Payment.Status.REFUNDED):
        return payment

    gateway = get_gateway(payment.provider)

    if order.payment_status != Order.PaymentStatus.PENDING:
        raise PaymentConflict("This order is no longer awaiting payment.")
    if order.seller_orders.exclude(status=SellerOrder.Status.PENDING).exists():
        raise PaymentConflict("Part of this order changed before payment. Please contact support.")
    if payment.amount != order.grand_total or payment.currency != order.currency:
        raise PaymentConflict("The order total changed after the payment was created.")

    result = gateway.charge(payment=payment, token=token)
    if result.success:
        _capture(
            order=order,
            payment=payment,
            reference=result.reference,
            actor=actor,
            source="client_confirmation",
        )
    else:
        _fail(
            order=order,
            payment=payment,
            error_code=result.error_code or "payment_failed",
            error_message=result.error_message or "The payment could not be completed.",
            actor=actor,
            source="client_confirmation",
        )
    payment.refresh_from_db()
    return payment


# --------------------------------------------------------------------------------------
# Signed gateway webhooks
# --------------------------------------------------------------------------------------


def verify_webhook_signature(*, payload: bytes, signature: str) -> bool:
    secret = getattr(settings, "PAYMENT_WEBHOOK_SECRET", "")
    if not secret:
        return False  # fail closed when signing is not configured
    provided = signature.strip()
    if provided.startswith("sha256="):
        provided = provided[len("sha256=") :]
    expected = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, provided.lower())


def _parse_webhook(payload: bytes) -> dict[str, Any]:
    try:
        data = json.loads(payload.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValidationError({"payload": "Webhook body must be valid JSON."}) from exc
    if not isinstance(data, dict) or not isinstance(data.get("data"), dict):
        raise ValidationError({"payload": "Webhook body has an unexpected shape."})
    event_id = data.get("id")
    if not isinstance(event_id, str) or not WEBHOOK_EVENT_ID_PATTERN.fullmatch(event_id):
        raise ValidationError({"id": "Webhook event id is missing or invalid."})
    if not isinstance(data.get("type"), str):
        raise ValidationError({"type": "Webhook event type is missing."})
    return data


SUCCEEDED_EVENTS = frozenset({"payment_intent.succeeded", "payment.captured"})
FAILED_EVENTS = frozenset({"payment_intent.payment_failed", "payment.failed"})


@transaction.atomic
def handle_payment_webhook(*, payload: bytes, signature: str) -> dict[str, str]:
    if not signature or not verify_webhook_signature(payload=payload, signature=signature):
        raise ValidationError({"signature": "Invalid webhook signature."})

    data = _parse_webhook(payload)
    event_id: str = data["id"]
    event_type: str = data["type"]
    if event_type not in SUCCEEDED_EVENTS | FAILED_EVENTS:
        return {"status": "ignored"}

    body: dict[str, Any] = data["data"]
    try:
        payment_id = UUID(str(body.get("payment_id")))
        amount = Decimal(str(body.get("amount")))
    except (ValueError, InvalidOperation) as exc:
        raise ValidationError({"data": "Webhook payment reference is invalid."}) from exc
    currency = str(body.get("currency", "")).upper()
    gateway_reference = str(body.get("gateway_reference", ""))[:128]

    if not Payment.objects.filter(pk=payment_id).exists():
        raise ValidationError({"data": "Unknown payment."})
    order, payment = _lock_payment_and_order(payment_id)

    if PaymentTransaction.objects.filter(
        transaction_type=PaymentTransaction.Type.WEBHOOK_RECEIVED,
        gateway_reference=event_id,
    ).exists():
        return {"status": "duplicate"}

    if amount != payment.amount or currency != payment.currency:
        raise ValidationError({"data": "Webhook amount or currency does not match the payment."})

    PaymentTransaction.objects.create(
        payment=payment,
        transaction_type=PaymentTransaction.Type.WEBHOOK_RECEIVED,
        gateway_reference=event_id,
        amount=amount,
        currency=currency,
        success=event_type in SUCCEEDED_EVENTS,
        details={"event_type": event_type},
    )

    pending = payment.status in (Payment.Status.PENDING, Payment.Status.AUTHORIZED)
    if event_type in SUCCEEDED_EVENTS:
        if payment.status == Payment.Status.CAPTURED:
            return {"status": "already_captured"}
        if not pending or order.seller_orders.exclude(status=SellerOrder.Status.PENDING).exists():
            # Funds captured externally for an order we can no longer fulfil: never silently
            # resurrect it. The webhook transaction above is the operator review trail.
            return {"status": "requires_review"}
        _capture(
            order=order,
            payment=payment,
            reference=gateway_reference or event_id,
            actor=None,
            source="webhook",
        )
        return {"status": "captured"}

    if not pending:
        return {"status": "ignored"}
    _fail(
        order=order,
        payment=payment,
        error_code="payment_failed",
        error_message="The payment gateway reported a failed payment.",
        actor=None,
        source="webhook",
    )
    return {"status": "failed"}
