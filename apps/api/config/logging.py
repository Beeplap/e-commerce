import json
import logging
import re
import time
import uuid
from collections.abc import Callable
from contextvars import ContextVar
from datetime import UTC, datetime
from ipaddress import ip_address
from typing import Any

from django.http import HttpRequest, HttpResponse

request_id_ctx: ContextVar[str | None] = ContextVar("request_id", default=None)
user_id_ctx: ContextVar[str | None] = ContextVar("user_id", default=None)
seller_id_ctx: ContextVar[str | None] = ContextVar("seller_id", default=None)


def get_current_request_id() -> str | None:
    return request_id_ctx.get()


def get_current_user_id() -> str | None:
    return user_id_ctx.get()


def get_current_seller_id() -> str | None:
    return seller_id_ctx.get()


SECRET_PATTERNS = [
    re.compile(r"(password['\"]?\s*[:=]\s*['\"])[^'\"]+(['\"])", re.IGNORECASE),
    re.compile(r"(token['\"]?\s*[:=]\s*['\"])[^'\"]+(['\"])", re.IGNORECASE),
    re.compile(r"(secret['\"]?\s*[:=]\s*['\"])[^'\"]+(['\"])", re.IGNORECASE),
    re.compile(r"(authorization['\"]?\s*[:=]\s*['\"])[^'\"]+(['\"])", re.IGNORECASE),
    re.compile(r"(sessionid['\"]?\s*[:=]\s*['\"])[^'\"]+(['\"])", re.IGNORECASE),
    re.compile(r"(csrftoken['\"]?\s*[:=]\s*['\"])[^'\"]+(['\"])", re.IGNORECASE),
]


def redact_secrets(message: str) -> str:
    redacted = message
    for pattern in SECRET_PATTERNS:
        redacted = pattern.sub(r"\1[REDACTED]\2", redacted)
    return redacted


class StructuredJsonFormatter(logging.Formatter):
    """Formats log records into machine-readable JSON with context metadata."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=UTC).isoformat(),
            "level": record.levelname,
            "message": redact_secrets(record.getMessage()),
            "logger": record.name,
        }

        # Context correlation
        req_id = getattr(record, "request_id", None) or get_current_request_id()
        if req_id:
            payload["request_id"] = req_id

        user_id = getattr(record, "user_id", None) or get_current_user_id()
        if user_id:
            payload["user_id"] = user_id

        seller_id = getattr(record, "seller_id", None) or get_current_seller_id()
        if seller_id:
            payload["seller_id"] = seller_id

        # HTTP request metrics
        for attr in ("route", "method", "status", "latency_ms", "ip"):
            val = getattr(record, attr, None)
            if val is not None:
                payload[attr] = val

        # Exception information
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        return json.dumps(payload)


logger = logging.getLogger("apps.api.access")


class RequestLoggingMiddleware:
    """Extracts/generates X-Request-ID, tracks latency, and outputs structured access logs."""

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        # Validate or generate correlation request ID
        incoming_id = request.headers.get("X-Request-ID")
        req_id: str
        if incoming_id:
            try:
                req_id = str(uuid.UUID(incoming_id))
            except ValueError, AttributeError:
                req_id = str(uuid.uuid4())
        else:
            req_id = str(uuid.uuid4())

        request.request_id = req_id  # type: ignore[attr-defined]
        token_req = request_id_ctx.set(req_id)

        # Contextual seller ID from verified header if present
        seller_id_header = request.headers.get("X-Seller-ID")
        seller_id_val: str | None = None
        if seller_id_header:
            try:
                seller_id_val = str(uuid.UUID(seller_id_header))
            except ValueError, AttributeError:
                seller_id_val = None
        token_seller = seller_id_ctx.set(seller_id_val)

        start_time = time.monotonic()
        token_user = None

        try:
            response = self.get_response(request)

            # Determine authenticated user ID if safe
            user_id_val: str | None = None
            if hasattr(request, "user") and request.user.is_authenticated:
                user_id_val = str(getattr(request.user, "pk", ""))
            token_user = user_id_ctx.set(user_id_val)

            latency_ms = round((time.monotonic() - start_time) * 1000, 2)
            response["X-Request-ID"] = req_id

            # Safe client IP from REMOTE_ADDR only
            raw_ip = request.META.get("REMOTE_ADDR", "")
            try:
                client_ip_str = str(ip_address(raw_ip))
            except ValueError:
                client_ip_str = None

            log_level = logging.INFO
            if response.status_code >= 500:
                log_level = logging.ERROR
            elif response.status_code >= 400:
                log_level = logging.WARNING

            logger.log(
                log_level,
                f"{request.method} {request.path} {response.status_code} in {latency_ms}ms",
                extra={
                    "request_id": req_id,
                    "user_id": user_id_val,
                    "seller_id": seller_id_val,
                    "route": request.path,
                    "method": request.method,
                    "status": response.status_code,
                    "latency_ms": latency_ms,
                    "ip": client_ip_str,
                },
            )
            return response
        finally:
            request_id_ctx.reset(token_req)
            seller_id_ctx.reset(token_seller)
            if token_user is not None:
                user_id_ctx.reset(token_user)
