from decimal import Decimal
from typing import Any

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.catalog.models import Category, Product, ProductVariant
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


def client(user: User, seller_id: str | None = None) -> APIClient:
    browser = JsonClient(enforce_csrf_checks=True)
    browser.force_login(user, backend="django.contrib.auth.backends.ModelBackend")
    creds: dict[str, str] = {
        "HTTP_X_CSRFTOKEN": browser.get("/api/v1/auth/csrf").json()["csrf_token"],
    }
    if seller_id:
        creds["HTTP_X_SELLER_ID"] = seller_id
    browser.credentials(**creds)
    return browser


@pytest.fixture
def perf_setup() -> dict[str, Any]:
    owner = User.objects.create_user(email="perf.owner@example.com", password="Password123!")
    admin = User.objects.create_user(email="perf.admin@example.com", password="Password123!")
    customer = User.objects.create_user(email="perf.customer@example.com", password="Password123!")

    super_role = PlatformRole.objects.get(name="SUPER_ADMIN")
    PlatformAccess.objects.create(user=admin, role=super_role, is_active=True)

    seller = Seller.objects.create(
        legal_name="Performance Corp",
        display_name="Performance Store",
        slug="perf-store",
        email="perf@example.com",
        status=Seller.Status.ACTIVE,
        verification_status=Seller.VerificationStatus.VERIFIED,
    )
    role_owner = SellerRole.objects.get(name="OWNER", seller__isnull=True)
    SellerMembership.objects.create(
        seller=seller,
        user=owner,
        role=role_owner,
        status=SellerMembership.Status.ACTIVE,
        joined_at=timezone.now(),
    )

    category = Category.objects.create(name="Performance Category", slug="perf-category")
    warehouse = Warehouse.objects.create(seller=seller, name="Perf Warehouse", code="WH-PERF")

    # Create 20 products and variants
    products = []
    variants = []
    inventories = []
    for i in range(20):
        p = Product.objects.create(
            seller=seller,
            category=category,
            name=f"Perf Product {i:02d}",
            slug=f"perf-product-{i:02d}",
            created_by=owner,
        )
        products.append(p)
        v = ProductVariant.objects.create(
            seller=seller,
            product=p,
            sku=f"SKU-PERF-{i:02d}",
            price=Decimal("50.00"),
        )
        variants.append(v)
        inv = Inventory.objects.create(
            warehouse=warehouse,
            variant=v,
            quantity_on_hand=100,
            quantity_reserved=5,
            reorder_level=10,
        )
        inventories.append(inv)

    # Create 15 orders with items
    orders = []
    for i in range(15):
        order = Order.objects.create(
            order_number=f"ORD-PERF-{i:03d}",
            customer=customer,
            currency="USD",
            subtotal=Decimal("100.00"),
            grand_total=Decimal("100.00"),
            payment_status=Order.PaymentStatus.PAID,
        )
        so = SellerOrder.objects.create(
            order=order,
            seller=seller,
            seller_order_number=f"SO-PERF-{i:03d}",
            status=SellerOrder.Status.CONFIRMED,
            subtotal=Decimal("100.00"),
            commission_total=Decimal("10.00"),
            seller_net_total=Decimal("90.00"),
        )
        OrderItem.objects.create(
            seller_order=so,
            product=products[i % len(products)],
            variant=variants[i % len(variants)],
            warehouse=warehouse,
            product_name_snapshot=products[i % len(products)].name,
            sku_snapshot=variants[i % len(variants)].sku,
            quantity=2,
            unit_price=Decimal("50.00"),
            total=Decimal("100.00"),
            commission_amount=Decimal("10.00"),
            seller_net_amount=Decimal("90.00"),
        )
        orders.append(so)

    return {
        "owner": owner,
        "admin": admin,
        "seller": seller,
        "products": products,
        "variants": variants,
        "warehouse": warehouse,
    }


def test_products_list_query_budget(perf_setup: dict[str, Any]) -> None:
    c = client(perf_setup["owner"], seller_id=str(perf_setup["seller"].pk))

    # Fetch 20 products
    with CaptureQueriesContext(connection) as ctx:
        res = c.get("/api/v1/seller/products")
        assert res.status_code == 200

    # Ensure no N+1 query explosion: budget must be strictly bounded (<= 12 queries)
    assert len(ctx.captured_queries) <= 12


def test_inventory_list_query_budget(perf_setup: dict[str, Any]) -> None:
    c = client(perf_setup["owner"], seller_id=str(perf_setup["seller"].pk))

    # Fetch inventory list
    with CaptureQueriesContext(connection) as ctx:
        res = c.get("/api/v1/seller/inventory")
        assert res.status_code == 200

    # Ensure select_related warehouse and variant bounds queries (<= 12 queries)
    assert len(ctx.captured_queries) <= 12


def test_orders_list_query_budget(perf_setup: dict[str, Any]) -> None:
    c = client(perf_setup["owner"], seller_id=str(perf_setup["seller"].pk))

    with CaptureQueriesContext(connection) as ctx:
        res = c.get("/api/v1/seller/orders/")
        assert res.status_code == 200

    assert len(ctx.captured_queries) <= 12


def test_seller_dashboard_metrics_query_budget(perf_setup: dict[str, Any]) -> None:
    c = client(perf_setup["owner"], seller_id=str(perf_setup["seller"].pk))

    with CaptureQueriesContext(connection) as ctx:
        res = c.get("/api/v1/seller/analytics/dashboard")
        assert res.status_code == 200

    # Dashboard aggregates across all 15 orders using SQL aggregations. Budget <= 15 queries.
    assert len(ctx.captured_queries) <= 15
    data = res.json()
    assert data["orders_count"] == 15
    assert Decimal(data["gross_sales"]) == Decimal("1500.00")


def test_platform_dashboard_metrics_query_budget(perf_setup: dict[str, Any]) -> None:
    admin_c = client(perf_setup["admin"])

    with CaptureQueriesContext(connection) as ctx:
        res = admin_c.get("/api/v1/admin/analytics/dashboard")
        assert res.status_code == 200

    # Platform dashboard aggregates across the entire marketplace. Budget <= 18 queries.
    assert len(ctx.captured_queries) <= 18
    data = res.json()
    assert data["orders_count"] == 15
    assert Decimal(data["gmv"]) == Decimal("1500.00")
