from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from decimal import Decimal
from threading import Barrier

import pytest
from django.db import DatabaseError, IntegrityError, close_old_connections, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.catalog import services as catalog_services
from apps.catalog.models import Category, ProductVariant
from apps.inventory import services as inventory_services
from apps.inventory.models import Inventory, InventoryTransaction, Warehouse
from apps.orders import services
from apps.orders.models import Order, OrderItem, SellerOrder
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
    owner_a: User
    staff_a: User
    owner_b: User
    admin: User
    customer: User
    seller_a: Seller
    seller_b: Seller
    warehouse_a: Warehouse
    warehouse_b: Warehouse
    variant_a: ProductVariant
    variant_b: ProductVariant
    inventory_a: Inventory
    inventory_b: Inventory
    browser_a: APIClient
    browser_b: APIClient
    platform: APIClient


@pytest.fixture
def setup() -> Setup:
    owner_a = User.objects.create_user("order-owner-a@example.com")
    staff_a = User.objects.create_user("order-staff-a@example.com")
    owner_b = User.objects.create_user("order-owner-b@example.com")
    admin = User.objects.create_user("order-admin@example.com")
    customer = User.objects.create_user("order-customer@example.com")

    PlatformAccess.objects.create(user=admin, role=PlatformRole.objects.get(name="SUPER_ADMIN"))

    seller_a = Seller.objects.create(
        legal_name="Orders Seller A Corp",
        display_name="Seller A",
        slug="seller-ord-a",
        email="a@example.com",
        status="active",
        default_currency="NPR",
    )
    seller_b = Seller.objects.create(
        legal_name="Orders Seller B Corp",
        display_name="Seller B",
        slug="seller-ord-b",
        email="b@example.com",
        status="active",
        default_currency="NPR",
    )

    owner_role = SellerRole.objects.get(name="OWNER", is_system=True)
    order_mgr_role = SellerRole.objects.get(name="ORDER_MANAGER", is_system=True)

    SellerMembership.objects.create(
        seller=seller_a, user=owner_a, role=owner_role, status="active", joined_at=timezone.now()
    )
    SellerMembership.objects.create(
        seller=seller_a,
        user=staff_a,
        role=order_mgr_role,
        status="active",
        joined_at=timezone.now(),
    )
    SellerMembership.objects.create(
        seller=seller_b, user=owner_b, role=owner_role, status="active", joined_at=timezone.now()
    )

    category = Category.objects.create(name="Groceries", slug="groceries-ord")
    prod_a = catalog_services.create_product(
        owner_a, seller_a.pk, {"category_id": category.pk, "name": "Apple"}
    )
    prod_b = catalog_services.create_product(
        owner_b, seller_b.pk, {"category_id": category.pk, "name": "Banana"}
    )

    variant_a = catalog_services.save_variant(
        owner_a, seller_a.pk, prod_a.pk, {"sku": "ORD-APPLE", "price": "100.00"}
    )
    variant_b = catalog_services.save_variant(
        owner_b, seller_b.pk, prod_b.pk, {"sku": "ORD-BANANA", "price": "50.00"}
    )

    # Approve products for sale
    prod_a.status = "active"
    prod_a.save()
    prod_b.status = "active"
    prod_b.save()

    warehouse_a = inventory_services.create_warehouse(
        seller_a.pk,
        owner_a,
        {"name": "Wh A", "code": "wh-ord-a", "address": "Kathmandu"},
    )
    warehouse_b = inventory_services.create_warehouse(
        seller_b.pk,
        owner_b,
        {"name": "Wh B", "code": "wh-ord-b", "address": "Pokhara"},
    )

    inventory_a = inventory_services.get_or_create_inventory(
        seller_a.pk,
        owner_a,
        warehouse_a.pk,
        variant_a.pk,
    )
    inventory_b = inventory_services.get_or_create_inventory(
        seller_b.pk,
        owner_b,
        warehouse_b.pk,
        variant_b.pk,
    )

    # Stock initial inventory
    inventory_services.adjust_inventory(
        seller_a.pk,
        owner_a,
        inventory_a.pk,
        quantity_delta=50,
        reason="Initial stock",
    )
    inventory_services.adjust_inventory(
        seller_b.pk,
        owner_b,
        inventory_b.pk,
        quantity_delta=30,
        reason="Initial stock",
    )
    inventory_a.refresh_from_db()
    inventory_b.refresh_from_db()

    return Setup(
        owner_a=owner_a,
        staff_a=staff_a,
        owner_b=owner_b,
        admin=admin,
        customer=customer,
        seller_a=seller_a,
        seller_b=seller_b,
        warehouse_a=warehouse_a,
        warehouse_b=warehouse_b,
        variant_a=variant_a,
        variant_b=variant_b,
        inventory_a=inventory_a,
        inventory_b=inventory_b,
        browser_a=client(owner_a),
        browser_b=client(owner_b),
        platform=client(admin),
    )


def test_multi_seller_order_creation_reserves_inventory(setup: Setup) -> None:
    order = services.create_order(
        actor=setup.owner_a,
        customer=setup.customer,
        customer_email="customer@example.com",
        currency="NPR",
        items_data=[
            {
                "variant_id": setup.variant_a.pk,
                "warehouse_id": setup.warehouse_a.pk,
                "quantity": 3,
                "unit_price": "100.00",
                "tax_amount": "10.00",
                "discount_amount": "5.00",
            },
            {
                "variant_id": setup.variant_b.pk,
                "warehouse_id": setup.warehouse_b.pk,
                "quantity": 4,
                "unit_price": "50.00",
                "tax_amount": "5.00",
                "discount_amount": "0.00",
            },
        ],
        billing_address={"city": "Kathmandu"},
        shipping_address={"city": "Kathmandu"},
    )

    assert order.payment_status == Order.PaymentStatus.PENDING
    assert order.fulfillment_status == Order.FulfillmentStatus.UNFULFILLED
    assert order.subtotal == Decimal("500.00")  # (100*3) + (50*4)
    assert order.discount_total == Decimal("5.00")
    assert order.tax_total == Decimal("15.00")
    assert order.grand_total == Decimal("510.00")  # 500 - 5 + 15

    # Check child seller orders
    seller_orders = list(order.seller_orders.order_by("seller__slug"))
    assert len(seller_orders) == 2

    so_a = seller_orders[0]
    assert so_a.seller == setup.seller_a
    assert so_a.subtotal == Decimal("300.00")
    assert so_a.discount_total == Decimal("5.00")
    assert so_a.tax_total == Decimal("10.00")
    assert so_a.status == SellerOrder.Status.PENDING

    so_b = seller_orders[1]
    assert so_b.seller == setup.seller_b
    assert so_b.subtotal == Decimal("200.00")
    assert so_b.tax_total == Decimal("5.00")
    assert so_b.status == SellerOrder.Status.PENDING

    # Check inventory reservations
    setup.inventory_a.refresh_from_db()
    setup.inventory_b.refresh_from_db()
    assert setup.inventory_a.quantity_reserved == 3
    assert setup.inventory_a.available_quantity == 47
    assert setup.inventory_b.quantity_reserved == 4
    assert setup.inventory_b.available_quantity == 26

    # Verify reservation transactions in ledger
    tx_a = InventoryTransaction.objects.filter(
        inventory=setup.inventory_a, type=InventoryTransaction.Type.RESERVATION
    ).first()
    assert tx_a is not None
    assert tx_a.quantity_delta == 3
    assert tx_a.reference_id == str(so_a.pk)

    tx_b = InventoryTransaction.objects.filter(
        inventory=setup.inventory_b, type=InventoryTransaction.Type.RESERVATION
    ).first()
    assert tx_b is not None
    assert tx_b.quantity_delta == 4
    assert tx_b.reference_id == str(so_b.pk)


def test_multi_seller_order_insufficient_stock_rolls_back(setup: Setup) -> None:
    # Try to order more than available for seller B
    with pytest.raises(ValidationError):
        services.create_order(
            actor=setup.owner_a,
            customer_email="customer@example.com",
            currency="NPR",
            items_data=[
                {
                    "variant_id": setup.variant_a.pk,
                    "warehouse_id": setup.warehouse_a.pk,
                    "quantity": 5,
                    "unit_price": "100.00",
                },
                {
                    "variant_id": setup.variant_b.pk,
                    "warehouse_id": setup.warehouse_b.pk,
                    "quantity": 100,  # exceeds available 30
                    "unit_price": "50.00",
                },
            ],
            billing_address={},
            shipping_address={},
        )

    # Verify nothing was created or reserved
    assert Order.objects.count() == 0
    assert SellerOrder.objects.count() == 0
    setup.inventory_a.refresh_from_db()
    setup.inventory_b.refresh_from_db()
    assert setup.inventory_a.quantity_reserved == 0
    assert setup.inventory_b.quantity_reserved == 0


def test_cross_seller_order_isolation(setup: Setup) -> None:
    order = services.create_order(
        customer_email="customer@example.com",
        currency="NPR",
        items_data=[
            {
                "variant_id": setup.variant_a.pk,
                "warehouse_id": setup.warehouse_a.pk,
                "quantity": 2,
                "unit_price": "100.00",
            },
            {
                "variant_id": setup.variant_b.pk,
                "warehouse_id": setup.warehouse_b.pk,
                "quantity": 1,
                "unit_price": "50.00",
            },
        ],
        billing_address={},
        shipping_address={},
    )
    so_a = order.seller_orders.get(seller=setup.seller_a)
    so_b = order.seller_orders.get(seller=setup.seller_b)

    # Seller A listing orders: sees only so_a
    res = setup.browser_a.get(
        "/api/v1/seller/orders/",
        HTTP_X_SELLER_ID=str(setup.seller_a.pk),
    )
    assert res.status_code == 200
    ids = [item["id"] for item in res.json()["results"]]
    assert str(so_a.pk) in ids
    assert str(so_b.pk) not in ids

    # Seller A detail request for Seller B order returns 404
    res_forbidden = setup.browser_a.get(
        f"/api/v1/seller/orders/{so_b.pk}/",
        HTTP_X_SELLER_ID=str(setup.seller_a.pk),
    )
    assert res_forbidden.status_code == 404

    # Seller A attempting to confirm Seller B's order returns 404
    res_confirm = setup.browser_a.post(
        f"/api/v1/seller/orders/{so_b.pk}/confirm/",
        {},
        format="json",
        HTTP_X_SELLER_ID=str(setup.seller_a.pk),
    )
    assert res_confirm.status_code == 404


def test_valid_order_state_machine_flow(setup: Setup) -> None:
    order = services.create_order(
        customer_email="customer@example.com",
        currency="NPR",
        items_data=[
            {
                "variant_id": setup.variant_a.pk,
                "warehouse_id": setup.warehouse_a.pk,
                "quantity": 5,
                "unit_price": "100.00",
            }
        ],
        billing_address={},
        shipping_address={},
    )
    so_a = order.seller_orders.get(seller=setup.seller_a)

    # 1. PENDING -> CONFIRMED
    res = setup.browser_a.post(
        f"/api/v1/seller/orders/{so_a.pk}/confirm/",
        {},
        format="json",
        HTTP_X_SELLER_ID=str(setup.seller_a.pk),
    )
    assert res.status_code == 200
    assert res.json()["status"] == "confirmed"

    # 2. CONFIRMED -> PROCESSING
    res = setup.browser_a.post(
        f"/api/v1/seller/orders/{so_a.pk}/begin-processing/",
        {},
        format="json",
        HTTP_X_SELLER_ID=str(setup.seller_a.pk),
    )
    assert res.status_code == 200
    assert res.json()["status"] == "processing"

    # 3. PROCESSING -> SHIPPED (consumes reserved inventory)
    res = setup.browser_a.post(
        f"/api/v1/seller/orders/{so_a.pk}/ship/",
        {"carrier": "Nepal Express", "tracking_number": "NEX-12345"},
        format="json",
        HTTP_X_SELLER_ID=str(setup.seller_a.pk),
    )
    assert res.status_code == 200
    assert res.json()["status"] == "shipped"

    # Verify inventory consumption
    setup.inventory_a.refresh_from_db()
    assert setup.inventory_a.quantity_reserved == 0
    assert setup.inventory_a.quantity_on_hand == 45  # 50 - 5
    assert setup.inventory_a.available_quantity == 45

    # Check sale transaction logged
    sale_tx = InventoryTransaction.objects.filter(
        inventory=setup.inventory_a, type=InventoryTransaction.Type.SALE
    ).first()
    assert sale_tx is not None
    assert sale_tx.quantity_delta == -5

    # Check parent order partial fulfillment
    order.refresh_from_db()
    assert order.fulfillment_status == Order.FulfillmentStatus.PARTIALLY_FULFILLED

    # 4. SHIPPED -> DELIVERED
    res = setup.browser_a.post(
        f"/api/v1/seller/orders/{so_a.pk}/deliver/",
        {},
        format="json",
        HTTP_X_SELLER_ID=str(setup.seller_a.pk),
    )
    assert res.status_code == 200
    assert res.json()["status"] == "delivered"

    # Parent order is now fulfilled (all child orders delivered)
    order.refresh_from_db()
    assert order.fulfillment_status == Order.FulfillmentStatus.FULFILLED

    # Verify status history timeline
    history = list(so_a.status_history.order_by("created_at"))
    assert len(history) == 5
    assert history[0].to_status == "pending"
    assert history[1].to_status == "confirmed"
    assert history[2].to_status == "processing"
    assert history[3].to_status == "shipped"
    assert history[4].to_status == "delivered"


def test_invalid_state_transitions_rejected(setup: Setup) -> None:
    order = services.create_order(
        customer_email="customer@example.com",
        currency="NPR",
        items_data=[
            {
                "variant_id": setup.variant_a.pk,
                "warehouse_id": setup.warehouse_a.pk,
                "quantity": 2,
                "unit_price": "100.00",
            }
        ],
        billing_address={},
        shipping_address={},
    )
    so_a = order.seller_orders.get(seller=setup.seller_a)

    # Cannot ship pending order
    res = setup.browser_a.post(
        f"/api/v1/seller/orders/{so_a.pk}/ship/",
        {},
        format="json",
        HTTP_X_SELLER_ID=str(setup.seller_a.pk),
    )
    assert res.status_code == 400

    # Cannot deliver pending order
    res = setup.browser_a.post(
        f"/api/v1/seller/orders/{so_a.pk}/deliver/",
        {},
        format="json",
        HTTP_X_SELLER_ID=str(setup.seller_a.pk),
    )
    assert res.status_code == 400

    # Confirm order
    setup.browser_a.post(
        f"/api/v1/seller/orders/{so_a.pk}/confirm/",
        {},
        format="json",
        HTTP_X_SELLER_ID=str(setup.seller_a.pk),
    )

    # Double confirm rejected
    res_double = setup.browser_a.post(
        f"/api/v1/seller/orders/{so_a.pk}/confirm/",
        {},
        format="json",
        HTTP_X_SELLER_ID=str(setup.seller_a.pk),
    )
    assert res_double.status_code == 400


def test_cancellation_releases_inventory(setup: Setup) -> None:
    order = services.create_order(
        customer_email="customer@example.com",
        currency="NPR",
        items_data=[
            {
                "variant_id": setup.variant_a.pk,
                "warehouse_id": setup.warehouse_a.pk,
                "quantity": 10,
                "unit_price": "100.00",
            }
        ],
        billing_address={},
        shipping_address={},
    )
    so_a = order.seller_orders.get(seller=setup.seller_a)

    setup.inventory_a.refresh_from_db()
    assert setup.inventory_a.quantity_reserved == 10

    # Cancel without reason fails
    res_no_reason = setup.browser_a.post(
        f"/api/v1/seller/orders/{so_a.pk}/cancel/",
        {"reason": "   "},
        format="json",
        HTTP_X_SELLER_ID=str(setup.seller_a.pk),
    )
    assert res_no_reason.status_code == 400

    # Cancel with reason succeeds
    res_cancel = setup.browser_a.post(
        f"/api/v1/seller/orders/{so_a.pk}/cancel/",
        {"reason": "Customer changed mind"},
        format="json",
        HTTP_X_SELLER_ID=str(setup.seller_a.pk),
    )
    assert res_cancel.status_code == 200
    assert res_cancel.json()["status"] == "cancelled"

    # Inventory reserved is released
    setup.inventory_a.refresh_from_db()
    assert setup.inventory_a.quantity_reserved == 0
    assert setup.inventory_a.quantity_on_hand == 50
    assert setup.inventory_a.available_quantity == 50

    # Release transaction exists in ledger
    release_tx = InventoryTransaction.objects.filter(
        inventory=setup.inventory_a, type=InventoryTransaction.Type.RELEASE
    ).first()
    assert release_tx is not None
    assert release_tx.quantity_delta == -10

    # Parent order status is cancelled
    order.refresh_from_db()
    assert order.fulfillment_status == Order.FulfillmentStatus.CANCELLED


def test_cannot_cancel_shipped_order(setup: Setup) -> None:
    order = services.create_order(
        customer_email="customer@example.com",
        currency="NPR",
        items_data=[
            {
                "variant_id": setup.variant_a.pk,
                "warehouse_id": setup.warehouse_a.pk,
                "quantity": 1,
                "unit_price": "100.00",
            }
        ],
        billing_address={},
        shipping_address={},
    )
    so_a = order.seller_orders.get(seller=setup.seller_a)
    services.confirm_seller_order(
        seller_id=setup.seller_a.pk, actor=setup.owner_a, seller_order_id=so_a.pk
    )
    services.begin_processing_seller_order(
        seller_id=setup.seller_a.pk, actor=setup.owner_a, seller_order_id=so_a.pk
    )
    services.ship_seller_order(
        seller_id=setup.seller_a.pk, actor=setup.owner_a, seller_order_id=so_a.pk
    )

    # Cancellation rejected for shipped order
    with pytest.raises(ValidationError):
        services.cancel_seller_order(
            seller_id=setup.seller_a.pk,
            actor=setup.owner_a,
            seller_order_id=so_a.pk,
            reason="Too late",
        )


@pytest.mark.django_db(transaction=True, serialized_rollback=True)
def test_concurrent_order_transition_safety(setup: Setup) -> None:
    order = services.create_order(
        customer_email="customer@example.com",
        currency="NPR",
        items_data=[
            {
                "variant_id": setup.variant_a.pk,
                "warehouse_id": setup.warehouse_a.pk,
                "quantity": 2,
                "unit_price": "100.00",
            }
        ],
        billing_address={},
        shipping_address={},
    )
    so_a = order.seller_orders.get(seller=setup.seller_a)

    barrier = Barrier(2)
    results: list[bool] = []

    def worker(user_id: str) -> None:
        close_old_connections()
        barrier.wait()
        try:
            user = User.objects.get(pk=user_id)
            services.confirm_seller_order(
                seller_id=setup.seller_a.pk,
                actor=user,
                seller_order_id=so_a.pk,
            )
            results.append(True)
        except ValidationError:
            results.append(False)
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(worker, str(setup.owner_a.pk))
        f2 = executor.submit(worker, str(setup.staff_a.pk))
        f1.result()
        f2.result()

    # Exactly one succeeded and one was rejected
    assert results.count(True) == 1
    assert results.count(False) == 1


def test_order_snapshots_immutable_when_catalog_mutates(setup: Setup) -> None:
    order = services.create_order(
        customer_email="customer@example.com",
        currency="NPR",
        items_data=[
            {
                "variant_id": setup.variant_a.pk,
                "warehouse_id": setup.warehouse_a.pk,
                "quantity": 2,
                "unit_price": "100.00",
            }
        ],
        billing_address={},
        shipping_address={},
    )
    so_a = order.seller_orders.first()
    assert so_a is not None
    item = so_a.items.first()
    assert item is not None
    assert item.product_name_snapshot == "Apple"
    assert item.sku_snapshot == "ORD-APPLE"
    assert item.unit_price == Decimal("100.00")

    # Mutate product name and variant price in catalog
    setup.variant_a.product.name = "Mutated Super Apple"
    setup.variant_a.product.save()
    setup.variant_a.price = Decimal("999.00")
    setup.variant_a.save()

    # Snapshot retains historical values
    item.refresh_from_db()
    assert item.product_name_snapshot == "Apple"
    assert item.sku_snapshot == "ORD-APPLE"
    assert item.unit_price == Decimal("100.00")


def test_postgres_triggers_protect_order_integrity(setup: Setup) -> None:
    order = services.create_order(
        customer_email="customer@example.com",
        currency="NPR",
        items_data=[
            {
                "variant_id": setup.variant_a.pk,
                "warehouse_id": setup.warehouse_a.pk,
                "quantity": 2,
                "unit_price": "100.00",
            }
        ],
        billing_address={},
        shipping_address={},
    )
    so_a = order.seller_orders.first()
    assert so_a is not None
    item = so_a.items.first()
    assert item is not None
    history = so_a.status_history.first()
    assert history is not None

    # 1. OrderStatusHistory UPDATE / DELETE rejected
    with pytest.raises((IntegrityError, DatabaseError)), transaction.atomic():
        history.notes = "Mutated note"
        history.save()

    with pytest.raises((IntegrityError, DatabaseError)), transaction.atomic():
        history.delete()

    # 2. OrderItem UPDATE / DELETE rejected
    with pytest.raises((IntegrityError, DatabaseError)), transaction.atomic():
        item.quantity = 99
        item.save()

    with pytest.raises((IntegrityError, DatabaseError)), transaction.atomic():
        item.delete()

    # 3. SellerOrder identity mutation rejected
    with pytest.raises((IntegrityError, DatabaseError)), transaction.atomic():
        so_a.seller = setup.seller_b
        so_a.save()

    # 4. Cross-tenant OrderItem insertion rejected by trigger
    with pytest.raises((IntegrityError, DatabaseError)), transaction.atomic():
        OrderItem.objects.create(
            seller_order=so_a,
            product=setup.variant_b.product,  # foreign product!
            variant=setup.variant_b,
            warehouse=setup.warehouse_a,
            product_name_snapshot="Foreign",
            sku_snapshot="FOREIGN",
            quantity=1,
            unit_price=Decimal("10.00"),
            total=Decimal("10.00"),
            seller_net_amount=Decimal("10.00"),
        )


def test_platform_admin_order_inspection(setup: Setup) -> None:
    order = services.create_order(
        customer_email="customer@example.com",
        currency="NPR",
        items_data=[
            {
                "variant_id": setup.variant_a.pk,
                "warehouse_id": setup.warehouse_a.pk,
                "quantity": 2,
                "unit_price": "100.00",
            },
            {
                "variant_id": setup.variant_b.pk,
                "warehouse_id": setup.warehouse_b.pk,
                "quantity": 3,
                "unit_price": "50.00",
            },
        ],
        billing_address={},
        shipping_address={},
    )

    # Platform admin lists orders
    res = setup.platform.get("/api/v1/admin/orders/")
    assert res.status_code == 200
    results = res.json()["results"]
    assert len(results) >= 1
    assert results[0]["seller_orders_count"] == 2

    # Platform admin inspects detail with child seller orders
    res_detail = setup.platform.get(f"/api/v1/admin/orders/{order.pk}/")
    assert res_detail.status_code == 200
    data = res_detail.json()
    assert len(data["seller_orders"]) == 2

    # Regular seller browser gets 403 on platform orders
    res_forbidden = setup.browser_a.get("/api/v1/admin/orders/")
    assert res_forbidden.status_code == 403


def test_financial_totals_and_decimal_precision(setup: Setup) -> None:
    order = services.create_order(
        customer_email="customer@example.com",
        currency="NPR",
        items_data=[
            {
                "variant_id": setup.variant_a.pk,
                "warehouse_id": setup.warehouse_a.pk,
                "quantity": 3,
                "unit_price": "100.33",
                "discount_amount": "5.50",
                "tax_amount": "12.35",
                "commission_amount": "10.00",
            }
        ],
        billing_address={},
        shipping_address={},
    )
    so_a = order.seller_orders.first()
    assert so_a is not None
    item = so_a.items.first()
    assert item is not None

    # Exact decimal arithmetic: (100.33 * 3) - 5.50 + 12.35 = 300.99 - 5.50 + 12.35 = 307.84
    assert item.total == Decimal("307.84")
    # seller_net = 307.84 - 10.00 = 297.84
    assert item.seller_net_amount == Decimal("297.84")
    assert so_a.subtotal == Decimal("300.99")
    assert so_a.discount_total == Decimal("5.50")
    assert so_a.tax_total == Decimal("12.35")
    assert so_a.commission_total == Decimal("10.00")
    assert so_a.seller_net_total == Decimal("297.84")
    assert order.grand_total == Decimal("307.84")

    # Negative amounts rejected by check constraints
    with pytest.raises((IntegrityError, DatabaseError)), transaction.atomic():
        OrderItem.objects.create(
            seller_order=so_a,
            product=setup.variant_a.product,
            variant=setup.variant_a,
            warehouse=setup.warehouse_a,
            product_name_snapshot="Apple",
            sku_snapshot="ORD-APPLE",
            quantity=1,
            unit_price=Decimal("-10.00"),  # negative!
            total=Decimal("0.00"),
            seller_net_amount=Decimal("0.00"),
        )
