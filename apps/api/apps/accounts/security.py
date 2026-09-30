from ipaddress import ip_address
from typing import Any
from uuid import UUID

from django.http import HttpRequest, HttpResponse, JsonResponse
from django.utils.crypto import salted_hmac

from apps.accounts.models import SecurityEvent, UserManager


def client_ip(request: HttpRequest) -> str | None:
    """Never trust caller-provided forwarding headers without a verified ingress."""
    value = request.META.get("REMOTE_ADDR", "")
    try:
        return str(ip_address(value))
    except ValueError:
        return None


def safe_client_label(*args: Any, **kwargs: Any) -> str:
    return "authentication client"


def record_event(
    action: str,
    *,
    request: HttpRequest | None = None,
    actor_id: UUID | None = None,
    subject_id: UUID | None = None,
    email: str = "",
) -> None:
    SecurityEvent.objects.create(
        action=action,
        actor_id=actor_id,
        subject_id=subject_id,
        identity_digest=(
            salted_hmac(
                "auth-event-identity", UserManager.normalize_email(email), algorithm="sha256"
            ).hexdigest()
            if email
            else ""
        ),
        ip_address=client_ip(request) if request is not None else None,
    )


def lockout_response(
    request: HttpRequest, response: HttpResponse | None = None, credentials: Any = None
) -> HttpResponse:
    result = JsonResponse(
        {"detail": "Too many authentication attempts. Try again later."}, status=429
    )
    result["Retry-After"] = "900"
    result["Cache-Control"] = "no-store"
    return result
