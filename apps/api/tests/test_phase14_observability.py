import json
import logging
import uuid
from decimal import Decimal
from unittest.mock import patch

import pytest
from django.db import DatabaseError, connection
from django.test.client import RequestFactory
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.catalog.models import Category, Product, ProductVariant
from apps.events.models import OutboxEvent
from apps.events.services import (
    process_outbox_event,
    process_pending_outbox_batch,
    publish_outbox_event,
)
from apps.events.tasks import (
    deliver_webhook_task,
    reconcile_outbox_events_task,
    trigger_outbox_processing,
)
from apps.inventory.models import Inventory, Warehouse
from apps.orders.models import SellerOrder
from apps.orders.services import confirm_seller_order, create_order
from apps.sellers.models import Seller, SellerMembership, SellerRole
from config.exceptions import custom_exception_handler
from config.logging import (
    StructuredJsonFormatter,
    redact_secrets,
)
from config.monitoring import capture_exception, capture_message, init_error_monitoring

pytestmark = pytest.mark.django_db


# ==============================================================================
# 1. Structured Logging & Request Correlation Tests
# ==============================================================================


def test_request_id_generated_and_propagated() -> None:
    client = APIClient()
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert "X-Request-ID" in response
    req_id = response["X-Request-ID"]
    # Must be valid UUID
    parsed = uuid.UUID(req_id)
    assert str(parsed) == req_id


def test_client_request_id_preserved_when_valid_uuid() -> None:
    client = APIClient()
    custom_uuid = str(uuid.uuid4())
    response = client.get("/api/v1/health", HTTP_X_REQUEST_ID=custom_uuid)
    assert response.status_code == 200
    assert response["X-Request-ID"] == custom_uuid


def test_malformed_client_request_id_replaced_with_valid_uuid() -> None:
    client = APIClient()
    malformed_id = "../../malicious/injection/attempt"
    response = client.get("/api/v1/health", HTTP_X_REQUEST_ID=malformed_id)
    assert response.status_code == 200
    assert response["X-Request-ID"] != malformed_id
    # Generated replacement must be a valid UUID
    uuid.UUID(response["X-Request-ID"])


def test_structured_json_formatter_formatting_and_redaction() -> None:
    formatter = StructuredJsonFormatter()
    record = logging.LogRecord(
        name="test_logger",
        level=logging.INFO,
        pathname="test.py",
        lineno=10,
        msg='User login attempted with password="superSecretPassword123" and token="abc"',
        args=(),
        exc_info=None,
    )
    req_id = str(uuid.uuid4())
    usr_id = str(uuid.uuid4())
    sel_id = str(uuid.uuid4())
    record.request_id = req_id
    record.user_id = usr_id
    record.seller_id = sel_id
    record.route = "/api/v1/auth/login"
    record.method = "POST"
    record.status = 200
    record.latency_ms = 45.2
    record.ip = "127.0.0.1"

    formatted_str = formatter.format(record)
    parsed = json.loads(formatted_str)

    assert parsed["level"] == "INFO"
    assert parsed["logger"] == "test_logger"
    assert parsed["request_id"] == req_id
    assert parsed["user_id"] == usr_id
    assert parsed["seller_id"] == sel_id
    assert parsed["route"] == "/api/v1/auth/login"
    assert parsed["method"] == "POST"
    assert parsed["status"] == 200
    assert parsed["latency_ms"] == 45.2
    assert parsed["ip"] == "127.0.0.1"

    # Verify secret redaction
    assert "superSecretPassword123" not in parsed["message"]
    assert "[REDACTED]" in parsed["message"]


def test_redact_secrets_patterns() -> None:
    raw = 'user sessionid="sess_12345" csrftoken="csrf_abcdef" authorization="Bearer secret_token"'
    redacted = redact_secrets(raw)
    assert "sess_12345" not in redacted
    assert "csrf_abcdef" not in redacted
    assert "secret_token" not in redacted
    assert "[REDACTED]" in redacted


# ==============================================================================
# 2. Error Monitoring Abstraction & Exception Handler Tests
# ==============================================================================


def test_capture_exception_and_message() -> None:
    try:
        raise ValueError("Critical test exception")
    except ValueError as exc:
        event_id = capture_exception(exc, context={"context_key": "val"})
        assert event_id is not None
        uuid.UUID(event_id)

    msg_event_id = capture_message("Diagnostic telemetry message", level="warning")
    assert msg_event_id is not None
    uuid.UUID(msg_event_id)


def test_init_error_monitoring_fails_open_when_unconfigured() -> None:
    with patch.dict("os.environ", {"SENTRY_DSN": ""}):
        result = init_error_monitoring()
        assert result is False


def test_custom_exception_handler_attaches_request_id_to_500() -> None:
    factory = RequestFactory()
    request = factory.get("/api/v1/broken")
    request_id = str(uuid.uuid4())
    request.request_id = request_id  # type: ignore[attr-defined]

    exc = Exception("Unexpected unhandled server fault")
    context = {"request": request}

    response = custom_exception_handler(exc, context)
    assert response is not None
    assert response.status_code == 500
    assert response["X-Request-ID"] == request_id
    assert response.data["request_id"] == request_id
    assert "unexpected server error" in response.data["detail"]


# ==============================================================================
# 3. Health Checks (Liveness and Readiness) Tests
# ==============================================================================


def test_liveness_endpoint_healthy() -> None:
    client = APIClient()
    for endpoint in ("/api/v1/health", "/api/v1/health/live"):
        response = client.get(endpoint)
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}
        assert response["Cache-Control"] == "no-store"


def test_readiness_endpoint_healthy() -> None:
    client = APIClient()
    response = client.get("/api/v1/health/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert data["checks"] == {"database": "ok", "redis": "ok"}
    assert response["Cache-Control"] == "no-store"


def test_readiness_endpoint_fails_when_database_down() -> None:
    client = APIClient()
    with patch("django.db.connection.cursor", side_effect=Exception("Database connection timeout")):
        response = client.get("/api/v1/health/ready")
        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "unavailable"
        assert data["checks"]["database"] == "error"
        assert data["checks"]["redis"] == "ok"
        assert response["Cache-Control"] == "no-store"


def test_readiness_endpoint_fails_when_redis_down() -> None:
    client = APIClient()
    with patch("redis.Redis.ping", side_effect=Exception("Redis connection refused")):
        response = client.get("/api/v1/health/ready")
        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "unavailable"
        assert data["checks"]["database"] == "ok"
        assert data["checks"]["redis"] == "error"
        assert response["Cache-Control"] == "no-store"


# ==============================================================================
# 4. Transactional Outbox Pattern & Immutability Trigger Tests
# ==============================================================================


def test_outbox_event_published_and_processed() -> None:
    event = publish_outbox_event(
        topic="orders.order.created",
        event_key="ORD-TEST-001",
        payload={"order_number": "ORD-TEST-001", "total": "150.00"},
        trigger_async=False,
    )
    assert event.status == OutboxEvent.Status.PENDING
    assert event.retry_count == 0

    success = process_outbox_event(event.id)
    assert success is True

    event.refresh_from_db()
    assert event.status == OutboxEvent.Status.PROCESSED
    assert event.processed_at is not None
    assert event.last_error == ""


def test_outbox_event_immutability_triggers() -> None:
    event = publish_outbox_event(
        topic="finance.payout.processed",
        event_key="PAY-001",
        payload={"payout_id": "test", "amount": "500.00"},
        trigger_async=False,
    )

    from django.db import transaction

    # Core field mutation must be rejected by PostgreSQL trigger
    with (
        pytest.raises(DatabaseError, match="events_outbox core fields are immutable"),
        transaction.atomic(),
        connection.cursor() as cursor,
    ):
        cursor.execute(
            "UPDATE events_outbox SET topic = 'tampered.topic' WHERE id = %s",
            [str(event.id)],
        )

    # Deletion must be rejected by PostgreSQL trigger
    with (
        pytest.raises(
            DatabaseError, match="events_outbox records are immutable and cannot be deleted"
        ),
        transaction.atomic(),
        connection.cursor() as cursor,
    ):
        cursor.execute(
            "DELETE FROM events_outbox WHERE id = %s",
            [str(event.id)],
        )


def test_outbox_batch_processing_and_reconciliation() -> None:
    for i in range(3):
        publish_outbox_event(
            topic=f"test.event.{i}",
            event_key=f"KEY-{i}",
            payload={"index": i},
            trigger_async=False,
        )

    assert OutboxEvent.objects.filter(status=OutboxEvent.Status.PENDING).count() >= 3

    processed = process_pending_outbox_batch(batch_size=10)
    assert processed >= 3
    assert OutboxEvent.objects.filter(status=OutboxEvent.Status.PENDING).count() == 0


def test_outbox_event_automatic_publication_on_order_workflows() -> None:
    # Set up seller, product, variant, inventory
    owner = User.objects.create_user(email="owner_obs@example.com", password="Password12345!")
    seller = Seller.objects.create(
        legal_name="Obs Seller Legal",
        display_name="Obs Seller",
        slug="obs-seller",
        email="seller_obs@example.com",
        status=Seller.Status.ACTIVE,
        verification_status=Seller.VerificationStatus.VERIFIED,
    )
    owner_role = SellerRole.objects.get(name="OWNER", seller__isnull=True)
    SellerMembership.objects.create(
        seller=seller,
        user=owner,
        role=owner_role,
        status=SellerMembership.Status.ACTIVE,
        joined_at=timezone.now(),
    )

    category = Category.objects.create(name="Obs Electronics", slug="obs-electronics")
    product = Product.objects.create(
        seller=seller,
        category=category,
        name="Obs Phone",
        slug="obs-phone",
        created_by=owner,
        status=Product.Status.ACTIVE,
    )
    variant = ProductVariant.objects.create(
        seller=seller,
        product=product,
        sku="OBS-PH-128",
        price=Decimal("499.00"),
    )
    warehouse = Warehouse.objects.create(
        seller=seller,
        name="Obs Main Warehouse",
        code="OBS-WH-1",
    )
    Inventory.objects.create(
        warehouse=warehouse,
        variant=variant,
        quantity_on_hand=50,
        quantity_reserved=0,
    )

    # 1. Test create_order automatically writes OutboxEvent
    order = create_order(
        actor=owner,
        customer_email="buyer_obs@example.com",
        currency="USD",
        items_data=[
            {
                "variant_id": str(variant.pk),
                "warehouse_id": str(warehouse.pk),
                "quantity": 1,
            }
        ],
        billing_address={"street": "123 Main St"},
        shipping_address={"street": "123 Main St"},
    )

    outbox_order_created = OutboxEvent.objects.filter(
        topic="orders.order.created", event_key=str(order.pk)
    ).first()
    assert outbox_order_created is not None
    assert outbox_order_created.status == OutboxEvent.Status.PENDING
    assert outbox_order_created.payload["order_number"] == order.order_number

    # 2. Test confirm_seller_order automatically writes OutboxEvent
    so = order.seller_orders.first()
    assert so is not None
    confirmed_so = confirm_seller_order(seller_id=seller.pk, actor=owner, seller_order_id=so.pk)
    assert confirmed_so.status == SellerOrder.Status.CONFIRMED

    outbox_so_confirmed = OutboxEvent.objects.filter(
        topic="orders.seller_order.confirmed", event_key=str(so.pk)
    ).first()
    assert outbox_so_confirmed is not None
    assert outbox_so_confirmed.status == OutboxEvent.Status.PENDING


# ==============================================================================
# 5. Celery Tasks Execution Tests
# ==============================================================================


def test_celery_trigger_outbox_processing_task() -> None:
    publish_outbox_event(
        topic="celery.task.test",
        event_key="KEY-CELERY",
        payload={"data": 123},
        trigger_async=False,
    )
    result = trigger_outbox_processing.apply()
    assert result.successful()
    assert result.result >= 1


def test_celery_reconcile_outbox_events_task() -> None:
    result = reconcile_outbox_events_task.apply()
    assert result.successful()


def test_celery_deliver_webhook_task() -> None:
    result = deliver_webhook_task.apply(
        args=["https://webhook.example.com/sink", "EVT-123", "orders.shipped", {"order": "123"}]
    )
    assert result.successful()
    assert result.result is True
