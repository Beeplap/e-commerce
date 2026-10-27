import re
from typing import Any

from rest_framework import serializers
from rest_framework.exceptions import ValidationError

from apps.accounts.serializers import StrictSerializer
from apps.finance.models import Payout, SellerBalance, SellerLedgerEntry
from apps.orders.models import Order

CURRENCY_PATTERN = r"^[A-Z]{3}$"
MAX_REPORTING_CURRENCIES = 256


class ReportingCurrencyFilterSerializer(StrictSerializer):
    currency = serializers.RegexField(CURRENCY_PATTERN, default="USD")

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        # QueryDict's HTML-form handling otherwise replaces an explicit blank with the default.
        if "currency" in self.initial_data and not str(self.initial_data["currency"]).strip():
            raise serializers.ValidationError({"currency": "A currency code is required."})
        return attrs


def reporting_currencies(currency: str) -> list[str]:
    """One bounded query over snapshot currencies; no FX or seller-setting relabeling."""
    if not re.fullmatch(CURRENCY_PATTERN, currency):
        raise ValidationError({"currency": "Use a three-letter uppercase currency code."})
    rows = (
        Order.objects.order_by()
        .values_list("currency", flat=True)
        .union(
            SellerBalance.objects.order_by().values_list("currency", flat=True),
            Payout.objects.order_by().values_list("currency", flat=True),
            SellerLedgerEntry.objects.order_by().values_list("currency", flat=True),
        )
        .order_by("currency")[: MAX_REPORTING_CURRENCIES + 1]
    )
    currencies = set(rows) | {"USD", currency}
    if len(currencies) > MAX_REPORTING_CURRENCIES or any(
        not re.fullmatch(CURRENCY_PATTERN, code) for code in currencies
    ):
        raise ValidationError({"currency": "Reporting currency data requires reconciliation."})
    return sorted(currencies)
