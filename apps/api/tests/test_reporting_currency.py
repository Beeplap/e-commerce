from datetime import timedelta
from decimal import Decimal
from typing import Any

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.catalog.models import Category, Product
from apps.finance.models import Payout, SellerBalance, SellerLedgerEntry
from apps.fulfillment.models import Refund, ReturnRequest
from apps.orders.models import Order, OrderItem, SellerOrder
from apps.platform_access.models import PlatformAccess, PlatformRole
from apps.sellers.models import Seller

pytestmark = pytest.mark.django_db
FINANCE = "/api/v1/admin/finance/summary"
DASHBOARD = "/api/v1/admin/analytics/dashboard"


@pytest.fixture
def reports() -> dict[str, Any]:
    admin = User.objects.create_user("report-admin@example.invalid")
    PlatformAccess.objects.create(user=admin, role=PlatformRole.objects.get(name="SUPER_ADMIN"))
    browser = APIClient(enforce_csrf_checks=True)
    browser.force_login(admin, backend="django.contrib.auth.backends.ModelBackend")
    category = Category.objects.create(name="Shared category", slug="report-shared-category")
    result: dict[str, Any] = {"client": browser, "admin": admin}
    for currency, multiplier in [("USD", 1), ("NPR", 10)]:
        seller = Seller.objects.create(
            legal_name=currency,
            display_name=currency,
            slug=f"report-{currency.lower()}",
            email=f"{currency.lower()}@example.invalid",
            default_currency=currency,
            status=Seller.Status.ACTIVE,
        )
        amount = Decimal("10.00") * multiplier
        order = Order.objects.create(
            order_number=f"REPORT-{currency}",
            customer=admin,
            currency=currency,
            subtotal=amount,
            grand_total=amount,
            payment_status=Order.PaymentStatus.PAID,
        )
        seller_order = SellerOrder.objects.create(
            order=order,
            seller=seller,
            seller_order_number=f"REPORT-SO-{currency}",
            status=SellerOrder.Status.DELIVERED,
            subtotal=amount,
            commission_total=amount / 10,
            seller_net_total=amount * Decimal("0.9"),
        )
        product = Product.objects.create(
            created_by=admin,
            seller=seller,
            category=category,
            name=f"{currency} product",
            slug=f"report-{currency.lower()}",
        )
        OrderItem.objects.create(
            seller_order=seller_order,
            product=product,
            product_name_snapshot=product.name,
            sku_snapshot=currency,
            quantity=1,
            unit_price=amount,
            total=amount,
            commission_amount=amount / 10,
            seller_net_amount=amount * Decimal("0.9"),
        )
        SellerBalance.objects.create(
            seller=seller,
            currency=currency,
            current_balance=Decimal(20 * multiplier),
            pending_balance=Decimal(3 * multiplier),
            total_paid_out=Decimal(7 * multiplier),
        )
        for kind, value in [("SALE", amount), ("COMMISSION", -amount / 10)]:
            SellerLedgerEntry.objects.create(
                seller=seller,
                seller_order=seller_order,
                entry_type=kind,
                amount=value,
                balance_after=value,
                currency=currency,
            )
        Payout.objects.create(
            seller=seller,
            payout_number=f"REPORT-PO-{currency}",
            amount=4 * multiplier,
            currency=currency,
        )
        Refund.objects.create(
            seller=seller,
            seller_order=seller_order,
            refund_number=f"REPORT-REF-{currency}",
            amount=multiplier,
            currency=currency,
            status=Refund.Status.COMPLETED,
        )
        result[currency] = {"seller": seller, "order": order, "seller_order": seller_order}
    ReturnRequest.objects.create(
        seller=result["USD"]["seller"],
        seller_order=result["USD"]["seller_order"],
        customer=admin,
        return_number="REPORT-RETURN-USD",
        reason="Return",
    )
    return result


@pytest.mark.parametrize("currency,multiplier", [("USD", 1), ("NPR", 10)])
def test_finance_never_combines_currencies(
    reports: dict[str, Any], currency: str, multiplier: int
) -> None:
    response = reports["client"].get(FINANCE, {"currency": currency})
    assert response.status_code == 200, response.data
    assert response.data["currency"] == currency
    assert response.data["available_currencies"] == ["NPR", "USD"]
    for field, value in {
        "total_gross_sales": 10,
        "total_commissions": 1,
        "total_available_balances": 20,
        "total_pending_balances": 3,
        "total_paid_out": 7,
    }.items():
        assert Decimal(response.data[field]) == value * multiplier
    assert response.data["pending_payouts_count"] == 1


@pytest.mark.parametrize("currency,multiplier", [("USD", 1), ("NPR", 10)])
def test_dashboard_filters_metrics_trends_rankings_and_rates(
    reports: dict[str, Any], currency: str, multiplier: int
) -> None:
    response = reports["client"].get(DASHBOARD, {"currency": currency})
    assert response.status_code == 200, response.data
    data = response.data
    assert data["currency"] == currency
    assert data["available_currencies"] == ["NPR", "USD"]
    assert Decimal(data["gmv"]) == 10 * multiplier
    assert Decimal(data["platform_revenue"]) == multiplier
    assert Decimal(data["average_order_value"]) == 10 * multiplier
    assert Decimal(data["outstanding_seller_balances"]) == 20 * multiplier
    assert Decimal(data["upcoming_payouts"]) == 4 * multiplier
    assert data["orders_count"] == 1
    assert data["refund_rate"] == 100
    assert data["return_rate"] == (100 if currency == "USD" else 0)
    assert data["active_sellers"] == 2  # Explicitly marketplace-wide, not currency-filtered.
    assert len(data["top_sellers"]) == 1
    assert data["top_sellers"][0]["id"] == str(reports[currency]["seller"].pk)
    assert Decimal(data["top_categories"][0]["revenue"]) == 10 * multiplier
    assert data["top_categories"][0]["orders_count"] == 1
    assert Decimal(data["sales_over_time"][0]["gmv"]) == 10 * multiplier


@pytest.mark.parametrize("endpoint", [FINANCE, DASHBOARD])
def test_omitted_currency_is_explicitly_usd(reports: dict[str, Any], endpoint: str) -> None:
    response = reports["client"].get(endpoint)
    assert response.status_code == 200
    assert response.data["currency"] == "USD"
    field = "gmv" if endpoint == DASHBOARD else "total_gross_sales"
    assert Decimal(response.data[field]) == 10


@pytest.mark.parametrize("endpoint", [FINANCE, DASHBOARD])
@pytest.mark.parametrize(
    "query",
    ["currency=usd", "currency=US", "currency=", "currency=USD&currency=NPR", "seller_id=ignored"],
)
def test_reporting_rejects_invalid_or_unallowlisted_queries(
    reports: dict[str, Any], endpoint: str, query: str
) -> None:
    assert reports["client"].get(f"{endpoint}?{query}").status_code == 400


@pytest.mark.parametrize("endpoint", [FINANCE, DASHBOARD])
def test_currency_options_require_platform_authority(
    reports: dict[str, Any], endpoint: str
) -> None:
    regular = User.objects.create_user("report-regular@example.invalid")
    browser = APIClient()
    browser.force_authenticate(regular)
    response = browser.get(endpoint, {"currency": "NPR"})
    assert response.status_code == 403
    assert "available_currencies" not in response.data


def test_empty_selected_currency_is_zero_without_borrowing_another_currency(
    reports: dict[str, Any],
) -> None:
    for endpoint in [FINANCE, DASHBOARD]:
        response = reports["client"].get(endpoint, {"currency": "EUR"})
        assert response.status_code == 200
        assert response.data["currency"] == "EUR"
        assert "EUR" in response.data["available_currencies"]
        field = "gmv" if endpoint == DASHBOARD else "total_gross_sales"
        assert Decimal(response.data[field]) == 0


def test_dashboard_rejects_invalid_reversed_and_unbounded_dates(reports: dict[str, Any]) -> None:
    now = timezone.now()
    for query in [
        {"start_date": "not-a-date"},
        {"start_date": now.isoformat(), "end_date": (now - timedelta(days=1)).isoformat()},
        {"start_date": (now - timedelta(days=367)).isoformat(), "end_date": now.isoformat()},
    ]:
        assert reports["client"].get(DASHBOARD, query).status_code == 400


def test_daily_order_count_does_not_double_count_seller_packages(reports: dict[str, Any]) -> None:
    seller = Seller.objects.create(
        legal_name="Another USD seller",
        display_name="Another USD seller",
        slug="report-usd-extra",
        email="usd-extra@example.invalid",
        default_currency="USD",
        status=Seller.Status.ACTIVE,
    )
    order = reports["USD"]["order"]
    seller_order = SellerOrder.objects.create(
        order=order, seller=seller, seller_order_number="REPORT-USD-EXTRA", subtotal=Decimal("5.00")
    )
    category = Category.objects.get(slug="report-shared-category")
    product = Product.objects.create(
        seller=seller,
        category=category,
        created_by=reports["admin"],
        name="Extra USD product",
        slug="report-extra",
    )
    OrderItem.objects.create(
        seller_order=seller_order,
        product=product,
        product_name_snapshot=product.name,
        sku_snapshot="extra",
        quantity=1,
        unit_price=Decimal("5.00"),
        total=Decimal("5.00"),
        seller_net_amount=Decimal("5.00"),
    )
    data = reports["client"].get(DASHBOARD, {"currency": "USD"}).data
    assert data["orders_count"] == 1
    assert Decimal(data["gmv"]) == 15
    assert data["sales_over_time"][0]["orders_count"] == 1
    assert data["top_categories"][0]["orders_count"] == 1


def test_order_reporting_uses_historical_currency_instead_of_current_seller_label(
    reports: dict[str, Any],
) -> None:
    # Legacy inconsistent order snapshots remain denominated as recorded, without FX/relabeling.
    order = Order.objects.create(order_number="LEGACY-USD-FOR-NPR-SELLER", currency="USD")
    SellerOrder.objects.create(
        order=order,
        seller=reports["NPR"]["seller"],
        seller_order_number="LEGACY-USD-SO",
        subtotal=Decimal("5.00"),
    )
    usd = reports["client"].get(DASHBOARD, {"currency": "USD"}).data
    npr = reports["client"].get(DASHBOARD, {"currency": "NPR"}).data
    assert Decimal(usd["gmv"]) == 15
    assert Decimal(npr["gmv"]) == 100


def test_invalid_legacy_currency_is_reported_instead_of_relabelled(reports: dict[str, Any]) -> None:
    Order.objects.create(order_number="MALFORMED-LEGACY-CURRENCY", currency="usd")
    for endpoint in [FINANCE, DASHBOARD]:
        response = reports["client"].get(endpoint)
        assert response.status_code == 400
        assert "currency" in response.data
        assert "available_currencies" not in response.data
