import uuid
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.catalog.models import Category, Product, ProductVariant
from apps.finance.models import Payout, SellerBalance
from apps.inventory.models import Inventory, Warehouse
from apps.orders.models import Order, OrderItem, SellerOrder
from apps.platform_access.models import PlatformAccess, PlatformPermission, PlatformRole
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

    def put(  # type: ignore[override]
        self,
        path: str,
        data: Any = None,
        format: str = "json",
        content_type: str | None = None,
        follow: bool = False,
        **extra: Any,
    ) -> Any:
        return super().put(
            path, data=data, format=format, content_type=content_type, follow=follow, **extra
        )

    def patch(  # type: ignore[override]
        self,
        path: str,
        data: Any = None,
        format: str = "json",
        content_type: str | None = None,
        follow: bool = False,
        **extra: Any,
    ) -> Any:
        return super().patch(
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


@dataclass
class SecuritySetup:
    owner_a: User
    owner_b: User
    staff_a: User
    limited_admin: User
    super_admin: User
    regular_user: User
    seller_a: Seller
    seller_b: Seller
    category: Category
    product_a: Product
    product_b: Product
    variant_a: ProductVariant
    variant_b: ProductVariant
    warehouse_a: Warehouse
    warehouse_b: Warehouse
    inventory_a: Inventory
    inventory_b: Inventory
    order_a: Order
    seller_order_a: SellerOrder
    order_b: Order
    seller_order_b: SellerOrder


@pytest.fixture
def setup() -> SecuritySetup:
    owner_a = User.objects.create_user(email="owner.a@example.com", password="Password123!")
    owner_b = User.objects.create_user(email="owner.b@example.com", password="Password123!")
    staff_a = User.objects.create_user(email="staff.a@example.com", password="Password123!")
    limited_admin = User.objects.create_user(
        email="limited.admin@example.com", password="Password123!"
    )
    super_admin = User.objects.create_user(email="super.admin@example.com", password="Password123!")
    regular_user = User.objects.create_user(
        email="regular.user@example.com", password="Password123!"
    )

    # Super Admin has all capabilities
    super_role = PlatformRole.objects.get(name="SUPER_ADMIN")
    PlatformAccess.objects.create(user=super_admin, role=super_role, is_active=True)

    # Limited Admin has platform.access and platform.sellers.read,
    # but NO platform.finance permissions
    limited_role, _ = PlatformRole.objects.get_or_create(
        name="LIMITED_INSPECTOR",
    )
    p_access = PlatformPermission.objects.get(code="platform.access")
    p_sellers_read = PlatformPermission.objects.get(code="platform.sellers.read")
    limited_role.permissions.add(p_access, p_sellers_read)
    PlatformAccess.objects.create(user=limited_admin, role=limited_role, is_active=True)

    # Sellers
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

    role_owner = SellerRole.objects.get(name="OWNER", seller__isnull=True)
    role_support = SellerRole.objects.get(name="SUPPORT_AGENT", seller__isnull=True)

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
    SellerMembership.objects.create(
        seller=seller_a,
        user=staff_a,
        role=role_support,
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

    inventory_a = Inventory.objects.create(
        warehouse=warehouse_a,
        variant=variant_a,
        quantity_on_hand=100,
        quantity_reserved=0,
    )
    inventory_b = Inventory.objects.create(
        warehouse=warehouse_b,
        variant=variant_b,
        quantity_on_hand=100,
        quantity_reserved=0,
    )

    order_a = Order.objects.create(
        order_number="ORD-SEC-A-001",
        customer=regular_user,
        currency="USD",
        subtotal=Decimal("500.00"),
        grand_total=Decimal("500.00"),
        payment_status=Order.PaymentStatus.PAID,
    )
    seller_order_a = SellerOrder.objects.create(
        order=order_a,
        seller=seller_a,
        seller_order_number="SO-SEC-A-001",
        status=SellerOrder.Status.CONFIRMED,
        subtotal=Decimal("500.00"),
        commission_total=Decimal("50.00"),
        seller_net_total=Decimal("450.00"),
    )
    OrderItem.objects.create(
        seller_order=seller_order_a,
        product=product_a,
        variant=variant_a,
        warehouse=warehouse_a,
        product_name_snapshot="Alpha Phone",
        sku_snapshot="SKU-PHONE-A",
        quantity=1,
        unit_price=Decimal("500.00"),
        total=Decimal("500.00"),
        commission_amount=Decimal("50.00"),
        seller_net_amount=Decimal("450.00"),
    )

    order_b = Order.objects.create(
        order_number="ORD-SEC-B-001",
        customer=regular_user,
        currency="USD",
        subtotal=Decimal("300.00"),
        grand_total=Decimal("300.00"),
        payment_status=Order.PaymentStatus.PAID,
    )
    seller_order_b = SellerOrder.objects.create(
        order=order_b,
        seller=seller_b,
        seller_order_number="SO-SEC-B-001",
        status=SellerOrder.Status.CONFIRMED,
        subtotal=Decimal("300.00"),
        commission_total=Decimal("30.00"),
        seller_net_total=Decimal("270.00"),
    )
    OrderItem.objects.create(
        seller_order=seller_order_b,
        product=product_b,
        variant=variant_b,
        warehouse=warehouse_b,
        product_name_snapshot="Beta Tablet",
        sku_snapshot="SKU-TABLET-B",
        quantity=1,
        unit_price=Decimal("300.00"),
        total=Decimal("300.00"),
        commission_amount=Decimal("30.00"),
        seller_net_amount=Decimal("270.00"),
    )

    return SecuritySetup(
        owner_a=owner_a,
        owner_b=owner_b,
        staff_a=staff_a,
        limited_admin=limited_admin,
        super_admin=super_admin,
        regular_user=regular_user,
        seller_a=seller_a,
        seller_b=seller_b,
        category=category,
        product_a=product_a,
        product_b=product_b,
        variant_a=variant_a,
        variant_b=variant_b,
        warehouse_a=warehouse_a,
        warehouse_b=warehouse_b,
        inventory_a=inventory_a,
        inventory_b=inventory_b,
        order_a=order_a,
        seller_order_a=seller_order_a,
        order_b=order_b,
        seller_order_b=seller_order_b,
    )


# --- 1. Cross-Tenant Read Protection ---
def test_seller_cannot_read_foreign_tenant_objects(setup: SecuritySetup) -> None:
    c = client(setup.owner_a, seller_id=str(setup.seller_a.pk))

    # Product of Seller B -> 404
    res = c.get(f"/api/v1/seller/products/{setup.product_b.pk}")
    assert res.status_code == 404

    # Warehouse of Seller B -> 404
    res = c.get(f"/api/v1/seller/warehouses/{setup.warehouse_b.pk}")
    assert res.status_code == 404

    # Inventory of Seller B -> 404
    res = c.get(f"/api/v1/seller/inventory/{setup.inventory_b.pk}")
    assert res.status_code == 404

    # Order of Seller B -> 404
    res = c.get(f"/api/v1/seller/orders/{setup.seller_order_b.pk}/")
    assert res.status_code == 404


# --- 2. Cross-Tenant Mutation Protection ---
def test_seller_cannot_modify_foreign_tenant_objects(setup: SecuritySetup) -> None:
    c = client(setup.owner_a, seller_id=str(setup.seller_a.pk))

    # Attempt to update Seller B's product
    res = c.put(
        f"/api/v1/seller/products/{setup.product_b.pk}",
        {"name": "Tampered Product", "description": "Hacked"},
    )
    assert res.status_code == 404

    # Attempt to confirm Seller B's order
    res = c.post(f"/api/v1/seller/orders/{setup.seller_order_b.pk}/confirm/")
    assert res.status_code == 404


# --- 3. Cross-Tenant Foreign Key Rejection ---
def test_cross_tenant_foreign_key_trigger_enforcement(setup: SecuritySetup) -> None:
    # Trigger catalog_check_child_scope rejects Variant pointing to product of another seller
    from django.db import IntegrityError

    with pytest.raises(IntegrityError):
        ProductVariant.objects.create(
            seller=setup.seller_a,
            product=setup.product_b,  # Foreign product!
            sku="SKU-MALICIOUS",
            price=Decimal("100.00"),
        )


# --- 4. Privilege Escalation Prevention ---
def test_staff_cannot_escalate_privileges(setup: SecuritySetup) -> None:
    # Staff member A (Support Agent) tries to invite an Owner or assign Admin role
    c = client(setup.staff_a, seller_id=str(setup.seller_a.pk))

    role_owner = SellerRole.objects.get(name="OWNER", seller__isnull=True)
    res = c.post(
        "/api/v1/seller/staff/invite",
        {"email": "hacker@example.com", "role_id": str(role_owner.pk)},
    )
    # Denied with 403 Forbidden because staff_a lacks seller.staff.manage
    assert res.status_code == 403


# --- 5. Seller Owner Cannot Alter Platform Fields ---
def test_seller_owner_cannot_alter_platform_fields(setup: SecuritySetup) -> None:
    c = client(setup.owner_a, seller_id=str(setup.seller_a.pk))

    # Attempt to put status, verification_status, or default_currency via settings
    res = c.put(
        "/api/v1/seller/settings",
        {
            "display_name": "Updated Alpha Store",
            "email": "contact@alpha.com",
            "timezone": "UTC",
            "status": "suspended",
            "verification_status": "rejected",
            "default_currency": "EUR",
        },
    )
    # StrictSerializer detects extra fields and rejects mass assignment with 400 Bad Request
    assert res.status_code == 400
    assert "Unexpected fields" in str(res.json())

    # Re-fetch seller to verify fields were NOT changed
    setup.seller_a.refresh_from_db()
    assert setup.seller_a.status == Seller.Status.ACTIVE
    assert setup.seller_a.verification_status == Seller.VerificationStatus.VERIFIED
    assert setup.seller_a.default_currency == "USD"


# --- 6. Normal User Calling Admin API Rejected ---
def test_normal_user_denied_from_all_admin_endpoints(setup: SecuritySetup) -> None:
    c = client(setup.regular_user)

    endpoints = [
        "/api/v1/admin/access",
        "/api/v1/admin/sellers",
        "/api/v1/admin/orders/",
        "/api/v1/admin/inventory",
        "/api/v1/admin/finance/summary",
        "/api/v1/admin/analytics/dashboard",
    ]
    for ep in endpoints:
        res = c.get(ep)
        assert res.status_code == 403


# --- 7. Platform Admin Lacking Specific Capability Denied ---
def test_limited_platform_admin_denied_from_finance_endpoints(setup: SecuritySetup) -> None:
    c = client(setup.limited_admin)

    # Has platform.sellers.read -> can view sellers
    res_sellers = c.get("/api/v1/admin/sellers")
    assert res_sellers.status_code == 200

    # Lacks platform.finance.read -> must receive 403 Forbidden
    res_finance = c.get("/api/v1/admin/finance/summary")
    assert res_finance.status_code == 403

    res_balances = c.get("/api/v1/admin/finance/seller-balances")
    assert res_balances.status_code == 403


# --- 8. Mass Assignment Protection ---
def test_mass_assignment_fields_rejected(setup: SecuritySetup) -> None:
    c = client(setup.owner_a, seller_id=str(setup.seller_a.pk))

    fake_id = str(uuid.uuid4())
    res = c.post(
        "/api/v1/seller/warehouses",
        {
            "id": fake_id,
            "name": "Warehouse With Injected ID",
            "code": "wh-inject",
            "is_active": True,
            "created_at": "2020-01-01T00:00:00Z",
        },
    )
    # StrictSerializer detects extra fields and rejects mass assignment with 400 Bad Request
    assert res.status_code == 400
    assert "Unexpected fields" in str(res.json())


# --- 9. CSRF Omission Rejection on Unsafe Methods ---
def test_csrf_omission_rejected_on_unsafe_methods(setup: SecuritySetup) -> None:
    # Client with CSRF enforcement but without providing CSRF token header
    c = JsonClient(enforce_csrf_checks=True)
    c.force_login(setup.owner_a, backend="django.contrib.auth.backends.ModelBackend")

    res = c.post(
        "/api/v1/seller/warehouses",
        {"name": "No CSRF WH", "code": "NO-CSRF"},
        HTTP_X_SELLER_ID=str(setup.seller_a.pk),
    )
    assert res.status_code == 403


# --- 10. Tampered and Malformed IDs Cleanly Handled ---
def test_tampered_and_malformed_ids_handled(setup: SecuritySetup) -> None:
    c = client(setup.owner_a, seller_id=str(setup.seller_a.pk))

    # Path traversal sequence or non-UUID
    malformed_ids = [
        "not-a-uuid",
        "../../etc/passwd",
        "12345",
        "00000000-0000-0000-0000-00000000000G",
    ]
    for bad_id in malformed_ids:
        res = c.get(f"/api/v1/seller/products/{bad_id}")
        assert res.status_code == 404


# --- 11. Pagination Abuse Clamped or Rejected ---
def test_pagination_bounds_enforced(setup: SecuritySetup) -> None:
    c = client(setup.owner_a, seller_id=str(setup.seller_a.pk))

    # Negative page
    res_neg = c.get("/api/v1/seller/products?page=-1")
    assert res_neg.status_code in (400, 404)

    # Exceedingly large page (> 10000)
    res_large = c.get("/api/v1/seller/products?page=999999")
    assert res_large.status_code in (400, 404)


# --- 12. Replayed Sensitive Financial Action Rejected ---
def test_replayed_payout_transition_rejected(setup: SecuritySetup) -> None:
    # Setup seller balance and payout
    SellerBalance.objects.create(
        seller=setup.seller_a,
        currency="USD",
        current_balance=Decimal("1000.00"),
        pending_balance=Decimal("0.00"),
        total_paid_out=Decimal("0.00"),
    )
    payout = Payout.objects.create(
        payout_number="PO-SEC-001",
        seller=setup.seller_a,
        amount=Decimal("500.00"),
        status=Payout.Status.PROCESSED,  # Already processed!
    )

    admin_c = client(setup.super_admin)

    # Attempt to approve an already PROCESSED payout
    res_approve = admin_c.post(f"/api/v1/admin/finance/payouts/{payout.pk}/approve")
    assert res_approve.status_code in (400, 409)

    # Attempt to process an already PROCESSED payout
    res_process = admin_c.post(f"/api/v1/admin/finance/payouts/{payout.pk}/process")
    assert res_process.status_code in (400, 409)
