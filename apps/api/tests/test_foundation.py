import importlib
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import Client
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework.views import APIView

from apps.accounts.models import User


def test_liveness_is_public_minimal_and_uncached(client: Client) -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert response["Cache-Control"] == "no-store"
    assert response["X-Content-Type-Options"] == "nosniff"
    assert response["X-Frame-Options"] == "DENY"
    assert not response.cookies


@pytest.mark.parametrize("method", ["post", "put", "patch", "delete"])
def test_liveness_rejects_unsafe_methods(client: Client, method: str) -> None:
    assert getattr(client, method)("/api/v1/health").status_code == 405


def test_unknown_routes_and_invalid_hosts_fail_closed(client: Client) -> None:
    assert client.get("/api/v2/health").status_code == 404
    assert client.get("/api/v1/health", HTTP_HOST="attacker.example").status_code == 400
    assert client.get("/admin/").status_code == 404
    assert client.get("/api/v1/auth/login").status_code == 405
    assert client.get("/api/v1/auth/nonexistent").status_code == 404


@pytest.mark.parametrize("authenticated", [False, True])
def test_unconfigured_api_denies_everyone(authenticated: bool) -> None:
    request = APIRequestFactory().get("/")
    if authenticated:
        force_authenticate(request, user=User(email="user@example.com"))
    assert APIView.as_view()(request).status_code == 403


def test_wsgi_and_asgi_applications_import() -> None:
    assert callable(importlib.import_module("config.wsgi").application)
    assert callable(importlib.import_module("config.asgi").application)


def test_security_foundation_settings() -> None:
    assert settings.AUTH_USER_MODEL == "accounts.User"
    assert settings.SESSION_ENGINE == "django.contrib.sessions.backends.db"
    assert settings.SESSION_COOKIE_HTTPONLY
    assert settings.SESSION_COOKIE_SAMESITE == "Lax"
    assert "django.middleware.csrf.CsrfViewMiddleware" in settings.MIDDLEWARE
    assert settings.SECURE_HSTS_SECONDS == 0
    assert settings.DATABASES["default"]["ENGINE"] == "django.db.backends.postgresql"


@pytest.mark.django_db
def test_initial_user_schema_and_hashing() -> None:
    user = User.objects.create_user("  Owner@Example.COM  ", "local-test-password-only")
    user.refresh_from_db()
    assert user.email == "owner@example.com"
    assert user.USERNAME_FIELD == "email"
    assert not hasattr(user, "username")
    assert user.password.startswith("argon2$")
    assert user.check_password("local-test-password-only")
    assert not user.is_staff
    assert not user.is_superuser


@pytest.mark.django_db
def test_database_enforces_email_uniqueness_and_normalization() -> None:
    User.objects.create_user("owner@example.com")
    with pytest.raises(IntegrityError), transaction.atomic():
        User.objects.create_user("OWNER@example.com")
    for email in ["Mixed@example.com", " space@example.com", ""]:
        with pytest.raises(IntegrityError), transaction.atomic():
            User.objects.create(email=email)


@pytest.mark.parametrize("email", ["", "not-an-email"])
def test_manager_rejects_invalid_email_before_database_access(email: str) -> None:
    with pytest.raises(ValidationError):
        User.objects.create_user(email)


def production_environment() -> dict[str, str]:
    return {
        **os.environ,
        "DJANGO_SETTINGS_MODULE": "config.settings.production",
        "DJANGO_ALLOWED_HOSTS": "commerce.example.com",
        "DJANGO_CSRF_TRUSTED_ORIGINS": "https://commerce.example.com",
        "STORAGE_ENDPOINT_URL": "https://storage.example.com",
        "STORAGE_VERIFICATION_BUCKET": "private-test-verification",
        "STORAGE_CATALOG_BUCKET": "private-test-catalog",
        "STORAGE_REGION": "test-region",
        "STORAGE_ACCESS_KEY_ID": "test-storage-id",
        "STORAGE_SECRET_ACCESS_KEY": "test-storage-secret",
    }


def test_production_settings_have_only_expected_preload_advisory() -> None:
    # Preload requires a real deployment/domain decision; it is deliberately not enabled.
    code = (
        "import django, json; django.setup(); "
        "from django.core.checks import run_checks; "
        "print(json.dumps([c.id for c in run_checks(include_deployment_checks=True)]))"
    )
    result = subprocess.run(
        [sys.executable, "-c", code],
        cwd=Path(__file__).resolve().parent.parent,
        env=production_environment(),
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == ["security.W021"]


@pytest.mark.parametrize(
    ("variable", "value"),
    [
        ("DJANGO_SECRET_KEY", ""),
        ("DJANGO_SECRET_KEY", "replace-with-generated-local-secret"),
        ("DJANGO_SECRET_KEY", "short"),
        ("DJANGO_ALLOWED_HOSTS", ""),
        ("DJANGO_ALLOWED_HOSTS", "*"),
        ("DJANGO_CSRF_TRUSTED_ORIGINS", "http://commerce.example.com"),
        ("DJANGO_CSRF_TRUSTED_ORIGINS", "https://*.example.com"),
        ("DJANGO_CSRF_TRUSTED_ORIGINS", "https://commerce.example.com/path"),
        ("STORAGE_ENDPOINT_URL", ""),
        ("STORAGE_ENDPOINT_URL", "http://storage.example.com"),
        ("STORAGE_VERIFICATION_BUCKET", ""),
        ("STORAGE_SECRET_ACCESS_KEY", "replace-with-storage-secret-key"),
    ],
)
def test_production_rejects_unsafe_configuration(variable: str, value: str) -> None:
    result = subprocess.run(
        [sys.executable, "-c", "import config.settings.production"],
        cwd=Path(__file__).resolve().parent.parent,
        env={**production_environment(), variable: value},
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode != 0
    assert "ImproperlyConfigured" in result.stderr


def test_production_cookie_and_transport_security() -> None:
    code = (
        "import json; from config.settings import production as s; "
        "print(json.dumps([s.DEBUG, s.SESSION_COOKIE_SECURE, s.CSRF_COOKIE_SECURE, "
        "s.SECURE_SSL_REDIRECT, s.SECURE_HSTS_SECONDS]))"
    )
    result = subprocess.run(
        [sys.executable, "-c", code],
        cwd=Path(__file__).resolve().parent.parent,
        env=production_environment(),
        capture_output=True,
        text=True,
        check=True,
    )
    assert json.loads(result.stdout) == [False, True, True, True, 31536000]
