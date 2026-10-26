from typing import Any

from django.core.management.base import BaseCommand, CommandError
from django.db.models import F, Q

from apps.finance.models import Payout, SellerBalance, SellerLedgerEntry
from apps.orders.models import SellerOrder


class Command(BaseCommand):
    help = "Read-only currency consistency check. Never relabel or repair financial history."

    def handle(self, *args: Any, **options: Any) -> None:
        counts = {
            "balances": SellerBalance.objects.exclude(
                currency=F("seller__default_currency")
            ).count(),
            "payouts": Payout.objects.exclude(currency=F("seller__default_currency")).count(),
            "seller_orders": SellerOrder.objects.exclude(
                order__currency=F("seller__default_currency")
            ).count(),
            "ledger_entries": SellerLedgerEntry.objects.filter(
                ~Q(currency=F("seller__default_currency"))
                | (Q(seller_order__isnull=False) & ~Q(currency=F("seller_order__order__currency")))
                | (Q(payout__isnull=False) & ~Q(currency=F("payout__currency")))
            ).count(),
        }
        for name, count in counts.items():
            self.stdout.write(f"{name}: {count}")
        if any(counts.values()):
            raise CommandError(
                "Currency inconsistencies require operator reconciliation. No records changed."
            )
        self.stdout.write(
            self.style.SUCCESS("Financial currency audit passed. No records changed.")
        )
