from typing import Any
from unittest.mock import patch

import pytest
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.test import APIClient, APIRequestFactory

from apps.cart.models import Cart, CartItem
from apps.checkout import services
from apps.checkout.models import CheckoutAttempt, CustomerAddress
from apps.events.models import OutboxEvent
from apps.inventory.models import InventoryTransaction
from apps.orders.models import Order
from tests.test_phase20_checkout import build_checkout_setup_data
from tests.test_phase21_payments import ADDRESS, customer_client

pytestmark = pytest.mark.django_db
PLACE = "/api/v1/checkout/place-order/"
QUOTE = "/api/v1/checkout/quote/"


@pytest.fixture
def setup() -> dict[str, Any]:
    data = build_checkout_setup_data()
    cart = Cart.objects.create(user=data["customer"])
    CartItem.objects.create(cart=cart, variant=data["variant_1"], quantity=2)
    return {**data, "cart": cart, "client": customer_client(data["customer"])}


@pytest.mark.parametrize(
    "field,value",
    [
        ("full_name", None),
        ("phone", {"value": "123"}),
        ("city", 123),
        ("line1", ["Main street"]),
        ("state", False),
        ("postal_code", "\n78701"),
    ],
)
def test_placement_rejects_non_text_shipping_before_business_writes(
    setup: dict[str, Any], field: str, value: Any
) -> None:
    response = setup["client"].post(
        PLACE,
        {
            "shipping_address": {**ADDRESS, field: value},
            "idempotency_key": "invalid-address-attempt",
        },
        format="json",
    )
    assert response.status_code == 400
    assert not Order.objects.exists()
    assert not CheckoutAttempt.objects.exists()
    assert not InventoryTransaction.objects.exists()
    assert not OutboxEvent.objects.exists()
    assert setup["cart"].items.get().quantity == 2


def test_billing_rejects_arbitrary_snapshot_keys(setup: dict[str, Any]) -> None:
    response = setup["client"].post(
        PLACE,
        {
            "shipping_address": ADDRESS,
            "billing_address": {**ADDRESS, "secret_configuration": "do-not-retain-this-value"},
        },
        format="json",
    )
    assert response.status_code == 400
    assert "do-not-retain-this-value" not in str(response.data)
    assert not Order.objects.exists()


@pytest.mark.parametrize(
    "field,maximum",
    [
        ("full_name", 120),
        ("phone", 32),
        ("line1", 255),
        ("line2", 255),
        ("city", 100),
        ("state", 100),
        ("postal_code", 32),
    ],
)
def test_all_address_entry_points_reject_oversized_fields(
    setup: dict[str, Any], field: str, maximum: int
) -> None:
    invalid = {**ADDRESS, field: "x" * (maximum + 1)}
    client = setup["client"]
    for url, body in [
        (QUOTE, {"shipping_address": invalid}),
        (PLACE, {"shipping_address": invalid}),
        (PLACE, {"shipping_address": ADDRESS, "billing_address": invalid}),
        ("/api/v1/checkout/addresses/", invalid),
    ]:
        response = client.post(url, body, format="json")
        assert response.status_code == 400
    assert not Order.objects.exists()
    assert not CustomerAddress.objects.exists()
    assert not InventoryTransaction.objects.exists()


@pytest.mark.parametrize("country", ["12", "1A", "éé", "USA", " "])
def test_country_format_is_consistent_for_shipping_billing_and_saved_addresses(
    setup: dict[str, Any], country: str
) -> None:
    invalid = {**ADDRESS, "country": country}
    for url, body in [
        (QUOTE, {"shipping_address": invalid}),
        (PLACE, {"shipping_address": invalid}),
        (PLACE, {"shipping_address": ADDRESS, "billing_address": invalid}),
        ("/api/v1/checkout/addresses/", invalid),
    ]:
        assert setup["client"].post(url, body, format="json").status_code == 400
    assert not Order.objects.exists()
    assert not CustomerAddress.objects.exists()


@pytest.mark.parametrize("field", ["full_name", "phone", "line1", "city", "state", "postal_code"])
def test_complete_destinations_require_each_mandatory_field(
    setup: dict[str, Any], field: str
) -> None:
    incomplete = {key: value for key, value in ADDRESS.items() if key != field}
    for body in (
        {"shipping_address": incomplete},
        {"shipping_address": ADDRESS, "billing_address": incomplete},
    ):
        assert setup["client"].post(PLACE, body, format="json").status_code == 400
    assert not Order.objects.exists()


@pytest.mark.parametrize("field", ["user_id", "seller_id", "id", "is_default"])
def test_shipping_and_quote_reject_unrecognized_nested_fields(
    setup: dict[str, Any], field: str
) -> None:
    address = {**ADDRESS, field: "system-field-value"}
    for url in (QUOTE, PLACE):
        response = setup["client"].post(url, {"shipping_address": address}, format="json")
        assert response.status_code == 400
        assert "system-field-value" not in str(response.data)
    assert not Order.objects.exists()


def test_partial_delivery_estimate_is_allowed_but_complete_placement_is_required(
    setup: dict[str, Any],
) -> None:
    client = setup["client"]
    assert (
        client.post(QUOTE, {"shipping_address": {"country": "us"}}, format="json").status_code
        == 200
    )
    assert client.post(QUOTE, {}, format="json").status_code == 200
    for field in ("shipping_address", "billing_address"):
        body = {"shipping_address": ADDRESS, field: {"country": "US"}}
        assert client.post(PLACE, body, format="json").status_code == 400
    assert (
        client.post(
            PLACE, {"shipping_address": ADDRESS, "billing_address": {}}, format="json"
        ).status_code
        == 400
    )
    assert not Order.objects.exists()


def test_normalized_reviewed_snapshots_and_exact_replay_preserve_original_evidence(
    setup: dict[str, Any],
) -> None:
    shipping = {**ADDRESS, "full_name": " Alice Smith ", "country": " us "}
    billing = {**ADDRESS, "line1": " 80 Billing Street ", "country": " us "}
    client = setup["client"]
    quote = client.post(QUOTE, {"shipping_address": shipping}, format="json")
    assert quote.status_code == 200
    body = {
        "cart_id": str(setup["cart"].pk),
        "quote_token": quote.data["quote_token"],
        "idempotency_key": "normalized-address-original-attempt",
        "shipping_address": shipping,
        "billing_address": billing,
    }
    placed = client.post(PLACE, body, format="json")
    assert placed.status_code == 201
    order = Order.objects.get(pk=placed.data["order_id"])
    assert order.shipping_address_snapshot == {**ADDRESS, "line2": ""}
    assert order.billing_address_snapshot == {**ADDRESS, "line1": "80 Billing Street", "line2": ""}
    CartItem.objects.create(cart=setup["cart"], variant=setup["variant_1"], quantity=1)
    with patch("django.core.signing.time.time", return_value=10**12):
        replay = client.post(PLACE, body, format="json")
    assert replay.status_code == 201
    assert replay.data == placed.data
    assert setup["cart"].items.get().quantity == 1
    assert Order.objects.count() == 1
    # Semantically equal normalization must not change an original retry payload.
    changed = {**body, "shipping_address": {**shipping, "full_name": "Alice Smith"}}
    assert client.post(PLACE, changed, format="json").status_code == 409


def test_service_boundaries_cannot_bypass_address_validation(setup: dict[str, Any]) -> None:
    with pytest.raises(ValidationError):
        services.create_customer_address(setup["customer"], {**ADDRESS, "full_name": None})
    address = services.create_customer_address(setup["customer"], ADDRESS)
    with pytest.raises(ValidationError):
        services.update_customer_address(setup["customer"], address.pk, {"phone": {"bad": True}})
    address.refresh_from_db()
    assert address.phone == ADDRESS["phone"]
    with pytest.raises(ValidationError):
        services.calculate_checkout_quote(cart=setup["cart"], shipping_address={"city": 123})


def test_saved_address_patch_preserves_omitted_fields_and_ownership(setup: dict[str, Any]) -> None:
    client = setup["client"]
    address = client.post(
        "/api/v1/checkout/addresses/", {**ADDRESS, "country": " np "}, format="json"
    )
    assert address.status_code == 201
    url = f"/api/v1/checkout/addresses/{address.data['id']}/"
    changed = client.patch(url, {"city": " Kathmandu "}, format="json")
    assert changed.status_code == 200
    assert changed.data["country"] == "NP"
    assert changed.data["city"] == "Kathmandu"
    assert changed.data["phone"] == ADDRESS["phone"]
    foreign = customer_client(setup["other_customer"])
    assert foreign.patch(url, {"city": "Foreign mutation"}, format="json").status_code == 404
    assert client.patch(url, {"country": "12"}, format="json").status_code == 400


@pytest.mark.parametrize("field", ["shipping_address_data", "billing_address_data"])
def test_direct_placement_services_reject_malformed_snapshots(
    setup: dict[str, Any], field: str
) -> None:
    request = Request(APIRequestFactory().post(PLACE))
    request.user = setup["customer"]
    invalid = {**ADDRESS, "phone": {"bad": True}}
    with pytest.raises(ValidationError):
        services.place_order(
            request=request,
            shipping_address_data=invalid if field == "shipping_address_data" else ADDRESS,
            billing_address_data=invalid if field == "billing_address_data" else None,
        )
    assert not Order.objects.exists()
    assert not InventoryTransaction.objects.exists()


def test_valid_maximum_lengths_and_unicode_are_preserved(setup: dict[str, Any]) -> None:
    address = {
        "full_name": "界" * 120,
        "phone": "1" * 32,
        "line1": "界" * 255,
        "line2": "x" * 255,
        "city": "界" * 100,
        "state": "x" * 100,
        "postal_code": "1" * 32,
        "country": "us",
    }
    client = setup["client"]
    saved = client.post("/api/v1/checkout/addresses/", address, format="json")
    assert saved.status_code == 201
    assert saved.data["full_name"] == address["full_name"]
    assert client.post(QUOTE, {"shipping_address": address}, format="json").status_code == 200
    response = client.post(
        PLACE, {"shipping_address": address, "billing_address": address}, format="json"
    )
    assert response.status_code == 201
    order = Order.objects.get(pk=response.data["order_id"])
    assert order.shipping_address_snapshot == {**address, "country": "US"}
    assert order.billing_address_snapshot == order.shipping_address_snapshot


def test_explicit_null_billing_defaults_to_validated_shipping(setup: dict[str, Any]) -> None:
    response = setup["client"].post(
        PLACE, {"shipping_address": ADDRESS, "billing_address": None}, format="json"
    )
    assert response.status_code == 201
    order = Order.objects.get(pk=response.data["order_id"])
    assert order.billing_address_snapshot == order.shipping_address_snapshot
    assert order.billing_address_snapshot["line2"] == ""


def test_guest_bad_address_is_rejected_and_real_csrf_is_still_required(
    setup: dict[str, Any],
) -> None:
    guest = APIClient()
    assert (
        guest.post(
            "/api/v1/cart/items/", {"variant_id": str(setup["variant_1"].pk)}, format="json"
        ).status_code
        == 201
    )
    body = {"shipping_address": {**ADDRESS, "city": None}, "customer_email": "guest@example.com"}
    assert guest.post(PLACE, body, format="json").status_code == 400
    strict = APIClient(enforce_csrf_checks=True)
    assert strict.post(PLACE, {"shipping_address": ADDRESS}, format="json").status_code == 403
    assert strict.post(QUOTE, {"shipping_address": ADDRESS}, format="json").status_code == 403
    assert not Order.objects.exists()


def test_pre_hardening_valid_request_digest_and_replay_remain_compatible(
    setup: dict[str, Any],
) -> None:
    # This fixed digest is from the previous raw-address wire contract, including
    # whitespace and an omitted line2. Normalization must not silently change it.
    body = {
        "shipping_address": {**ADDRESS, "full_name": " Alice Smith ", "country": " us "},
        "idempotency_key": "legacy-address-original-attempt",
    }
    client = setup["client"]
    placed = client.post(PLACE, body, format="json")
    assert placed.status_code == 201
    assert CheckoutAttempt.objects.get().request_digest == (
        "206da15dfc180d125fe03817a056d539e8db7f0dd9b683d494116e15d5eb898e"
    )
    replay = client.post(PLACE, body, format="json")
    assert replay.status_code == 201
    assert replay.data == placed.data
    assert Order.objects.count() == 1
