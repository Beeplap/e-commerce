import logging
import os
import uuid
from typing import Any

from config.logging import get_current_request_id, get_current_user_id

logger = logging.getLogger("apps.api.monitoring")

_MONITORING_INITIALIZED = False


def init_error_monitoring() -> bool:
    """Initializes production error monitoring (e.g. Sentry) if configured via environment.

    Fails open safely to standard structured logging when unconfigured.
    """
    global _MONITORING_INITIALIZED
    dsn = os.environ.get("SENTRY_DSN", "").strip()
    if not dsn:
        return False

    try:
        import sentry_sdk
        from sentry_sdk.integrations.django import DjangoIntegration

        sentry_sdk.init(
            dsn=dsn,
            integrations=[DjangoIntegration()],
            environment=os.environ.get("ENVIRONMENT", "production"),
            send_default_pii=False,
            traces_sample_rate=float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
        )
        _MONITORING_INITIALIZED = True
        logger.info("Error monitoring service initialized successfully.")
        return True
    except (ImportError, Exception) as exc:
        logger.warning(
            "Failed to initialize error monitoring service; falling back to local logging.",
            exc_info=exc,
        )
        return False


def capture_exception(
    exc: BaseException,
    context: dict[str, Any] | None = None,
) -> str:
    """Captures and records an unexpected exception across monitoring and structured logging."""
    event_id = str(uuid.uuid4())
    req_id = get_current_request_id()
    user_id = get_current_user_id()

    merged_context: dict[str, Any] = {
        "event_id": event_id,
        "request_id": req_id,
        "user_id": user_id,
    }
    if context:
        merged_context.update(context)

    # Dispatch to Sentry if active
    if _MONITORING_INITIALIZED:
        try:
            import sentry_sdk

            with sentry_sdk.push_scope() as scope:
                for k, v in merged_context.items():
                    scope.set_extra(k, v)
                sentry_event_id = sentry_sdk.capture_exception(exc)
                if sentry_event_id:
                    return str(sentry_event_id)
        except Exception:
            pass

    # Fallback to local structured logging
    logger.error(
        f"Unhandled exception [{event_id}]: {exc}",
        exc_info=exc,
        extra=merged_context,
    )
    return event_id


def capture_message(
    message: str,
    level: str = "info",
    context: dict[str, Any] | None = None,
) -> str:
    """Captures and records a diagnostic message across monitoring and structured logging."""
    event_id = str(uuid.uuid4())
    req_id = get_current_request_id()
    user_id = get_current_user_id()

    merged_context: dict[str, Any] = {
        "event_id": event_id,
        "request_id": req_id,
        "user_id": user_id,
    }
    if context:
        merged_context.update(context)

    if _MONITORING_INITIALIZED:
        try:
            import sentry_sdk

            with sentry_sdk.push_scope() as scope:
                for k, v in merged_context.items():
                    scope.set_extra(k, v)
                sentry_event_id = sentry_sdk.capture_message(message, level=level)
                if sentry_event_id:
                    return str(sentry_event_id)
        except Exception:
            pass

    log_level = getattr(logging, level.upper(), logging.INFO)
    logger.log(
        log_level,
        f"Diagnostic message [{event_id}]: {message}",
        extra=merged_context,
    )
    return event_id
