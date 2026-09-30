"""Verify real Django session/CSRF behavior through the local Next.js development proxy.

Requires migrated local PostgreSQL and both dev servers. Run via uv with the root .env.
Creates then deletes a disposable user; immutable security events intentionally remain.
"""

import http.cookiejar
import json
import os
import secrets
import sys
import urllib.error
import urllib.request
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "apps/api"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

import django
from django.conf import settings  # noqa: E402

django.setup()

ORIGIN = "http://127.0.0.1:3000"


def main() -> None:
    from axes.models import AccessAttempt

    from apps.accounts.models import User

    if not settings.DEBUG:
        raise RuntimeError("The proxy smoke test is for the local development environment only.")
    email = f"proxy-smoke-{uuid4()}@example.invalid"
    password = secrets.token_urlsafe(32)
    user = User.objects.create_user(email, password)
    jar = http.cookiejar.CookieJar()
    client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

    def send(path: str, data: dict[str, str] | None = None, *, csrf: bool = True) -> int:
        headers = {"Origin": ORIGIN}
        body = None
        if data is not None:
            headers["Content-Type"] = "application/json"
            if csrf:
                headers["X-CSRFToken"] = next(c.value for c in jar if c.name == "csrftoken")
            body = json.dumps(data).encode()
        request = urllib.request.Request(ORIGIN + path, data=body, headers=headers)
        try:
            with client.open(request, timeout=15) as response:
                assert response.headers["Cache-Control"] == "no-store"
                return response.status
        except urllib.error.HTTPError as error:
            return error.code

    try:
        credentials = {"email": email, "password": password}
        assert send("/api/v1/auth/login", credentials, csrf=False) == 403
        assert send("/api/v1/auth/csrf") == 200
        before = next(c.value for c in jar if c.name == "csrftoken")
        assert send("/api/v1/auth/login", credentials) == 200
        session = next(c for c in jar if c.name == "sessionid")
        assert session.has_nonstandard_attr("HttpOnly")
        assert next(c.value for c in jar if c.name == "csrftoken") != before
        assert send("/api/v1/auth/me") == 200
        assert send("/api/v1/auth/logout", {}, csrf=False) == 403
        assert (
            send(
                "/api/v1/auth/change-password",
                {"old_password": password, "new_password": secrets.token_urlsafe(32)},
            )
            == 204
        )
        assert next(c.value for c in jar if c.name == "sessionid") != session.value
        assert send("/api/v1/auth/me") == 200
        assert send("/api/v1/auth/logout", {}) == 204
        assert send("/api/v1/auth/me") == 403
        jar.set_cookie(session)
        assert send("/api/v1/auth/me") == 403
        print(
            "PASS: proxy login CSRF, cookie attributes/rotation, password change, "
            "logout and replay."
        )
    finally:
        AccessAttempt.objects.filter(username=email).delete()
        user.delete()


if __name__ == "__main__":
    main()
