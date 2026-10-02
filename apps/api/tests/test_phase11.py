from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal
from typing import Any

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.catalog.models import Category, Product, ProductVariant
from apps.finance.models import Payout, SellerBalance
from apps.fulfillment.models import Refund, ReturnRequest
from apps.inventory.models import Inventory, Warehouse
from apps.orders.models import Order, OrderItem, SellerOrder
from apps.platform_access.models import PlatformAccess, PlatformRole
from apps.sellers.models import Seller, SellerMembership, SellerRole

pytestmark = pytest.mark.django_db


class JsonClient(APIClient):
    def post(  # type: ignore[override]
        self,
        path: str,
        data: Any = None,
        format: str = "json",
        content_type: str | None = None,
        follow: bool = False,
        **extra: Any,
    ) -> Any:
        return super().post(
            path, data=data, format=format, content_type=content_type, follow=follow, **extra
        )


def client(user: User) -> APIClient:
    browser = JsonClient(enforce_csrf_checks=True)
    browser.force_login(user, backend="django.contrib.auth.backends.ModelBackend")
    browser.credentials(HTTP_X_CSRFTOKEN=browser.get("/api/v1/auth/csrf").json()["csrf_token"])
    return browser


@dataclass
class Phase11Setup:
    owner_a: User
    owner_b: User
    platform_admin: User
    customer: User
    seller_a: Seller
    seller_b: Seller
    category: Category
    product_a: Product
    product_b: Product
    variant_a: ProductVariant
    variant_b: ProductVariant
    warehouse_a: Warehouse
    warehouse_b: Warehouse


@pytest.fixture
def setup() -> Phase11Setup:
    owner_a = User.objects.create_user(email="owner.a@example.com", password="Password123!")
    owner_b = User.objects.create_user(email="owner.b@example.com", password="Password123!")
    platform_admin = User.objects.create_user(email="admin@example.com", password="Password123!")
    customer = User.objects.create_user(email="customer@example.com", password="Password123!")

    super_admin_role = PlatformRole.objects.get(name="SUPER_ADMIN")
    PlatformAccess.objects.create(user=platform_admin, role=super_admin_role, is_active=True)

    role_owner = SellerRole.objects.get(name="OWNER", seller__isnull=True)

    seller_a = Seller.objects.create(
        legal_name="Alpha Corp",
        display_name="Alpha Store",
        slug="alpha-store",
        email="contact@alpha.com",
        status=Seller.Status.ACTIVE,
        verification_status=Seller.VerificationStatus.VERIFIED,
    )
    seller_b = Seller.objects.create(
        legal_name="Beta Corp",
        display_name="Beta Store",
        slug="beta-store",
        email="contact@beta.com",
        status=Seller.Status.ACTIVE,
        verification_status=Seller.VerificationStatus.VERIFIED,
    )

    SellerMembership.objects.create(
        seller=seller_a,
        user=owner_a,
        role=role_owner,
        status=SellerMembership.Status.ACTIVE,
        joined_at=timezone.now(),
    )
    SellerMembership.objects.create(
        seller=seller_b,
        user=owner_b,
        role=role_owner,
        status=SellerMembership.Status.ACTIVE,
        joined_at=timezone.now(),
    )

    category = Category.objects.create(name="Electronics", slug="electronics")

    product_a = Product.objects.create(
        seller=seller_a,
        category=category,
        name="Alpha Phone",
        slug="alpha-phone",
        created_by=owner_a,
    )
    variant_a = ProductVariant.objects.create(
        seller=seller_a,
        product=product_a,
        sku="SKU-PHONE-A",
        price=Decimal("500.00"),
    )

    product_b = Product.objects.create(
        seller=seller_b,
        category=category,
        name="Beta Tablet",
        slug="beta-tablet",
        created_by=owner_b,
    )
    variant_b = ProductVariant.objects.create(
        seller=seller_b,
        product=product_b,
        sku="SKU-TABLET-B",
        price=Decimal("300.00"),
    )

    warehouse_a = Warehouse.objects.create(seller=seller_a, name="Alpha WH", code="WH-A")
    warehouse_b = Warehouse.objects.create(seller=seller_b, name="Beta WH", code="WH-B")

    # Balances
    SellerBalance.objects.create(
        seller=seller_a,
        currency="USD",
        current_balance=Decimal("1250.00"),
        pending_balance=Decimal("200.00"),
        total_paid_out=Decimal("500.00"),
    )
    SellerBalance.objects.create(
        seller=seller_b,
        currency="USD",
        current_balance=Decimal("800.00"),
        pending_balance=Decimal("100.00"),
        total_paid_out=Decimal("0.00"),
    )

    return Phase11Setup(
        owner_a=owner_a,
        owner_b=owner_b,
        platform_admin=platform_admin,
        customer=customer,
        seller_a=seller_a,
        seller_b=seller_b,
        category=category,
        product_a=product_a,
        product_b=product_b,
        variant_a=variant_a,
        variant_b=variant_b,
        warehouse_a=warehouse_a,
        warehouse_b=warehouse_b,
    )


def test_seller_dashboard_metrics_authoritative_calculation(setup: Phase11Setup) -> None:
    # Create Order 1 for Seller A: $500 subtotal, $50 commission, $450 net
    order1 = Order.objects.create(
        order_number="ORD-001",
        customer=setup.customer,
        currency="USD",
        subtotal=Decimal("500.00"),
        grand_total=Decimal("500.00"),
        payment_status=Order.PaymentStatus.PAID,
    )
    so_a1 = SellerOrder.objects.create(
        order=order1,
        seller=setup.seller_a,
        seller_order_number="SO-A-001",
        status=SellerOrder.Status.CONFIRMED,
        subtotal=Decimal("500.00"),
        commission_total=Decimal("50.00"),
        seller_net_total=Decimal("450.00"),
    )
    OrderItem.objects.create(
        seller_order=so_a1,
        product=setup.product_a,
        variant=setup.variant_a,
        warehouse=setup.warehouse_a,
        product_name_snapshot="Alpha Phone",
        sku_snapshot="SKU-PHONE-A",
        quantity=2,
        unit_price=Decimal("250.00"),
        total=Decimal("500.00"),
        commission_amount=Decimal("50.00"),
        seller_net_amount=Decimal("450.00"),
    )

    # Create Order 2 for Seller A: CANCELLED order of $1000 - must be excluded from sales metrics
    order2 = Order.objects.create(
        order_number="ORD-002",
        customer=setup.customer,
        currency="USD",
        subtotal=Decimal("1000.00"),
        grand_total=Decimal("1000.00"),
        payment_status=Order.PaymentStatus.FAILED,
        fulfillment_status=Order.FulfillmentStatus.CANCELLED,
    )
    so_a2 = SellerOrder.objects.create(
        order=order2,
        seller=setup.seller_a,
        seller_order_number="SO-A-002",
        status=SellerOrder.Status.CANCELLED,
        subtotal=Decimal("1000.00"),
        commission_total=Decimal("100.00"),
        seller_net_total=Decimal("900.00"),
    )
    OrderItem.objects.create(
        seller_order=so_a2,
        product=setup.product_a,
        variant=setup.variant_a,
        warehouse=setup.warehouse_a,
        product_name_snapshot="Alpha Phone",
        sku_snapshot="SKU-PHONE-A",
        quantity=4,
        unit_price=Decimal("250.00"),
        total=Decimal("1000.00"),
        commission_amount=Decimal("100.00"),
        seller_net_amount=Decimal("900.00"),
    )

    # Order for Seller B: $3000 - must NEVER appear in Seller A's metrics
    order_b = Order.objects.create(
        order_number="ORD-B-001",
        customer=setup.customer,
        currency="USD",
        subtotal=Decimal("3000.00"),
        grand_total=Decimal("3000.00"),
        payment_status=Order.PaymentStatus.PAID,
    )
    so_b = SellerOrder.objects.create(
        order=order_b,
        seller=setup.seller_b,
        seller_order_number="SO-B-001",
        status=SellerOrder.Status.CONFIRMED,
        subtotal=Decimal("3000.00"),
        commission_total=Decimal("300.00"),
        seller_net_total=Decimal("2700.00"),
    )
    OrderItem.objects.create(
        seller_order=so_b,
        product=setup.product_b,
        variant=setup.variant_b,
        warehouse=setup.warehouse_b,
        product_name_snapshot="Beta Tablet",
        sku_snapshot="SKU-TABLET-B",
        quantity=10,
        unit_price=Decimal("300.00"),
        total=Decimal("3000.00"),
        commission_amount=Decimal("300.00"),
        seller_net_amount=Decimal("2700.00"),
    )

    # Low stock variant for Seller A
    Inventory.objects.create(
        warehouse=setup.warehouse_a,
        variant=setup.variant_a,
        quantity_on_hand=5,
        quantity_reserved=2,
        reorder_level=5,  # available = 3 <= 5 -> low stock!
    )

    # Returns for Seller A
    ReturnRequest.objects.create(
        return_number="RET-A-001",
        seller=setup.seller_a,
        seller_order=so_a1,
        customer=setup.customer,
        status=ReturnRequest.Status.REQUESTED,
        reason="Defective item",
    )

    # Payout for Seller A
    Payout.objects.create(
        payout_number="PAY-A-001",
        seller=setup.seller_a,
        amount=Decimal("500.00"),
        status=Payout.Status.PROCESSED,
    )

    c = client(setup.owner_a)
    res = c.get(
        "/api/v1/seller/analytics/dashboard",
        HTTP_X_SELLER_ID=str(setup.seller_a.pk),
    )
    assert res.status_code == 200
    data = res.data

    # Gross sales should ONLY be $500.00 (from non-cancelled order1)
    # NOT including cancelled $1000 or Seller B's $3000
    assert data["gross_sales"] == "500.00"
    assert data["net_sales"] == "450.00"
    assert data["platform_fees"] == "50.00"
    assert data["orders_count"] == 2  # Total orders placed: order1 and order2
    assert data["units_sold"] == 2  # Only non-cancelled order units
    assert data["pending_orders"] == 1  # order1 is CONFIRMED
    assert data["low_stock_variants"] == 1
    assert data["returns_count"] == 1
    assert data["available_balance"] == "1250.00"
    assert data["pending_balance"] == "200.00"
    assert data["payout_info"]["total_paid_out"] == "500.00"
    assert data["payout_info"]["last_payout_amount"] == "500.00"
    assert len(data["top_products"]) == 1
    assert data["top_products"][0]["name"] == "Alpha Phone"
    assert data["top_products"][0]["revenue"] == "500.00"
    assert len(data["sales_over_time"]) >= 1


def test_seller_dashboard_tenant_isolation_never_leaks(setup: Phase11Setup) -> None:
    # Querying as Seller B
    c = client(setup.owner_b)
    res = c.get(
        "/api/v1/seller/analytics/dashboard",
        HTTP_X_SELLER_ID=str(setup.seller_b.pk),
    )
    assert res.status_code == 200
    # Seller B has 0 orders initially
    assert res.data["gross_sales"] == "0.00"
    assert res.data["orders_count"] == 0
    assert res.data["available_balance"] == "800.00"
    assert res.data["top_products"] == []


def test_seller_dashboard_date_range_filtering(setup: Phase11Setup) -> None:
    now = timezone.now()
    past = now - timedelta(days=60)

    # Order placed 60 days ago
    order_old = Order.objects.create(
        order_number="ORD-OLD",
        customer=setup.customer,
        currency="USD",
        subtotal=Decimal("200.00"),
        grand_total=Decimal("200.00"),
        payment_status=Order.PaymentStatus.PAID,
    )
    so_old = SellerOrder.objects.create(
        order=order_old,
        seller=setup.seller_a,
        seller_order_number="SO-A-OLD",
        status=SellerOrder.Status.DELIVERED,
        subtotal=Decimal("200.00"),
        commission_total=Decimal("20.00"),
        seller_net_total=Decimal("180.00"),
    )
    # Manually backdate created_at
    SellerOrder.objects.filter(pk=so_old.pk).update(created_at=past)

    # Query with date range for last 7 days only
    start_7d = (now - timedelta(days=7)).isoformat()
    end_now = now.isoformat()

    c = client(setup.owner_a)
    res = c.get(
        f"/api/v1/seller/analytics/dashboard?start_date={start_7d}&end_date={end_now}",
        HTTP_X_SELLER_ID=str(setup.seller_a.pk),
    )
    assert res.status_code == 200
    assert res.data["gross_sales"] == "0.00"
    assert res.data["orders_count"] == 0


def test_seller_dashboard_requires_authentication_and_context(setup: Phase11Setup) -> None:
    unauthed = APIClient()
    res = unauthed.get("/api/v1/seller/analytics/dashboard")
    assert res.status_code in (401, 403)

    # Regular user with no membership
    c = client(setup.customer)
    res = c.get(
        "/api/v1/seller/analytics/dashboard",
        HTTP_X_SELLER_ID=str(setup.seller_a.pk),
    )
    assert res.status_code in (403, 404)


def test_platform_dashboard_metrics_for_super_admin(setup: Phase11Setup) -> None:
    # Create Order 1 for Seller A
    ord1 = Order.objects.create(
        order_number="ORD-P-1",
        customer=setup.customer,
        currency="USD",
        subtotal=Decimal("500.00"),
        grand_total=Decimal("500.00"),
        payment_status=Order.PaymentStatus.PAID,
    )
    so1 = SellerOrder.objects.create(
        order=ord1,
        seller=setup.seller_a,
        seller_order_number="SO-P-1",
        status=SellerOrder.Status.DELIVERED,
        subtotal=Decimal("500.00"),
        commission_total=Decimal("50.00"),
        seller_net_total=Decimal("450.00"),
    )
    OrderItem.objects.create(
        seller_order=so1,
        product=setup.product_a,
        variant=setup.variant_a,
        warehouse=setup.warehouse_a,
        product_name_snapshot="Alpha Phone",
        sku_snapshot="SKU-PHONE-A",
        quantity=1,
        unit_price=Decimal("500.00"),
        total=Decimal("500.00"),
        commission_amount=Decimal("50.00"),
        seller_net_amount=Decimal("450.00"),
    )

    # Create Order 2 for Seller B
    ord2 = Order.objects.create(
        order_number="ORD-P-2",
        customer=setup.customer,
        currency="USD",
        subtotal=Decimal("300.00"),
        grand_total=Decimal("300.00"),
        payment_status=Order.PaymentStatus.PAID,
    )
    so2 = SellerOrder.objects.create(
        order=ord2,
        seller=setup.seller_b,
        seller_order_number="SO-P-2",
        status=SellerOrder.Status.DELIVERED,
        subtotal=Decimal("300.00"),
        commission_total=Decimal("30.00"),
        seller_net_total=Decimal("270.00"),
    )
    OrderItem.objects.create(
        seller_order=so2,
        product=setup.product_b,
        variant=setup.variant_b,
        warehouse=setup.warehouse_b,
        product_name_snapshot="Beta Tablet",
        sku_snapshot="SKU-TABLET-B",
        quantity=1,
        unit_price=Decimal("300.00"),
        total=Decimal("300.00"),
        commission_amount=Decimal("30.00"),
        seller_net_amount=Decimal("270.00"),
    )

    # Refund for Seller A
    Refund.objects.create(
        refund_number="REF-001",
        seller=setup.seller_a,
        seller_order=so1,
        amount=Decimal("50.00"),
        reason="Customer returned accessory",
        status=Refund.Status.COMPLETED,
    )

    # Return request
    ReturnRequest.objects.create(
        return_number="RET-P-001",
        seller=setup.seller_a,
        seller_order=so1,
        customer=setup.customer,
        status=ReturnRequest.Status.REQUESTED,
        reason="Color mismatch",
    )

    # Upcoming payout for Seller B
    Payout.objects.create(
        payout_number="PAY-UPCOMING",
        seller=setup.seller_b,
        amount=Decimal("250.00"),
        status=Payout.Status.PENDING,
    )

    admin_client = client(setup.platform_admin)
    res = admin_client.get("/api/v1/admin/analytics/dashboard")
    assert res.status_code == 200
    data = res.data

    # GMV = $500 + $300 = $800
    assert data["gmv"] == "800.00"
    assert data["platform_revenue"] == "80.00"
    assert data["orders_count"] == 2
    assert data["average_order_value"] == "400.00"
    assert data["active_sellers"] == 2
    assert data["customers_count"] == 1
    assert data["refund_rate"] == 50.0  # 1 refund out of 2 orders = 50%
    assert data["return_rate"] == 50.0  # 1 return out of 2 orders = 50%
    assert data["outstanding_seller_balances"] == "2050.00"  # 1250 + 800
    assert data["upcoming_payouts"] == "250.00"
    assert len(data["top_categories"]) == 1
    assert data["top_categories"][0]["name"] == "Electronics"
    assert len(data["top_sellers"]) == 2
    assert len(data["sales_over_time"]) >= 1


def test_platform_dashboard_permission_gating(setup: Phase11Setup) -> None:
    # Regular seller owner should NOT be able to view platform analytics
    seller_client = client(setup.owner_a)
    res = seller_client.get("/api/v1/admin/analytics/dashboard")
    assert res.status_code == 403

    # Super admin can access
    admin_client = client(setup.platform_admin)
    res = admin_client.get("/api/v1/admin/analytics/dashboard")
    assert res.status_code == 200
