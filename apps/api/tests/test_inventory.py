from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from threading import Barrier

import pytest
from django.db import DatabaseError, IntegrityError, close_old_connections, transaction
from django.http import Http404
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.audit.models import AuditLog
from apps.catalog import services as catalog_services
from apps.catalog.models import Category, ProductVariant
from apps.inventory import selectors, services
from apps.inventory.models import Inventory, InventoryTransaction, Warehouse
from apps.platform_access.models import PlatformAccess, PlatformRole
from apps.sellers.models import Seller, SellerMembership, SellerRole

pytestmark = pytest.mark.django_db


def client(user: User) -> APIClient:
    browser = APIClient(enforce_csrf_checks=True)
    browser.force_login(user, backend="django.contrib.auth.backends.ModelBackend")
    browser.credentials(HTTP_X_CSRFTOKEN=browser.get("/api/v1/auth/csrf").json()["csrf_token"])
    return browser


@dataclass
class Setup:
    owner: User
    staff: User
    other: User
    admin: User
    seller: Seller
    foreign: Seller
    warehouse: Warehouse
    foreign_warehouse: Warehouse
    variant: ProductVariant
    foreign_variant: ProductVariant
    inventory: Inventory
    browser: APIClient
    platform: APIClient


@pytest.fixture
def setup() -> Setup:
    owner = User.objects.create_user("inv-owner@example.com")
    staff = User.objects.create_user("inv-staff@example.com")
    other = User.objects.create_user("inv-other@example.com")
    admin = User.objects.create_user("inv-admin@example.com")

    PlatformAccess.objects.create(user=admin, role=PlatformRole.objects.get(name="SUPER_ADMIN"))

    seller = Seller.objects.create(
        legal_name="Inventory Seller A",
        display_name="Seller A",
        slug="seller-a",
        email="a@example.com",
        status="active",
        default_currency="NPR",
    )
    foreign = Seller.objects.create(
        legal_name="Inventory Seller B",
        display_name="Seller B",
        slug="seller-b",
        email="b@example.com",
        status="active",
        default_currency="NPR",
    )

    owner_role = SellerRole.objects.get(name="OWNER", is_system=True)
    catalog_mgr_role = SellerRole.objects.get(name="CATALOG_MANAGER", is_system=True)

    SellerMembership.objects.create(
        seller=seller, user=owner, role=owner_role, status="active", joined_at=timezone.now()
    )
    SellerMembership.objects.create(
        seller=seller, user=staff, role=catalog_mgr_role, status="active", joined_at=timezone.now()
    )
    SellerMembership.objects.create(
        seller=foreign, user=other, role=owner_role, status="active", joined_at=timezone.now()
    )

    category = Category.objects.create(name="Groceries", slug="groceries")
    product = catalog_services.create_product(
        owner, seller.pk, {"category_id": category.pk, "name": "Apple"}
    )
    foreign_product = catalog_services.create_product(
        other, foreign.pk, {"category_id": category.pk, "name": "Banana"}
    )

    variant = catalog_services.save_variant(
        owner, seller.pk, product.pk, {"sku": "APPLE-RED", "price": "100.00"}
    )
    foreign_variant = catalog_services.save_variant(
        other, foreign.pk, foreign_product.pk, {"sku": "BANANA-YELLOW", "price": "50.00"}
    )

    warehouse = services.create_warehouse(
        seller.pk,
        owner,
        {"name": "Kathmandu Central", "code": "ktm-central", "address": "Thamel, Kathmandu"},
    )
    foreign_warehouse = services.create_warehouse(
        foreign.pk,
        other,
        {"name": "Pokhara Main", "code": "pkr-main", "address": "Lakeside, Pokhara"},
    )

    inventory = services.get_or_create_inventory(
        seller.pk,
        owner,
        warehouse.pk,
        variant.pk,
        reorder_level=10,
    )

    return Setup(
        owner=owner,
        staff=staff,
        other=other,
        admin=admin,
        seller=seller,
        foreign=foreign,
        warehouse=warehouse,
        foreign_warehouse=foreign_warehouse,
        variant=variant,
        foreign_variant=foreign_variant,
        inventory=inventory,
        browser=client(owner),
        platform=client(admin),
    )


def test_warehouse_creation_and_uniqueness(setup: Setup) -> None:
    # Warehouse code uniqueness scoped to seller
    with pytest.raises(ValidationError):
        services.create_warehouse(
            setup.seller.pk,
            setup.owner,
            {"name": "Duplicate Code", "code": "ktm-central"},
        )

    # Same code under different seller is permitted
    wh2 = services.create_warehouse(
        setup.foreign.pk,
        setup.other,
        {"name": "Different Seller Same Code", "code": "ktm-central"},
    )
    assert wh2.code == "ktm-central"
    assert wh2.seller == setup.foreign

    # Audit log check
    log = AuditLog.objects.filter(
        seller_id=setup.seller.pk,
        action="inventory.warehouse.create",
        target_id=setup.warehouse.pk,
    ).first()
    assert log is not None
    assert log.changes["code"] == "ktm-central"


def test_warehouse_update_and_code_immutability(setup: Setup) -> None:
    updated = services.update_warehouse(
        setup.seller.pk,
        setup.owner,
        setup.warehouse.pk,
        {"name": "Kathmandu Hub Updated", "address": "New Road", "is_active": False},
    )
    assert updated.name == "Kathmandu Hub Updated"
    assert updated.address == "New Road"
    assert not updated.is_active

    # Database trigger rejects warehouse code mutation
    with pytest.raises(IntegrityError), transaction.atomic():
        Warehouse.objects.filter(pk=setup.warehouse.pk).update(code="new-code")

    # Database trigger rejects warehouse seller tenant reassignment
    with pytest.raises(IntegrityError), transaction.atomic():
        Warehouse.objects.filter(pk=setup.warehouse.pk).update(seller=setup.foreign)


def test_cross_tenant_warehouse_isolation(setup: Setup) -> None:
    # Foreign seller cannot read warehouse
    with pytest.raises(Http404):
        selectors.get_warehouse(setup.other, setup.foreign.pk, setup.warehouse.pk)

    # Foreign seller cannot update warehouse
    with pytest.raises(Http404):
        services.update_warehouse(
            setup.foreign.pk,
            setup.other,
            setup.warehouse.pk,
            {"name": "Hacked"},
        )

    # API returns 404
    resp = setup.browser.get(
        f"/api/v1/seller/warehouses/{setup.foreign_warehouse.pk}",
        HTTP_X_SELLER_ID=str(setup.seller.pk),
    )
    assert resp.status_code == 404


def test_inventory_scope_and_cross_tenant_trigger(setup: Setup) -> None:
    # Service rejects pairing warehouse of Seller A with variant of Seller B
    with pytest.raises(Http404):
        services.get_or_create_inventory(
            setup.seller.pk,
            setup.owner,
            setup.warehouse.pk,
            setup.foreign_variant.pk,
        )

    # Database trigger strictly forbids cross-tenant Inventory row
    with pytest.raises(IntegrityError), transaction.atomic():
        Inventory.objects.create(
            warehouse=setup.warehouse,
            variant=setup.foreign_variant,
            quantity_on_hand=10,
        )

    # Database trigger strictly forbids mutating inventory identity
    with pytest.raises(IntegrityError), transaction.atomic():
        Inventory.objects.filter(pk=setup.inventory.pk).update(warehouse=setup.foreign_warehouse)


def test_inventory_adjustment_lifecycle_and_checks(setup: Setup) -> None:
    inv = setup.inventory
    assert inv.quantity_on_hand == 0
    assert inv.quantity_reserved == 0
    assert inv.available_quantity == 0
    assert inv.is_low_stock  # 0 <= 10 reorder level

    # Positive adjustment
    inv = services.adjust_inventory(
        setup.seller.pk,
        setup.owner,
        inv.pk,
        quantity_delta=50,
        reason="Initial purchase receipt",
        reference_type="po",
        reference_id="PO-001",
    )
    assert inv.quantity_on_hand == 50
    assert inv.available_quantity == 50
    assert not inv.is_low_stock

    tx = InventoryTransaction.objects.filter(inventory=inv).latest("created_at")
    assert tx.type == InventoryTransaction.Type.ADJUSTMENT
    assert tx.quantity_delta == 50
    assert tx.reason == "Initial purchase receipt"
    assert tx.reference_type == "po"
    assert tx.reference_id == "PO-001"
    assert tx.created_by == setup.owner

    # Partial negative adjustment
    inv = services.adjust_inventory(
        setup.seller.pk,
        setup.owner,
        inv.pk,
        quantity_delta=-10,
        reason="Damaged goods write-off",
    )
    assert inv.quantity_on_hand == 40

    # Negative adjustment below zero fails
    with pytest.raises(ValidationError):
        services.adjust_inventory(
            setup.seller.pk,
            setup.owner,
            inv.pk,
            quantity_delta=-50,
            reason="Too large deduction",
        )

    # Database check constraint prevents negative quantity_on_hand
    with pytest.raises(IntegrityError), transaction.atomic():
        Inventory.objects.filter(pk=inv.pk).update(quantity_on_hand=-1)

    # Zero delta and empty reason fail validation
    with pytest.raises(ValidationError):
        services.adjust_inventory(
            setup.seller.pk, setup.owner, inv.pk, quantity_delta=0, reason="zero"
        )

    with pytest.raises(ValidationError):
        services.adjust_inventory(
            setup.seller.pk, setup.owner, inv.pk, quantity_delta=5, reason="   "
        )


def test_inventory_reservation_and_release(setup: Setup) -> None:
    inv = services.adjust_inventory(
        setup.seller.pk,
        setup.owner,
        setup.inventory.pk,
        quantity_delta=30,
        reason="Stock in",
    )

    # Reserve 20
    inv = services.reserve_inventory(
        setup.seller.pk,
        setup.owner,
        inv.pk,
        quantity=20,
        reason="Order reserve #101",
    )
    assert inv.quantity_on_hand == 30
    assert inv.quantity_reserved == 20
    assert inv.available_quantity == 10

    tx_res = InventoryTransaction.objects.filter(inventory=inv).latest("created_at")
    assert tx_res.type == InventoryTransaction.Type.RESERVATION
    assert tx_res.quantity_delta == 20

    # Cannot reserve more than available (available is 10)
    with pytest.raises(ValidationError):
        services.reserve_inventory(
            setup.seller.pk,
            setup.owner,
            inv.pk,
            quantity=15,
            reason="Exceeds available",
        )

    # Release 5
    inv = services.release_inventory(
        setup.seller.pk,
        setup.owner,
        inv.pk,
        quantity=5,
        reason="Order cancellation #101",
    )
    assert inv.quantity_reserved == 15
    assert inv.available_quantity == 15

    tx_rel = InventoryTransaction.objects.filter(inventory=inv).latest("created_at")
    assert tx_rel.type == InventoryTransaction.Type.RELEASE
    assert tx_rel.quantity_delta == -5

    # Cannot release more than reserved (reserved is 15)
    with pytest.raises(ValidationError):
        services.release_inventory(
            setup.seller.pk,
            setup.owner,
            inv.pk,
            quantity=20,
            reason="Release too much",
        )

    # Database check constraint prevents reserved > on_hand
    with pytest.raises(IntegrityError), transaction.atomic():
        Inventory.objects.filter(pk=inv.pk).update(quantity_reserved=40)


def test_inventory_consume_and_return(setup: Setup) -> None:
    inv = services.adjust_inventory(
        setup.seller.pk,
        setup.owner,
        setup.inventory.pk,
        quantity_delta=25,
        reason="Stock in",
    )
    inv = services.reserve_inventory(
        setup.seller.pk,
        setup.owner,
        inv.pk,
        quantity=10,
        reason="Order reserve",
    )

    # Consume 10 reserved units (sale shipment)
    inv = services.consume_reserved_inventory(
        setup.seller.pk,
        setup.owner,
        inv.pk,
        quantity=10,
        reason="Order fulfilled #102",
    )
    assert inv.quantity_on_hand == 15
    assert inv.quantity_reserved == 0
    assert inv.available_quantity == 15

    tx_sale = InventoryTransaction.objects.filter(inventory=inv).latest("created_at")
    assert tx_sale.type == InventoryTransaction.Type.SALE
    assert tx_sale.quantity_delta == -10

    # Receive return of 2 units
    inv = services.receive_return(
        setup.seller.pk,
        setup.owner,
        inv.pk,
        quantity=2,
        reason="Customer returned unopened",
    )
    assert inv.quantity_on_hand == 17
    assert inv.available_quantity == 17

    tx_ret = InventoryTransaction.objects.filter(inventory=inv).latest("created_at")
    assert tx_ret.type == InventoryTransaction.Type.RETURN
    assert tx_ret.quantity_delta == 2


def test_ledger_immutability_trigger(setup: Setup) -> None:
    services.adjust_inventory(
        setup.seller.pk,
        setup.owner,
        setup.inventory.pk,
        quantity_delta=10,
        reason="Initial",
    )
    tx = InventoryTransaction.objects.filter(inventory=setup.inventory).first()
    assert tx is not None

    # Database trigger rejects transaction update
    with pytest.raises((IntegrityError, DatabaseError)), transaction.atomic():
        InventoryTransaction.objects.filter(pk=tx.pk).update(reason="Tampered reason")

    # Database trigger rejects transaction deletion
    with pytest.raises((IntegrityError, DatabaseError)), transaction.atomic():
        InventoryTransaction.objects.filter(pk=tx.pk).delete()


@pytest.mark.django_db(transaction=True, serialized_rollback=True)
def test_concurrent_reservations_prevent_overselling(setup: Setup) -> None:
    # Stock on hand = 10
    services.adjust_inventory(
        setup.seller.pk,
        setup.owner,
        setup.inventory.pk,
        quantity_delta=10,
        reason="Concurrency test stock",
    )

    num_threads = 5
    barrier = Barrier(num_threads)
    results: list[bool] = []

    def try_reserve() -> None:
        close_old_connections()
        barrier.wait()
        try:
            actor = User.objects.get(pk=setup.owner.pk)
            services.reserve_inventory(
                setup.seller.pk,
                actor,
                setup.inventory.pk,
                quantity=3,
                reason="Concurrent worker reservation",
            )
            results.append(True)
        except ValidationError:
            results.append(False)
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=num_threads) as executor:
        list(executor.map(lambda _: try_reserve(), range(num_threads)))

    # Out of 5 threads trying to reserve 3 each (15 total from 10 available):
    # Exactly 3 should succeed (3 * 3 = 9 reserved, 1 left), 2 should fail
    successes = results.count(True)
    failures = results.count(False)
    assert successes == 3
    assert failures == 2

    setup.inventory.refresh_from_db()
    assert setup.inventory.quantity_reserved == 9
    assert setup.inventory.available_quantity == 1


def test_seller_inventory_api_endpoints(setup: Setup) -> None:
    seller_id = str(setup.seller.pk)

    # List warehouses
    resp = setup.browser.get("/api/v1/seller/warehouses", HTTP_X_SELLER_ID=seller_id)
    assert resp.status_code == 200
    assert resp.json()["count"] == 1
    assert resp.json()["results"][0]["code"] == "ktm-central"

    # Create warehouse via API
    resp = setup.browser.post(
        "/api/v1/seller/warehouses",
        {"name": "Bhaktapur Branch", "code": "bkt-branch", "address": "Suryabinayak"},
        format="json",
        HTTP_X_SELLER_ID=seller_id,
    )
    assert resp.status_code == 201
    wh_id = resp.json()["id"]

    # Update warehouse via API
    resp = setup.browser.put(
        f"/api/v1/seller/warehouses/{wh_id}",
        {"name": "Bhaktapur Branch Updated"},
        format="json",
        HTTP_X_SELLER_ID=seller_id,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Bhaktapur Branch Updated"

    # Adjust stock via API
    resp = setup.browser.post(
        f"/api/v1/seller/inventory/{setup.inventory.pk}/adjust",
        {"quantity_delta": 40, "reason": "API stock adjustment"},
        format="json",
        HTTP_X_SELLER_ID=seller_id,
    )
    assert resp.status_code == 200
    assert resp.json()["quantity_on_hand"] == 40
    assert resp.json()["available_quantity"] == 40

    # Reserve stock via API
    resp = setup.browser.post(
        f"/api/v1/seller/inventory/{setup.inventory.pk}/reserve",
        {"quantity": 15, "reason": "API reservation"},
        format="json",
        HTTP_X_SELLER_ID=seller_id,
    )
    assert resp.status_code == 200
    assert resp.json()["quantity_reserved"] == 15
    assert resp.json()["available_quantity"] == 25

    # Release stock via API
    resp = setup.browser.post(
        f"/api/v1/seller/inventory/{setup.inventory.pk}/release",
        {"quantity": 5, "reason": "API release"},
        format="json",
        HTTP_X_SELLER_ID=seller_id,
    )
    assert resp.status_code == 200
    assert resp.json()["quantity_reserved"] == 10
    assert resp.json()["available_quantity"] == 30

    # List transactions
    resp = setup.browser.get("/api/v1/seller/inventory/transactions", HTTP_X_SELLER_ID=seller_id)
    assert resp.status_code == 200
    assert resp.json()["count"] == 3

    # Item transactions
    resp = setup.browser.get(
        f"/api/v1/seller/inventory/{setup.inventory.pk}/transactions",
        HTTP_X_SELLER_ID=seller_id,
    )
    assert resp.status_code == 200
    assert resp.json()["count"] == 3


def test_platform_inventory_api_endpoints(setup: Setup) -> None:
    # Non-platform admin gets 403
    seller_client = client(setup.owner)
    resp = seller_client.get("/api/v1/admin/inventory")
    assert resp.status_code == 403

    # Platform admin gets inventory listing
    resp = setup.platform.get("/api/v1/admin/inventory")
    assert resp.status_code == 200
    assert resp.json()["count"] >= 1

    # Platform admin inspects item detail
    resp = setup.platform.get(f"/api/v1/admin/inventory/{setup.inventory.pk}")
    assert resp.status_code == 200
    assert resp.json()["id"] == str(setup.inventory.pk)

    # Filter platform transactions
    resp = setup.platform.get(
        f"/api/v1/admin/inventory/transactions?inventory_id={setup.inventory.pk}"
    )
    assert resp.status_code == 200


def test_permission_denials_and_capability_checks(setup: Setup) -> None:
    # CATALOG_MANAGER has "inventory.read" but not "inventory.adjust"
    staff_client = client(setup.staff)
    seller_id = str(setup.seller.pk)

    # Staff can read inventory
    resp = staff_client.get("/api/v1/seller/inventory", HTTP_X_SELLER_ID=seller_id)
    assert resp.status_code == 200

    # Staff CANNOT adjust inventory (lacks inventory.adjust)
    resp = staff_client.post(
        f"/api/v1/seller/inventory/{setup.inventory.pk}/adjust",
        {"quantity_delta": 5, "reason": "Unauthorized"},
        format="json",
        HTTP_X_SELLER_ID=seller_id,
    )
    assert resp.status_code == 403

    # Staff CANNOT reserve inventory
    resp = staff_client.post(
        f"/api/v1/seller/inventory/{setup.inventory.pk}/reserve",
        {"quantity": 5, "reason": "Unauthorized"},
        format="json",
        HTTP_X_SELLER_ID=seller_id,
    )
    assert resp.status_code == 403

    # Unauthenticated client gets 403
    anon = APIClient()
    resp = anon.get("/api/v1/seller/inventory", HTTP_X_SELLER_ID=seller_id)
    assert resp.status_code == 403
