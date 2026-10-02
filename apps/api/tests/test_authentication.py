from datetime import timedelta
from typing import Any

import pytest
from axes.models import AccessAttempt
from django.conf import settings
from django.contrib.sessions.models import Session
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import DatabaseError, transaction
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import SecurityEvent, User
from apps.platform_access.models import PlatformAccess, PlatformPermission, PlatformRole

pytestmark = pytest.mark.django_db
PASSWORD = "An-original-test-password-483!"
NEW_PASSWORD = "A-different-test-password-972!"


@pytest.fixture
def user() -> User:
    return User.objects.create_user("owner@example.com", PASSWORD)


@pytest.fixture
def browser() -> APIClient:
    client = APIClient(enforce_csrf_checks=True)
    response = client.get("/api/v1/auth/csrf")
    assert response.status_code == 200
    assert response.data["csrf_token"]
    assert response["Cache-Control"] == "no-store"
    return client


def post(browser: APIClient, path: str, data: dict[str, Any]) -> Any:
    return browser.post(
        path, data, format="json", HTTP_X_CSRFTOKEN=browser.cookies["csrftoken"].value
    )


def login(browser: APIClient, email: str = "owner@example.com", password: str = PASSWORD) -> Any:
    return post(browser, "/api/v1/auth/login", {"email": email, "password": password})


def test_login_rotates_session_and_csrf_and_exposes_only_safe_fields(
    browser: APIClient, user: User
) -> None:
    anonymous = browser.session
    anonymous["prelogin"] = True
    anonymous.save()
    assert anonymous.session_key is not None
    browser.cookies[settings.SESSION_COOKIE_NAME] = anonymous.session_key
    old_session = anonymous.session_key
    old_csrf = browser.cookies["csrftoken"].value
    response = login(browser, email=" OWNER@EXAMPLE.COM ")
    assert response.status_code == 200
    assert set(response.data) == {
        "id",
        "email",
        "first_name",
        "last_name",
        "is_email_verified",
        "platform_permissions",
    }
    assert response.data["id"] == str(user.id)
    assert response.data["platform_permissions"] == []
    assert PASSWORD not in response.content.decode()
    assert user.password not in response.content.decode()
    assert browser.cookies["sessionid"].value != old_session
    assert browser.cookies["csrftoken"].value != old_csrf
    assert not Session.objects.filter(session_key=old_session).exists()
    assert response.cookies["sessionid"]["httponly"]
    assert response.cookies["sessionid"]["samesite"] == "Lax"
    assert int(response.cookies["sessionid"]["max-age"]) == settings.SESSION_COOKIE_AGE
    assert browser.get("/api/v1/auth/me").status_code == 200
    assert SecurityEvent.objects.filter(action="login.succeeded", actor_id=user.id).exists()


def test_invalid_unknown_and_disabled_logins_have_same_response(
    browser: APIClient, user: User
) -> None:
    invalid = login(browser, password="wrong-password")
    missing = login(browser, email="missing@example.com")
    user.is_active = False
    user.save(update_fields=["is_active"])
    disabled = login(browser)
    for response in [invalid, missing, disabled]:
        assert response.status_code == 403
        assert response.data == {"detail": "Invalid email or password."}
        assert "sessionid" not in response.cookies
    assert SecurityEvent.objects.filter(action="login.failed").count() == 3


@pytest.mark.parametrize("path", ["login", "logout", "change-password"])
def test_unsafe_auth_requires_csrf_for_anonymous_and_authenticated(
    path: str, browser: APIClient, user: User
) -> None:
    data = {"email": user.email, "password": PASSWORD}
    assert (
        APIClient(enforce_csrf_checks=True)
        .post(f"/api/v1/auth/{path}", data, format="json")
        .status_code
        == 403
    )
    assert login(browser).status_code == 200
    response = browser.post(f"/api/v1/auth/{path}", data, format="json")
    assert response.status_code == 403
    assert "CSRF" in str(response.data)


def test_csrf_rejects_untrusted_origin_and_wrong_token(browser: APIClient, user: User) -> None:
    headers: dict[str, Any]
    for headers in [
        {"HTTP_X_CSRFTOKEN": "x" * 32},
        {
            "HTTP_X_CSRFTOKEN": browser.cookies["csrftoken"].value,
            "HTTP_ORIGIN": "https://evil.example",
        },
    ]:
        assert (
            browser.post(
                "/api/v1/auth/login",
                {"email": user.email, "password": PASSWORD},
                format="json",
                **headers,
            ).status_code
            == 403
        )
    assert not AccessAttempt.objects.exists()


@pytest.mark.parametrize("path", ["/api/v1/auth/me", "/api/v1/admin/access"])
def test_anonymous_protected_endpoints_are_denied(path: str) -> None:
    assert APIClient().get(path).status_code == 403


def test_logout_invalidates_session_and_replay(browser: APIClient, user: User) -> None:
    assert login(browser).status_code == 200
    old = browser.cookies["sessionid"].value
    assert post(browser, "/api/v1/auth/logout", {}).status_code == 204
    assert not Session.objects.filter(session_key=old).exists()
    assert browser.get("/api/v1/auth/me").status_code == 403
    replay = APIClient()
    replay.cookies["sessionid"] = old
    assert replay.get("/api/v1/auth/me").status_code == 403
    assert SecurityEvent.objects.filter(action="logout", actor_id=user.id).exists()


def test_disabled_account_loses_existing_session(browser: APIClient, user: User) -> None:
    assert login(browser).status_code == 200
    User.objects.filter(pk=user.pk).update(is_active=False)
    assert browser.get("/api/v1/auth/me").status_code == 403


def test_expired_session_is_denied(browser: APIClient, user: User) -> None:
    assert login(browser).status_code == 200
    Session.objects.filter(session_key=browser.cookies["sessionid"].value).update(
        expire_date=timezone.now() - timedelta(seconds=1)
    )
    assert browser.get("/api/v1/auth/me").status_code == 403


@pytest.mark.parametrize("superuser", [False, True])
def test_business_access_never_uses_django_superuser(
    browser: APIClient, user: User, superuser: bool
) -> None:
    user.is_superuser = superuser
    user.is_staff = superuser
    user.save()
    assert login(browser).status_code == 200
    assert browser.get("/api/v1/admin/access").status_code == 403


def test_platform_role_grants_only_explicit_capabilities_and_revocation_is_immediate(
    browser: APIClient, user: User
) -> None:
    call_command("grant_platform_access", user.email)
    assert login(browser).status_code == 200
    assert browser.get("/api/v1/admin/access").status_code == 200
    assert browser.get("/api/v1/auth/me").data["platform_permissions"] == [
        "platform.access",
        "platform.catalog.manage",
        "platform.catalog.read",
        "platform.inventory.read",
        "platform.orders.manage",
        "platform.orders.read",
        "platform.products.moderate",
        "platform.products.read",
        "platform.sellers.audit.read",
        "platform.sellers.documents.read",
        "platform.sellers.documents.review",
        "platform.sellers.manage",
        "platform.sellers.read",
    ]
    PlatformAccess.objects.filter(user=user).update(is_active=False)
    assert browser.get("/api/v1/admin/access").status_code == 403
    assert browser.get("/api/v1/auth/me").data["platform_permissions"] == []


def test_role_name_alone_does_not_grant_permissions(browser: APIClient, user: User) -> None:
    role = PlatformRole.objects.create(name="FINANCE_ADMIN")
    PlatformAccess.objects.create(user=user, role=role)
    assert login(browser).status_code == 200
    assert browser.get("/api/v1/admin/access").status_code == 403
    role.permissions.add(PlatformPermission.objects.get(code="platform.access"))
    assert browser.get("/api/v1/admin/access").status_code == 200


def test_failure_limit_cannot_be_bypassed_by_case_forwarded_ip_or_user_agent(
    browser: APIClient, user: User
) -> None:
    for attempt in range(5):
        browser.credentials(
            HTTP_X_FORWARDED_FOR=f"192.0.2.{attempt}", HTTP_USER_AGENT=f"agent-{attempt}"
        )
        response = login(browser, email="OWNER@EXAMPLE.COM", password="bad-password")
        assert response.status_code == (403 if attempt < 4 else 429)
    last_attempt = AccessAttempt.objects.latest("attempt_time").attempt_time
    response = login(browser)
    assert response.status_code == 429
    assert response["Retry-After"] == "900"
    assert response["Cache-Control"] == "no-store"
    assert "Access-Control-Allow-Origin" not in response
    assert AccessAttempt.objects.latest("attempt_time").attempt_time == last_attempt
    assert SecurityEvent.objects.filter(action="login.blocked").exists()


def test_cooloff_recovers_without_manual_intervention(browser: APIClient, user: User) -> None:
    for _ in range(5):
        login(browser, password="bad-password")
    assert login(browser).status_code == 429
    AccessAttempt.objects.update(attempt_time=timezone.now() - timedelta(minutes=16))
    assert login(browser).status_code == 200


def test_ip_limit_applies_across_accounts(browser: APIClient) -> None:
    for attempt in range(5):
        response = login(browser, email=f"missing-{attempt}@example.com", password="wrong")
    assert response.status_code == 429
    assert login(browser, email="another@example.com").status_code == 429


def test_account_limit_applies_across_ips(browser: APIClient, user: User) -> None:
    for attempt in range(5):
        browser.credentials(REMOTE_ADDR=f"192.0.2.{attempt + 1}")
        response = login(browser, password="wrong")
    assert response.status_code == 429
    browser.credentials(REMOTE_ADDR="198.51.100.1")
    assert login(browser).status_code == 429


def test_password_change_rotates_current_session_and_invalidates_other_sessions(
    browser: APIClient, user: User
) -> None:
    other = APIClient(enforce_csrf_checks=True)
    other.get("/api/v1/auth/csrf")
    assert login(other).status_code == 200
    assert login(browser).status_code == 200
    old_session = browser.cookies["sessionid"].value
    response = post(
        browser,
        "/api/v1/auth/change-password",
        {"old_password": PASSWORD, "new_password": NEW_PASSWORD},
    )
    assert response.status_code == 204
    assert browser.cookies["sessionid"].value != old_session
    assert browser.get("/api/v1/auth/me").status_code == 200
    assert other.get("/api/v1/auth/me").status_code == 403
    user.refresh_from_db()
    assert user.check_password(NEW_PASSWORD)
    assert not user.check_password(PASSWORD)
    assert SecurityEvent.objects.filter(action="password.changed", actor_id=user.id).exists()


@pytest.mark.parametrize("new_password", ["123", PASSWORD, "owner@example.com"])
def test_password_validation_preserves_existing_password(
    browser: APIClient, user: User, new_password: str
) -> None:
    assert login(browser).status_code == 200
    assert (
        post(
            browser,
            "/api/v1/auth/change-password",
            {"old_password": PASSWORD, "new_password": new_password},
        ).status_code
        == 400
    )
    user.refresh_from_db()
    assert user.check_password(PASSWORD)


def test_password_change_requires_current_password_and_is_rate_limited(
    browser: APIClient, user: User
) -> None:
    assert login(browser).status_code == 200
    for _ in range(5):
        response = post(
            browser,
            "/api/v1/auth/change-password",
            {"old_password": "wrong", "new_password": NEW_PASSWORD},
        )
    assert response.status_code == 429
    user.refresh_from_db()
    assert user.check_password(PASSWORD)


def test_auth_rejects_mass_assignment_and_query_parameters(browser: APIClient, user: User) -> None:
    assert (
        post(
            browser,
            "/api/v1/auth/login",
            {"email": user.email, "password": PASSWORD, "is_superuser": True},
        ).status_code
        == 400
    )
    assert (
        post(
            browser,
            "/api/v1/auth/login?password=must-not-log",
            {"email": user.email, "password": PASSWORD},
        ).status_code
        == 400
    )
    assert not AccessAttempt.objects.exists()


def test_passwords_and_hashes_absent_from_events_and_logs(
    browser: APIClient, user: User, caplog: pytest.LogCaptureFixture
) -> None:
    assert login(browser).status_code == 200
    login(browser, password="failed-password-must-not-be-recorded")
    records = str(list(SecurityEvent.objects.values())) + str(list(AccessAttempt.objects.values()))
    for secret in [PASSWORD, user.password, "failed-password-must-not-be-recorded"]:
        assert secret not in records
        assert secret not in caplog.text


@pytest.mark.parametrize("operation", ["update", "delete"])
def test_security_events_cannot_be_mutated(operation: str) -> None:
    event = SecurityEvent.objects.create(action="login.failed")
    with pytest.raises(DatabaseError, match="append-only"), transaction.atomic():
        if operation == "update":
            SecurityEvent.objects.filter(pk=event.pk).update(action="logout")
        else:
            SecurityEvent.objects.filter(pk=event.pk).delete()
    assert SecurityEvent.objects.get(pk=event.pk).action == "login.failed"


@override_settings(SESSION_COOKIE_SECURE=True, CSRF_COOKIE_SECURE=True)
def test_secure_cookie_attributes_are_set_on_actual_login_response(user: User) -> None:
    client = APIClient(enforce_csrf_checks=True)
    csrf = client.get("/api/v1/auth/csrf", secure=True)
    assert csrf.cookies["csrftoken"]["secure"]
    response = client.post(
        "/api/v1/auth/login",
        {"email": user.email, "password": PASSWORD},
        format="json",
        secure=True,
        HTTP_ORIGIN="https://testserver",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert response.status_code == 200
    assert response.cookies["sessionid"]["secure"]
    assert response.cookies["sessionid"]["httponly"]
    assert response.cookies["csrftoken"]["secure"]


def test_regular_account_bootstrap_has_no_elevated_privileges(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "apps.accounts.management.commands.create_account.getpass", lambda prompt: PASSWORD
    )
    call_command("create_account", "BOOTSTRAP@example.com")
    account = User.objects.get(email="bootstrap@example.com")
    assert account.check_password(PASSWORD)
    assert not account.is_staff
    assert not account.is_superuser
    assert not PlatformAccess.objects.filter(user=account).exists()


def test_bootstrap_rejects_weak_password(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "apps.accounts.management.commands.create_account.getpass", lambda prompt: "123"
    )
    with pytest.raises(CommandError):
        call_command("create_account", "bootstrap@example.com")
    assert not User.objects.filter(email="bootstrap@example.com").exists()
