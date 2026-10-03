from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.http import HttpRequest
from django.views.decorators.debug import sensitive_variables
from rest_framework.exceptions import (
    AuthenticationFailed,
    PermissionDenied,
    Throttled,
    ValidationError,
)

from apps.accounts.models import SecurityEvent, User, UserManager
from apps.accounts.security import record_event


def authenticated_user(request: HttpRequest) -> User:
    if not isinstance(request.user, User) or not request.user.is_active:
        raise PermissionDenied("Authentication required.")
    return request.user


@sensitive_variables("password")
def verify_credentials(
    request: HttpRequest,
    email: str,
    password: str,
    *,
    failure_action: str = SecurityEvent.Action.LOGIN_FAILED,
) -> User:
    email = UserManager.normalize_email(email)
    user = authenticate(request=request, email=email, password=password)
    if getattr(request, "axes_locked_out", False):
        record_event(SecurityEvent.Action.LOGIN_BLOCKED, request=request, email=email)
        raise Throttled(wait=900, detail="Too many authentication attempts. Try again later.")
    if user is None:
        record_event(failure_action, request=request, email=email)
        raise AuthenticationFailed("Invalid email or password.")
    return user


@sensitive_variables("password")
def login_user(request: HttpRequest, *, email: str, password: str) -> User:
    user = verify_credentials(request, email, password)
    guest_session_key = request.session.session_key if hasattr(request, "session") else None
    with transaction.atomic():
        login(request, user)
        record_event(SecurityEvent.Action.LOGIN_SUCCEEDED, request=request, actor_id=user.id)
        if guest_session_key:
            from apps.cart.services import merge_guest_cart_into_user_cart

            merge_guest_cart_into_user_cart(guest_session_key=guest_session_key, user=user)
    return user


def logout_user(request: HttpRequest) -> None:
    user = authenticated_user(request)
    with transaction.atomic():
        record_event(SecurityEvent.Action.LOGOUT, request=request, actor_id=user.pk)
        logout(request)


@sensitive_variables("old_password", "new_password")
def change_password(request: HttpRequest, *, old_password: str, new_password: str) -> None:
    # Failures must commit their abuse counters/events, so authenticate outside the transaction.
    current_user = authenticated_user(request)
    verified = verify_credentials(
        request,
        current_user.email,
        old_password,
        failure_action=SecurityEvent.Action.PASSWORD_REJECTED,
    )
    with transaction.atomic():
        user = User.objects.select_for_update().get(pk=current_user.pk)
        if not user.is_active:
            raise PermissionDenied("Authentication required.")
        if user.pk != verified.pk or user.password != verified.password:
            raise AuthenticationFailed("Authentication changed. Sign in again.")
        try:
            validate_password(new_password, user)
        except DjangoValidationError as error:
            raise ValidationError({"new_password": error.messages}) from error
        if user.check_password(new_password):
            raise ValidationError({"new_password": ["Choose a different password."]})
        user.set_password(new_password)
        user.save(update_fields=["password", "updated_at"])
        # Rotates this session; all other sessions fail their stored auth-hash check.
        update_session_auth_hash(request, user)
        record_event(SecurityEvent.Action.PASSWORD_CHANGED, request=request, actor_id=user.id)
