"""Short-lived evidence of a reviewed quote; never an authorization credential."""

import json
from typing import Any

from django.core import signing
from django.utils.crypto import constant_time_compare, salted_hmac
from rest_framework.exceptions import APIException

from apps.cart.models import Cart

REVIEW_MAX_AGE = 15 * 60
SALT = "checkout.review.v1"
ADDRESS_FIELDS = ("full_name", "phone", "line1", "line2", "city", "state", "postal_code", "country")


class ReviewConflict(APIException):
    status_code = 409
    default_code = "checkout_review_changed"

    def __init__(self) -> None:
        super().__init__(
            {"quote_token": ["Your order review changed or expired. Review it again."]}
        )


def address_snapshot(address: dict[str, Any]) -> dict[str, str]:
    result = {field: str(address.get(field, "")).strip() for field in ADDRESS_FIELDS}
    result["country"] = str(address.get("country", "US")).strip().upper()
    return result


def review_digest(cart: Cart, address: dict[str, Any], quote: dict[str, Any]) -> str:
    # HMAC, rather than an ordinary hash, prevents guessing private address values.
    # Stock counts and unselected delivery offers are deliberately not price promises.
    sellers = []
    for seller in sorted(quote["sellers"], key=lambda entry: entry["seller_id"]):
        sellers.append(
            {
                **{
                    key: value
                    for key, value in seller.items()
                    if key not in ("items", "available_shipping_methods")
                },
                "items": [
                    {
                        key: value
                        for key, value in item.items()
                        if key not in ("available_stock", "is_in_stock")
                    }
                    for item in sorted(seller["items"], key=lambda entry: entry["item_id"])
                ],
            }
        )
    evidence = {
        "cart": str(cart.pk),
        "customer": str(cart.user_id) if cart.user_id else None,
        "address": address_snapshot(address),
        "quote": {**quote, "sellers": sellers},
    }
    encoded = json.dumps(evidence, sort_keys=True, separators=(",", ":"))
    return salted_hmac(SALT, encoded, algorithm="sha256").hexdigest()


def issue_review(cart: Cart, address: dict[str, Any], quote: dict[str, Any]) -> str:
    return signing.TimestampSigner(salt=SALT).sign(review_digest(cart, address, quote))


def verify_review(token: str, cart: Cart, address: dict[str, Any], quote: dict[str, Any]) -> None:
    try:
        digest = signing.TimestampSigner(salt=SALT).unsign(token, max_age=REVIEW_MAX_AGE)
    except signing.BadSignature:
        raise ReviewConflict() from None
    if not constant_time_compare(digest, review_digest(cart, address, quote)):
        raise ReviewConflict()
