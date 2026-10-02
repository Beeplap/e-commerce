from typing import Any

from rest_framework.response import Response
from rest_framework.views import exception_handler

from config.logging import get_current_request_id
from config.monitoring import capture_exception


def custom_exception_handler(exc: Exception, context: dict[str, Any]) -> Response | None:
    """DRF exception handler that attaches correlation request IDs to error responses
    and captures unhandled 5xx errors.
    """
    response = exception_handler(exc, context)
    request_id = get_current_request_id()

    request = context.get("request")
    if not request_id and request and hasattr(request, "request_id"):
        request_id = str(request.request_id)

    if response is not None:
        if request_id:
            response["X-Request-ID"] = request_id
        return response

    # Unhandled 500 exception
    req_context: dict[str, Any] = {}
    if request:
        req_context["path"] = getattr(request, "path", "")
        req_context["method"] = getattr(request, "method", "")

    event_id = capture_exception(exc, context=req_context)
    ref_id = request_id or event_id

    error_response = Response(
        {
            "detail": "An unexpected server error occurred. Please try again.",
            "request_id": ref_id,
        },
        status=500,
    )
    if ref_id:
        error_response["X-Request-ID"] = ref_id
    return error_response
