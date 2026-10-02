from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any

from django.db.models import Count, F, Q, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone

from apps.accounts.models import User
from apps.finance.models import Payout, SellerBalance
from apps.fulfillment.models import Refund, ReturnRequest
from apps.inventory.models import Inventory
from apps.orders.models import Order, OrderItem, SellerOrder
from apps.sellers.models import Seller


def parse_date_range(
    start_str: str | None = None, end_str: str | None = None
) -> tuple[datetime, datetime]:
    now = timezone.now()
    if end_str:
        try:
            end = datetime.fromisoformat(end_str.replace("Z", "+00:00"))
            if timezone.is_naive(end):
                end = timezone.make_aware(end)
        except ValueError:
            end = now
    else:
        end = now

    if start_str:
        try:
            start = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
            if timezone.is_naive(start):
                start = timezone.make_aware(start)
        except ValueError:
            start = end - timedelta(days=30)
    else:
        start = end - timedelta(days=30)

    if start > end:
        start, end = end - timedelta(days=30), end

    return start, end


def get_seller_dashboard_metrics(
    seller: Seller,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
) -> dict[str, Any]:
    """Calculate authoritative dashboard metrics scoped strictly to a single seller."""
    now = timezone.now()
    if not start_date or not end_date:
        start_date = start_date or (now - timedelta(days=30))
        end_date = end_date or now

    # Exclude cancelled orders from financial metric aggregations
    non_cancelled_orders = SellerOrder.objects.filter(
        seller=seller,
        created_at__gte=start_date,
        created_at__lte=end_date,
    ).exclude(status=SellerOrder.Status.CANCELLED)

    financials = non_cancelled_orders.aggregate(
        gross_sales=Sum("subtotal"),
        net_sales=Sum("seller_net_total"),
        platform_fees=Sum("commission_total"),
    )
    gross_sales = financials["gross_sales"] or Decimal("0.00")
    net_sales = financials["net_sales"] or Decimal("0.00")
    platform_fees = financials["platform_fees"] or Decimal("0.00")

    all_orders_count = SellerOrder.objects.filter(
        seller=seller,
        created_at__gte=start_date,
        created_at__lte=end_date,
    ).count()

    non_cancelled_count = non_cancelled_orders.count()
    if non_cancelled_count > 0:
        aov = (gross_sales / non_cancelled_count).quantize(Decimal("0.01"))
    else:
        aov = Decimal("0.00")

    units_sold = (
        OrderItem.objects.filter(
            seller_order__seller=seller,
            seller_order__created_at__gte=start_date,
            seller_order__created_at__lte=end_date,
        )
        .exclude(seller_order__status=SellerOrder.Status.CANCELLED)
        .aggregate(total_units=Sum("quantity"))["total_units"]
        or 0
    )

    pending_orders = SellerOrder.objects.filter(
        seller=seller,
        status__in=[
            SellerOrder.Status.PENDING,
            SellerOrder.Status.CONFIRMED,
            SellerOrder.Status.PROCESSING,
        ],
    ).count()

    low_stock_variants = (
        Inventory.objects.filter(warehouse__seller=seller)
        .filter(Q(quantity_on_hand__lte=F("quantity_reserved") + F("reorder_level")))
        .count()
    )

    returns_count = ReturnRequest.objects.filter(
        seller=seller,
        requested_at__gte=start_date,
        requested_at__lte=end_date,
    ).count()

    # Seller balance and payout info
    try:
        balance_obj = SellerBalance.objects.get(seller=seller)
        available_balance = balance_obj.current_balance
        pending_balance = balance_obj.pending_balance
        total_paid_out = balance_obj.total_paid_out
    except SellerBalance.DoesNotExist:
        available_balance = Decimal("0.00")
        pending_balance = Decimal("0.00")
        total_paid_out = Decimal("0.00")

    last_payout = (
        Payout.objects.filter(seller=seller)
        .order_by("-created_at")
        .values("amount", "status", "created_at", "processed_at")
        .first()
    )
    payout_info = {
        "total_paid_out": str(total_paid_out),
        "last_payout_amount": str(last_payout["amount"]) if last_payout else None,
        "last_payout_status": last_payout["status"] if last_payout else None,
        "last_payout_date": (
            last_payout["created_at"].isoformat()
            if last_payout and last_payout["created_at"]
            else None
        ),
    }

    # Top products by revenue
    top_products_qs = (
        OrderItem.objects.filter(
            seller_order__seller=seller,
            seller_order__created_at__gte=start_date,
            seller_order__created_at__lte=end_date,
        )
        .exclude(seller_order__status=SellerOrder.Status.CANCELLED)
        .values("product_id", "product_name_snapshot")
        .annotate(units_sold=Sum("quantity"), revenue=Sum("total"))
        .order_by("-revenue")[:5]
    )
    top_products = [
        {
            "id": str(p["product_id"]),
            "name": p["product_name_snapshot"],
            "units_sold": p["units_sold"],
            "revenue": str(p["revenue"] or Decimal("0.00")),
        }
        for p in top_products_qs
    ]

    # Sales over time (daily)
    sales_over_time_qs = (
        non_cancelled_orders.annotate(date=TruncDate("created_at"))
        .values("date")
        .annotate(
            gross_sales=Sum("subtotal"),
            net_sales=Sum("seller_net_total"),
            orders_count=Count("id"),
        )
        .order_by("date")
    )
    sales_over_time = [
        {
            "date": row["date"].isoformat(),
            "gross_sales": str(row["gross_sales"] or Decimal("0.00")),
            "net_sales": str(row["net_sales"] or Decimal("0.00")),
            "orders_count": row["orders_count"],
        }
        for row in sales_over_time_qs
    ]

    return {
        "date_range": {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
        },
        "gross_sales": str(gross_sales),
        "net_sales": str(net_sales),
        "orders_count": all_orders_count,
        "average_order_value": str(aov),
        "units_sold": units_sold,
        "pending_orders": pending_orders,
        "low_stock_variants": low_stock_variants,
        "returns_count": returns_count,
        "platform_fees": str(platform_fees),
        "available_balance": str(available_balance),
        "pending_balance": str(pending_balance),
        "payout_info": payout_info,
        "top_products": top_products,
        "sales_over_time": sales_over_time,
    }


def get_platform_dashboard_metrics(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
) -> dict[str, Any]:
    """Calculate authoritative platform-wide dashboard metrics for Super Admins."""
    now = timezone.now()
    if not start_date or not end_date:
        start_date = start_date or (now - timedelta(days=30))
        end_date = end_date or now

    non_cancelled_seller_orders = SellerOrder.objects.filter(
        created_at__gte=start_date,
        created_at__lte=end_date,
    ).exclude(status=SellerOrder.Status.CANCELLED)

    financials = non_cancelled_seller_orders.aggregate(
        gmv=Sum("subtotal"),
        platform_revenue=Sum("commission_total"),
    )
    gmv = financials["gmv"] or Decimal("0.00")
    platform_revenue = financials["platform_revenue"] or Decimal("0.00")

    total_orders = Order.objects.filter(
        created_at__gte=start_date,
        created_at__lte=end_date,
    ).count()

    aov = (gmv / total_orders).quantize(Decimal("0.01")) if total_orders > 0 else Decimal("0.00")

    active_sellers_count = Seller.objects.filter(status=Seller.Status.ACTIVE).count()
    pending_seller_approvals = Seller.objects.filter(status=Seller.Status.PENDING).count()
    new_seller_registrations = Seller.objects.filter(
        created_at__gte=start_date,
        created_at__lte=end_date,
    ).count()

    customers_count = User.objects.filter(orders__isnull=False).distinct().count()

    refunds_count = Refund.objects.filter(
        created_at__gte=start_date,
        created_at__lte=end_date,
    ).count()
    refund_rate = round((refunds_count / total_orders) * 100, 2) if total_orders > 0 else 0.0

    returns_count = ReturnRequest.objects.filter(
        requested_at__gte=start_date,
        requested_at__lte=end_date,
    ).count()
    return_rate = round((returns_count / total_orders) * 100, 2) if total_orders > 0 else 0.0

    balances = SellerBalance.objects.aggregate(
        outstanding=Sum("current_balance"),
    )
    outstanding_seller_balances = balances["outstanding"] or Decimal("0.00")

    upcoming_payouts = Payout.objects.filter(
        status__in=[Payout.Status.PENDING, Payout.Status.APPROVED]
    ).aggregate(upcoming=Sum("amount"))["upcoming"] or Decimal("0.00")

    # Top categories
    top_categories_qs = (
        OrderItem.objects.filter(
            seller_order__created_at__gte=start_date,
            seller_order__created_at__lte=end_date,
            product__category__isnull=False,
        )
        .exclude(seller_order__status=SellerOrder.Status.CANCELLED)
        .values("product__category_id", "product__category__name")
        .annotate(revenue=Sum("total"), orders_count=Count("seller_order_id", distinct=True))
        .order_by("-revenue")[:5]
    )
    top_categories = [
        {
            "id": str(c["product__category_id"]),
            "name": c["product__category__name"],
            "revenue": str(c["revenue"] or Decimal("0.00")),
            "orders_count": c["orders_count"],
        }
        for c in top_categories_qs
    ]

    # Top sellers
    top_sellers_qs = (
        non_cancelled_seller_orders.values("seller_id", "seller__display_name")
        .annotate(gross_sales=Sum("subtotal"), orders_count=Count("id"))
        .order_by("-gross_sales")[:5]
    )
    top_sellers = [
        {
            "id": str(s["seller_id"]),
            "name": s["seller__display_name"],
            "gross_sales": str(s["gross_sales"] or Decimal("0.00")),
            "orders_count": s["orders_count"],
        }
        for s in top_sellers_qs
    ]

    # Sales over time (daily)
    sales_over_time_qs = (
        non_cancelled_seller_orders.annotate(date=TruncDate("created_at"))
        .values("date")
        .annotate(
            gmv=Sum("subtotal"),
            platform_revenue=Sum("commission_total"),
            orders_count=Count("id"),
        )
        .order_by("date")
    )
    sales_over_time = [
        {
            "date": row["date"].isoformat(),
            "gmv": str(row["gmv"] or Decimal("0.00")),
            "platform_revenue": str(row["platform_revenue"] or Decimal("0.00")),
            "orders_count": row["orders_count"],
        }
        for row in sales_over_time_qs
    ]

    return {
        "date_range": {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
        },
        "gmv": str(gmv),
        "platform_revenue": str(platform_revenue),
        "commission_revenue": str(platform_revenue),
        "orders_count": total_orders,
        "active_sellers": active_sellers_count,
        "pending_seller_approvals": pending_seller_approvals,
        "customers_count": customers_count,
        "refund_rate": refund_rate,
        "return_rate": return_rate,
        "average_order_value": str(aov),
        "outstanding_seller_balances": str(outstanding_seller_balances),
        "upcoming_payouts": str(upcoming_payouts),
        "new_seller_registrations": new_seller_registrations,
        "top_categories": top_categories,
        "top_sellers": top_sellers,
        "sales_over_time": sales_over_time,
    }
