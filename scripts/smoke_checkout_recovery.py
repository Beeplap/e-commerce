"""Check guest placement recovery and address input through the real Next.js proxy.

Creates and deletes only its own empty guest cart/session. Never creates an order,
reserves inventory or calls a gateway. Requires migrated local PostgreSQL/dev servers.
"""

import http.cookiejar
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "apps/api"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

import django
from django.conf import settings

django.setup()

ORIGIN = "http://127.0.0.1:3000"
RECOVER = "/api/v1/checkout/recover-placement/"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args: Any, **kwargs: Any) -> None:
        raise AssertionError("Unexpected proxy redirect")


def send(
    client: urllib.request.OpenerDirector,
    path: str,
    body: dict[str, Any] | None = None,
    *,
    csrf: bool = True,
) -> tuple[int, Any]:
    headers = {"Origin": ORIGIN, "Accept": "application/json"}
    if body is not None:
        headers["Content-Type"] = "application/json"
        if csrf:
            code, value = send(client, "/api/v1/auth/csrf")
            assert code == 200 and isinstance(value["csrf_token"], str)
            headers["X-CSRFToken"] = value["csrf_token"]
    request = urllib.request.Request(
        ORIGIN + path,
        data=json.dumps(body).encode() if body is not None else None,
        headers=headers,
    )
    try:
        with client.open(request, timeout=20) as response:
            assert response.headers["Cache-Control"] == "no-store"
            return response.status, json.loads(response.read())
    except urllib.error.HTTPError as error:
        assert error.headers["Cache-Control"] == "no-store"
        return error.code, json.loads(error.read())


def main() -> None:
    from django.contrib.sessions.models import Session

    from apps.cart.models import Cart
    from apps.checkout.models import CheckoutAttempt, CheckoutAttemptCancellation

    if not settings.DEBUG:
        raise RuntimeError("The checkout smoke test is for local development only.")
    jar = http.cookiejar.CookieJar()
    client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar), NoRedirect())
    cart_id = None
    session_key = None
    key = f"proxy_checkout_{uuid4().hex}"
    try:
        code, cart = send(client, "/api/v1/cart/")
        assert code == 200 and cart["total_items"] == 0
        cart_id = cart["id"]
        session_key = next(
            cookie.value for cookie in jar if cookie.name == settings.SESSION_COOKIE_NAME
        )
        owned = Cart.objects.get(pk=cart_id, user__isnull=True, session_key=session_key)
        body = {"cart_id": cart_id, "idempotency_key": key}
        assert send(client, RECOVER, body, csrf=False)[0] == 403
        for _ in range(2):
            assert send(client, RECOVER, body) == (
                200,
                {"status": "cancelled", "order_id": None},
            )
        assert CheckoutAttemptCancellation.objects.filter(cart=owned, key=key).count() == 1
        # A late original request is rejected before cart/address processing.
        assert send(client, "/api/v1/checkout/place-order/", body)[0] == 409
        assert not CheckoutAttempt.objects.filter(cart=owned).exists()
        assert send(client, RECOVER + "?unexpected=1", body)[0] == 400
        foreign = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()), NoRedirect()
        )
        assert send(foreign, RECOVER, body)[0] == 404
        assert send(client, RECOVER)[0] == 405
        # Reject malformed nested evidence, rather than merely failing later
        # because this disposable Cart is empty.
        address = {
            "full_name": "Proxy Test",
            "phone": "+15551234567",
            "line1": "123 Test Street",
            "city": "Austin",
            "state": "TX",
            "postal_code": "78701",
            "country": "US",
        }
        for path, field, invalid in (
            ("place-order", "shipping_address", {**address, "full_name": None}),
            ("place-order", "billing_address", {**address, "phone": 123}),
            ("quote", "shipping_address", {**address, "line1": "x" * 256}),
            ("quote", "shipping_address", {**address, "untrusted_metadata": "discard-me"}),
        ):
            code, value = send(
                client,
                f"/api/v1/checkout/{path}/",
                {"shipping_address": address, field: invalid},
            )
            assert code == 400 and field in value
            assert "discard-me" not in json.dumps(value)
        assert not owned.items.exists()
        assert not CheckoutAttempt.objects.filter(cart=owned).exists()
    finally:
        if cart_id is not None and session_key is not None:
            carts = Cart.objects.filter(pk=cart_id, user__isnull=True, session_key=session_key)
            if CheckoutAttempt.objects.filter(cart__in=carts).exists():
                raise RuntimeError(
                    "Unexpected order evidence on the disposable cart; cleanup stopped."
                )
            carts.delete()
            Session.objects.filter(session_key=session_key).delete()
            assert not CheckoutAttemptCancellation.objects.filter(cart_id=cart_id).exists()
    print(
        "PASS: proxied guest recovery, CSRF, durable closure, late rejection, "
        "isolation, strict address inputs and cleanup."
    )


if __name__ == "__main__":
    main()
