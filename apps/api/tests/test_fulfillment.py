from dataclasses import dataclass
from decimal import Decimal
from uuid import uuid4

import pytest
from django.db import DatabaseError, IntegrityError, transaction
from django.http import Http404
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.catalog.models import Category, Product, ProductVariant
from apps.finance.models import CommissionPlan, SellerBalance, SellerLedgerEntry
from apps.finance.services import settle_seller_order
from apps.fulfillment import services
from apps.fulfillment.models import (
    Refund,
    ReturnItem,
    ReturnRequest,
    Shipment,
    ShipmentItem,
)
from apps.inventory.models import Inventory, InventoryTransaction, Warehouse
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
class FulfillmentSetup:
    owner_a: User
    owner_b: User
    admin: User
    regular: User
    seller_a: Seller
    seller_b: Seller
    category: Category
    product_a: Product
    variant_a1: ProductVariant
    variant_a2: ProductVariant
    warehouse_a: Warehouse
    inv_a1: Inventory
    inv_a2: Inventory
    product_b: Product
    variant_b: ProductVariant
    warehouse_b: Warehouse
    inv_b: Inventory
    browser_a: APIClient
    browser_b: APIClient
    platform: APIClient


@pytest.fixture
def setup() -> FulfillmentSetup:
    owner_a = User.objects.create_user("ful-owner-a@example.com")
    owner_b = User.objects.create_user("ful-owner-b@example.com")
    admin = User.objects.create_user("ful-admin@example.com")
    regular = User.objects.create_user("ful-regular@example.com")

    PlatformAccess.objects.create(
        user=admin, role=PlatformRole.objects.get(name="SUPER_ADMIN"), is_active=True
    )

    CommissionPlan.objects.get_or_create(
        is_default=True,
        defaults={"name": "Default Plan", "default_percentage": Decimal("10.00")},
    )

    seller_a = Seller.objects.create(
        legal_name="Fulfillment Corp A",
        display_name="Seller A",
        slug="seller-ful-a",
        status=Seller.Status.ACTIVE,
        verification_status=Seller.VerificationStatus.VERIFIED,
        email="ful-a@example.com",
    )
    seller_b = Seller.objects.create(
        legal_name="Fulfillment Corp B",
        display_name="Seller B",
        slug="seller-ful-b",
        status=Seller.Status.ACTIVE,
        verification_status=Seller.VerificationStatus.VERIFIED,
        email="ful-b@example.com",
    )

    owner_role = SellerRole.objects.get(name="OWNER", seller__isnull=True)
    SellerMembership.objects.create(
        seller=seller_a,
        user=owner_a,
        role=owner_role,
        status=SellerMembership.Status.ACTIVE,
        joined_at=timezone.now(),
    )
    SellerMembership.objects.create(
        seller=seller_b,
        user=owner_b,
        role=owner_role,
        status=SellerMembership.Status.ACTIVE,
        joined_at=timezone.now(),
    )

    SellerBalance.objects.create(seller=seller_a, current_balance=Decimal("0.00"))
    SellerBalance.objects.create(seller=seller_b, current_balance=Decimal("0.00"))

    category = Category.objects.create(name="Fulfillment Cat", slug="ful-cat")

    # Seller A inventory
    product_a = Product.objects.create(
        seller=seller_a,
        category=category,
        name="Widget A",
        slug="widget-a",
        status=Product.Status.ACTIVE,
        created_by=owner_a,
    )
    variant_a1 = ProductVariant.objects.create(
        product=product_a,
        seller=seller_a,
        sku="SKU-A1",
        price=Decimal("100.00"),
        status=ProductVariant.Status.ACTIVE,
    )
    variant_a2 = ProductVariant.objects.create(
        product=product_a,
        seller=seller_a,
        sku="SKU-A2",
        price=Decimal("50.00"),
        status=ProductVariant.Status.ACTIVE,
    )
    warehouse_a = Warehouse.objects.create(seller=seller_a, name="WH-A", code="wh-a")
    inv_a1 = Inventory.objects.create(
        warehouse=warehouse_a,
        variant=variant_a1,
        quantity_on_hand=50,
        quantity_reserved=10,
    )
    inv_a2 = Inventory.objects.create(
        warehouse=warehouse_a,
        variant=variant_a2,
        quantity_on_hand=30,
        quantity_reserved=5,
    )

    # Seller B inventory
    product_b = Product.objects.create(
        seller=seller_b,
        category=category,
        name="Widget B",
        slug="widget-b",
        status=Product.Status.ACTIVE,
        created_by=owner_b,
    )
    variant_b = ProductVariant.objects.create(
        product=product_b,
        seller=seller_b,
        sku="SKU-B",
        price=Decimal("200.00"),
        status=ProductVariant.Status.ACTIVE,
    )
    warehouse_b = Warehouse.objects.create(seller=seller_b, name="WH-B", code="wh-b")
    inv_b = Inventory.objects.create(
        warehouse=warehouse_b,
        variant=variant_b,
        quantity_on_hand=40,
        quantity_reserved=5,
    )

    browser_a = client(owner_a)
    browser_a.credentials(
        HTTP_X_CSRFTOKEN=browser_a.get("/api/v1/auth/csrf").json()["csrf_token"],
        HTTP_X_SELLER_ID=str(seller_a.pk),
    )

    browser_b = client(owner_b)
    browser_b.credentials(
        HTTP_X_CSRFTOKEN=browser_b.get("/api/v1/auth/csrf").json()["csrf_token"],
        HTTP_X_SELLER_ID=str(seller_b.pk),
    )

    platform = client(admin)

    return FulfillmentSetup(
        owner_a=owner_a,
        owner_b=owner_b,
        admin=admin,
        regular=regular,
        seller_a=seller_a,
        seller_b=seller_b,
        category=category,
        product_a=product_a,
        variant_a1=variant_a1,
        variant_a2=variant_a2,
        warehouse_a=warehouse_a,
        inv_a1=inv_a1,
        inv_a2=inv_a2,
        product_b=product_b,
        variant_b=variant_b,
        warehouse_b=warehouse_b,
        inv_b=inv_b,
        browser_a=browser_a,
        browser_b=browser_b,
        platform=platform,
    )


def create_test_order(setup: FulfillmentSetup) -> tuple[Order, SellerOrder, OrderItem, OrderItem]:
    order = Order.objects.create(
        order_number=f"ORD-{uuid4().hex[:8].upper()}",
        customer=setup.regular,
        customer_email="customer@example.com",
        currency="USD",
        subtotal=Decimal("350.00"),
        grand_total=Decimal("350.00"),
    )
    so_a = SellerOrder.objects.create(
        order=order,
        seller=setup.seller_a,
        seller_order_number=f"SOA-{uuid4().hex[:8].upper()}",
        subtotal=Decimal("350.00"),
        commission_total=Decimal("35.00"),  # 10%
        seller_net_total=Decimal("315.00"),
        status=SellerOrder.Status.PROCESSING,
    )
    oi_a1 = OrderItem.objects.create(
        seller_order=so_a,
        product=setup.product_a,
        variant=setup.variant_a1,
        warehouse=setup.warehouse_a,
        product_name_snapshot="Widget A",
        sku_snapshot="SKU-A1",
        quantity=3,
        unit_price=Decimal("100.00"),
        total=Decimal("300.00"),
        commission_amount=Decimal("30.00"),
        seller_net_amount=Decimal("270.00"),
    )
    oi_a2 = OrderItem.objects.create(
        seller_order=so_a,
        product=setup.product_a,
        variant=setup.variant_a2,
        warehouse=setup.warehouse_a,
        product_name_snapshot="Widget A2",
        sku_snapshot="SKU-A2",
        quantity=1,
        unit_price=Decimal("50.00"),
        total=Decimal("50.00"),
        commission_amount=Decimal("5.00"),
        seller_net_amount=Decimal("45.00"),
    )
    # Settle finance
    settle_seller_order(so_a)
    return order, so_a, oi_a1, oi_a2


# -------------------------------------------------------------------------
# Test Cases
# -------------------------------------------------------------------------


def test_shipment_lifecycle_and_order_fulfillment_sync(setup: FulfillmentSetup) -> None:
    order, so_a, oi_a1, oi_a2 = create_test_order(setup)

    initial_on_hand_1 = setup.inv_a1.quantity_on_hand
    initial_reserved_1 = setup.inv_a1.quantity_reserved

    # Create shipment for all items
    shipment = services.create_shipment(
        actor=setup.owner_a,
        seller_id=setup.seller_a.pk,
        seller_order_id=so_a.pk,
        carrier="FedEx",
        tracking_number="FX-12345678",
        items_data=[
            {"order_item_id": oi_a1.pk, "quantity": 3},
            {"order_item_id": oi_a2.pk, "quantity": 1},
        ],
    )

    assert shipment.status == Shipment.Status.SHIPPED
    assert shipment.tracking_events.count() == 1

    # Verify inventory was consumed
    setup.inv_a1.refresh_from_db()
    assert setup.inv_a1.quantity_on_hand == initial_on_hand_1 - 3
    assert setup.inv_a1.quantity_reserved == initial_reserved_1 - 3

    # Verify seller order is shipped and parent order is partially or fulfilled
    so_a.refresh_from_db()
    assert so_a.status == SellerOrder.Status.SHIPPED

    # Add tracking event
    services.add_tracking_event(
        actor=setup.owner_a,
        seller_id=setup.seller_a.pk,
        shipment_id=shipment.pk,
        status="in_transit",
        location="Distribution Hub",
        description="Departed facility",
    )
    shipment.refresh_from_db()
    assert shipment.status == "in_transit"
    assert shipment.tracking_events.count() == 2

    # Mark delivered
    services.mark_shipment_delivered(
        actor=setup.owner_a,
        seller_id=setup.seller_a.pk,
        shipment_id=shipment.pk,
    )
    shipment.refresh_from_db()
    assert shipment.status == Shipment.Status.DELIVERED
    assert shipment.delivered_at is not None

    # Seller order should be DELIVERED and Order fulfilled
    so_a.refresh_from_db()
    order.refresh_from_db()
    assert so_a.status == SellerOrder.Status.DELIVERED
    assert order.fulfillment_status == Order.FulfillmentStatus.FULFILLED


def test_partial_shipments_and_quantity_overflow(setup: FulfillmentSetup) -> None:
    order, so_a, oi_a1, oi_a2 = create_test_order(setup)

    # 1. Partial shipment: ship 2 out of 3 units of oi_a1
    shipment_1 = services.create_shipment(
        actor=setup.owner_a,
        seller_id=setup.seller_a.pk,
        seller_order_id=so_a.pk,
        carrier="USPS",
        tracking_number="USPS-111",
        items_data=[{"order_item_id": oi_a1.pk, "quantity": 2}],
    )
    first_item = shipment_1.items.first()
    assert first_item is not None
    assert first_item.quantity == 2

    # 2. Attempting to ship 2 more (total 4 > 3) must fail with ValidationError
    with pytest.raises(ValidationError) as exc:
        services.create_shipment(
            actor=setup.owner_a,
            seller_id=setup.seller_a.pk,
            seller_order_id=so_a.pk,
            carrier="USPS",
            tracking_number="USPS-222",
            items_data=[{"order_item_id": oi_a1.pk, "quantity": 2}],
        )
    assert "remaining" in str(exc.value)

    # 3. Shipping remaining 1 unit of oi_a1 and 1 unit of oi_a2 succeeds
    shipment_2 = services.create_shipment(
        actor=setup.owner_a,
        seller_id=setup.seller_a.pk,
        seller_order_id=so_a.pk,
        carrier="USPS",
        tracking_number="USPS-333",
        items_data=[
            {"order_item_id": oi_a1.pk, "quantity": 1},
            {"order_item_id": oi_a2.pk, "quantity": 1},
        ],
    )
    assert shipment_2.items.count() == 2


def test_cross_seller_shipment_injection_denied(setup: FulfillmentSetup) -> None:
    order, so_a, oi_a1, oi_a2 = create_test_order(setup)

    # Foreign order item from Seller B
    so_b = SellerOrder.objects.create(
        order=order,
        seller=setup.seller_b,
        seller_order_number=f"SOB-{uuid4().hex[:8].upper()}",
        subtotal=Decimal("200.00"),
        status=SellerOrder.Status.PROCESSING,
    )
    oi_b = OrderItem.objects.create(
        seller_order=so_b,
        product=setup.product_b,
        variant=setup.variant_b,
        warehouse=setup.warehouse_b,
        product_name_snapshot="Widget B",
        sku_snapshot="SKU-B",
        quantity=1,
        unit_price=Decimal("200.00"),
        total=Decimal("200.00"),
        seller_net_amount=Decimal("180.00"),
    )

    # 1. Service rejection: Seller A trying to include oi_b in a shipment on so_a
    with pytest.raises(Http404):
        services.create_shipment(
            actor=setup.owner_a,
            seller_id=setup.seller_a.pk,
            seller_order_id=so_a.pk,
            carrier="UPS",
            items_data=[{"order_item_id": oi_b.pk, "quantity": 1}],
        )

    # 2. Database trigger rejection: Direct insert of foreign order_item on shipment
    shipment = Shipment.objects.create(
        shipment_number=f"SHP-{uuid4().hex[:8].upper()}",
        seller_order=so_a,
        seller=setup.seller_a,
        carrier="UPS",
    )
    with pytest.raises((IntegrityError, DatabaseError)), transaction.atomic():
        ShipmentItem.objects.create(shipment=shipment, order_item=oi_b, quantity=1)


def test_return_request_lifecycle_and_state_machine(setup: FulfillmentSetup) -> None:
    order, so_a, oi_a1, _ = create_test_order(setup)
    so_a.status = SellerOrder.Status.DELIVERED
    so_a.save()

    # 1. Customer/staff requests return
    ret = services.create_return_request(
        actor=setup.regular,
        seller_order_id=so_a.pk,
        reason="defective",
        customer_notes="Item did not power on",
        items_data=[{"order_item_id": oi_a1.pk, "quantity": 1, "reason": "broken"}],
    )
    assert ret.status == ReturnRequest.Status.REQUESTED
    assert ret.status_history.count() == 1

    # 2. Approve return
    services.approve_return_request(
        actor=setup.owner_a,
        seller_id=setup.seller_a.pk,
        return_id=ret.pk,
        return_carrier="USPS Return",
        return_tracking_number="RET-TRK-123",
    )
    ret.refresh_from_db()
    assert ret.status == ReturnRequest.Status.APPROVED
    assert ret.approved_at is not None

    # 3. Mark in transit
    services.mark_return_in_transit(
        actor=setup.owner_a,
        seller_id=setup.seller_a.pk,
        return_id=ret.pk,
    )
    ret.refresh_from_db()
    assert ret.status == ReturnRequest.Status.IN_TRANSIT

    # 4. Receive return with inspection
    ret_item_1 = ret.items.first()
    assert ret_item_1 is not None
    services.receive_return_request(
        actor=setup.owner_a,
        seller_id=setup.seller_a.pk,
        return_id=ret.pk,
        items_inspection=[
            {
                "return_item_id": ret_item_1.pk,
                "condition": "opened",
                "restock_inventory": True,
            }
        ],
    )
    ret.refresh_from_db()
    assert ret.status == ReturnRequest.Status.REFUND_PENDING
    assert ret.received_at is not None

    # 5. Process refund to finalize return
    refund = services.process_refund(
        actor=setup.owner_a,
        seller_id=setup.seller_a.pk,
        seller_order_id=so_a.pk,
        amount=Decimal("100.00"),
        reason="Defective item return",
        return_request_id=ret.pk,
    )
    ret.refresh_from_db()
    assert ret.status == ReturnRequest.Status.REFUNDED
    assert ret.closed_at is not None
    assert refund.status == Refund.Status.COMPLETED


def test_partial_returns_and_invalid_quantities(setup: FulfillmentSetup) -> None:
    order, so_a, oi_a1, _ = create_test_order(setup)
    so_a.status = SellerOrder.Status.DELIVERED
    so_a.save()

    # 1. Invalid quantity 0 or negative
    with pytest.raises(ValidationError):
        services.create_return_request(
            actor=setup.regular,
            seller_order_id=so_a.pk,
            reason="not_as_described",
            items_data=[{"order_item_id": oi_a1.pk, "quantity": 0}],
        )

    # 2. Return 1 of 3
    ret1 = services.create_return_request(
        actor=setup.regular,
        seller_order_id=so_a.pk,
        reason="wrong_item",
        items_data=[{"order_item_id": oi_a1.pk, "quantity": 1}],
    )
    ret1_item = ret1.items.first()
    assert ret1_item is not None
    assert ret1_item.quantity == 1

    # 3. Attempting to return 3 more (total 4 > 3) must fail
    with pytest.raises(ValidationError) as exc:
        services.create_return_request(
            actor=setup.regular,
            seller_order_id=so_a.pk,
            reason="extra_wrong",
            items_data=[{"order_item_id": oi_a1.pk, "quantity": 3}],
        )
    assert "returnable" in str(exc.value)

    # 4. Return remaining 2 units succeeds
    ret2 = services.create_return_request(
        actor=setup.regular,
        seller_order_id=so_a.pk,
        reason="extra_wrong",
        items_data=[{"order_item_id": oi_a1.pk, "quantity": 2}],
    )
    ret2_item = ret2.items.first()
    assert ret2_item is not None
    assert ret2_item.quantity == 2


def test_cross_seller_return_injection_denied(setup: FulfillmentSetup) -> None:
    order, so_a, oi_a1, _ = create_test_order(setup)
    so_a.status = SellerOrder.Status.DELIVERED
    so_a.save()

    # Create seller B order item
    so_b = SellerOrder.objects.create(
        order=order,
        seller=setup.seller_b,
        seller_order_number=f"SOB-{uuid4().hex[:8].upper()}",
        subtotal=Decimal("200.00"),
        status=SellerOrder.Status.DELIVERED,
    )
    oi_b = OrderItem.objects.create(
        seller_order=so_b,
        product=setup.product_b,
        variant=setup.variant_b,
        warehouse=setup.warehouse_b,
        product_name_snapshot="Widget B",
        sku_snapshot="SKU-B",
        quantity=1,
        unit_price=Decimal("200.00"),
        total=Decimal("200.00"),
        seller_net_amount=Decimal("180.00"),
    )

    # 1. Service rejection: foreign order item on return request
    with pytest.raises(Http404):
        services.create_return_request(
            actor=setup.regular,
            seller_order_id=so_a.pk,
            reason="fake",
            items_data=[{"order_item_id": oi_b.pk, "quantity": 1}],
        )

    # 2. Database trigger rejection: direct cross-tenant ReturnItem insert
    ret = ReturnRequest.objects.create(
        return_number=f"RET-{uuid4().hex[:8].upper()}",
        seller_order=so_a,
        seller=setup.seller_a,
        reason="defect",
    )
    with pytest.raises((IntegrityError, DatabaseError)), transaction.atomic():
        ReturnItem.objects.create(return_request=ret, order_item=oi_b, quantity=1)


def test_return_inventory_restock_consistency(setup: FulfillmentSetup) -> None:
    order, so_a, oi_a1, oi_a2 = create_test_order(setup)
    so_a.status = SellerOrder.Status.DELIVERED
    so_a.save()

    initial_on_hand_1 = setup.inv_a1.quantity_on_hand
    initial_tx_count = InventoryTransaction.objects.filter(inventory=setup.inv_a1).count()

    # Create return request for 2 units of oi_a1
    ret = services.create_return_request(
        actor=setup.regular,
        seller_order_id=so_a.pk,
        reason="unwanted",
        items_data=[{"order_item_id": oi_a1.pk, "quantity": 2}],
    )
    services.approve_return_request(
        actor=setup.owner_a,
        seller_id=setup.seller_a.pk,
        return_id=ret.pk,
    )

    # Receive with restock_inventory = True
    ret_item_2 = ret.items.first()
    assert ret_item_2 is not None
    services.receive_return_request(
        actor=setup.owner_a,
        seller_id=setup.seller_a.pk,
        return_id=ret.pk,
        items_inspection=[
            {
                "return_item_id": ret_item_2.pk,
                "condition": "unopened",
                "restock_inventory": True,
            }
        ],
    )

    setup.inv_a1.refresh_from_db()
    # On-hand quantity increased by 2
    assert setup.inv_a1.quantity_on_hand == initial_on_hand_1 + 2

    # Inventory transaction ledger entry created
    new_txs = InventoryTransaction.objects.filter(inventory=setup.inv_a1)
    assert new_txs.count() == initial_tx_count + 1
    latest_tx = new_txs.latest("created_at")
    assert latest_tx.type == InventoryTransaction.Type.RETURN
    assert latest_tx.quantity_delta == 2
    assert latest_tx.reference_type == "RETURN"


def test_refund_financial_ledger_effects_and_commission_reversal(
    setup: FulfillmentSetup,
) -> None:
    order, so_a, _, _ = create_test_order(setup)
    so_a.status = SellerOrder.Status.DELIVERED
    so_a.save()

    # Initial balance after order settlement ($350 gross - $35 commission = $315)
    setup.seller_a.balance.refresh_from_db()
    initial_balance = setup.seller_a.balance.current_balance
    assert initial_balance == Decimal("315.00")

    # Issue partial refund of $100
    # Expected:
    # 1. Ratio = 100 / 350 = 2/7
    # 2. Commission reversed = (35 * 100 / 350) = $10.00
    # 3. Seller deduction = $100 - $10 = $90.00
    # 4. New seller balance = $315 - $90 = $225.00
    refund = services.process_refund(
        actor=setup.owner_a,
        seller_id=setup.seller_a.pk,
        seller_order_id=so_a.pk,
        amount=Decimal("100.00"),
        reason="Partial dissatisfaction",
    )

    assert refund.amount == Decimal("100.00")
    assert refund.commission_reversed == Decimal("10.00")
    assert refund.seller_deduction == Decimal("90.00")
    assert refund.status == Refund.Status.COMPLETED

    # Check seller balance
    setup.seller_a.balance.refresh_from_db()
    assert setup.seller_a.balance.current_balance == Decimal("225.00")

    # Check ledger entries (REFUND: -$100.00, COMMISSION: +$10.00)
    refund_ledger = SellerLedgerEntry.objects.filter(
        seller=setup.seller_a,
        entry_type=SellerLedgerEntry.EntryType.REFUND,
    ).latest("created_at")
    assert refund_ledger.amount == Decimal("-100.00")

    comm_reversal_ledger = SellerLedgerEntry.objects.filter(
        seller=setup.seller_a,
        entry_type=SellerLedgerEntry.EntryType.COMMISSION,
    ).latest("created_at")
    assert comm_reversal_ledger.amount == Decimal("10.00")

    # Check refund transaction record
    assert refund.transactions.count() == 1
    tx = refund.transactions.first()
    assert tx is not None
    assert tx.transaction_type == "PAYMENT_REVERSAL"


def test_refund_duplicate_and_excess_prevention(setup: FulfillmentSetup) -> None:
    order, so_a, _, _ = create_test_order(setup)

    # Order total is $350.00
    # 1. Attempting to refund $350.01 must fail
    with pytest.raises(ValidationError) as exc:
        services.process_refund(
            actor=setup.owner_a,
            seller_id=setup.seller_a.pk,
            seller_order_id=so_a.pk,
            amount=Decimal("350.01"),
            reason="Over refund",
        )
    assert "remaining refundable" in str(exc.value)

    # 2. Refund $200.00 succeeds
    services.process_refund(
        actor=setup.owner_a,
        seller_id=setup.seller_a.pk,
        seller_order_id=so_a.pk,
        amount=Decimal("200.00"),
        reason="Partial 1",
    )

    # 3. Attempting to refund another $200.00 (total $400 > $350) fails
    with pytest.raises(ValidationError) as exc:
        services.process_refund(
            actor=setup.owner_a,
            seller_id=setup.seller_a.pk,
            seller_order_id=so_a.pk,
            amount=Decimal("200.00"),
            reason="Partial 2",
        )
    assert "remaining refundable" in str(exc.value)

    # 4. Refunding exact remaining $150.00 succeeds and syncs Order payment_status to REFUNDED
    services.process_refund(
        actor=setup.owner_a,
        seller_id=setup.seller_a.pk,
        seller_order_id=so_a.pk,
        amount=Decimal("150.00"),
        reason="Remaining",
    )
    order.refresh_from_db()
    assert order.payment_status == Order.PaymentStatus.REFUNDED


def test_database_integrity_triggers_and_immutability(setup: FulfillmentSetup) -> None:
    order, so_a, oi_a1, _ = create_test_order(setup)
    so_a.status = SellerOrder.Status.DELIVERED
    so_a.save()

    ret = services.create_return_request(
        actor=setup.regular,
        seller_order_id=so_a.pk,
        reason="test",
        items_data=[{"order_item_id": oi_a1.pk, "quantity": 1}],
    )
    history = ret.status_history.first()
    assert history is not None

    # 1. ReturnStatusHistory is immutable in PostgreSQL
    with pytest.raises((IntegrityError, DatabaseError)), transaction.atomic():
        history.notes = "tampered"
        history.save()

    with pytest.raises((IntegrityError, DatabaseError)), transaction.atomic():
        history.delete()

    # 2. TrackingEvent is immutable in PostgreSQL
    shipment = services.create_shipment(
        actor=setup.owner_a,
        seller_id=setup.seller_a.pk,
        seller_order_id=so_a.pk,
        carrier="UPS",
        items_data=[{"order_item_id": oi_a1.pk, "quantity": 1}],
    )
    trk = shipment.tracking_events.first()
    assert trk is not None
    with pytest.raises((IntegrityError, DatabaseError)), transaction.atomic():
        trk.location = "tampered"
        trk.save()

    with pytest.raises((IntegrityError, DatabaseError)), transaction.atomic():
        trk.delete()

    # 3. Completed Refund immutability
    refund = services.process_refund(
        actor=setup.owner_a,
        seller_id=setup.seller_a.pk,
        seller_order_id=so_a.pk,
        amount=Decimal("50.00"),
        reason="test refund",
    )
    with pytest.raises((IntegrityError, DatabaseError)), transaction.atomic():
        refund.amount = Decimal("999.00")
        refund.save()


def test_seller_fulfillment_and_returns_api_endpoints(setup: FulfillmentSetup) -> None:
    order, so_a, oi_a1, _ = create_test_order(setup)
    so_a.status = SellerOrder.Status.DELIVERED
    so_a.save()

    # 1. Create shipment via HTTP API
    res = setup.browser_a.post(
        "/api/v1/seller/fulfillment/shipments",
        {
            "seller_order_id": str(so_a.pk),
            "carrier": "DHL",
            "tracking_number": "DHL-9999",
            "items": [{"order_item_id": str(oi_a1.pk), "quantity": 1}],
        },
        format="json",
    )
    assert res.status_code == 201
    shipment_id = res.data["id"]

    # List shipments
    list_res = setup.browser_a.get("/api/v1/seller/fulfillment/shipments")
    assert list_res.status_code == 200
    assert list_res.data["count"] == 1

    # Cross-tenant access: Seller B cannot view Seller A's shipment
    assert (
        setup.browser_b.get(f"/api/v1/seller/fulfillment/shipments/{shipment_id}").status_code
        == 404
    )

    # 2. Add tracking event via HTTP API
    evt_res = setup.browser_a.post(
        f"/api/v1/seller/fulfillment/shipments/{shipment_id}/events",
        {"status": "in_transit", "location": "Chicago", "description": "Package scanned"},
        format="json",
    )
    assert evt_res.status_code == 201

    # 3. Deliver shipment via HTTP API
    deliv_res = setup.browser_a.post(
        f"/api/v1/seller/fulfillment/shipments/{shipment_id}/deliver",
        {},
        format="json",
    )
    assert deliv_res.status_code == 200
    assert deliv_res.data["status"] == "delivered"

    # 4. Returns API: create, list, approve
    ret_res = setup.browser_a.post(
        "/api/v1/seller/fulfillment/returns",
        {
            "seller_order_id": str(so_a.pk),
            "reason": "customer_changed_mind",
            "items": [{"order_item_id": str(oi_a1.pk), "quantity": 1}],
        },
        format="json",
    )
    assert ret_res.status_code == 201
    ret_id = ret_res.data["id"]

    appr_res = setup.browser_a.post(
        f"/api/v1/seller/fulfillment/returns/{ret_id}/approve",
        {"return_carrier": "USPS", "return_tracking_number": "RET-001"},
        format="json",
    )
    assert appr_res.status_code == 200
    assert appr_res.data["status"] == "approved"

    # 5. Refunds API: create, list
    ref_res = setup.browser_a.post(
        "/api/v1/seller/fulfillment/refunds",
        {
            "seller_order_id": str(so_a.pk),
            "amount": "50.00",
            "reason": "Goodwill discount",
        },
        format="json",
    )
    assert ref_res.status_code == 201
    assert ref_res.data["amount"] == "50.00"


def test_platform_fulfillment_and_permission_gating(setup: FulfillmentSetup) -> None:
    order, so_a, oi_a1, _ = create_test_order(setup)

    shipment = services.create_shipment(
        actor=setup.owner_a,
        seller_id=setup.seller_a.pk,
        seller_order_id=so_a.pk,
        carrier="FedEx",
        items_data=[{"order_item_id": oi_a1.pk, "quantity": 1}],
    )

    # 1. Superuser without platform access is denied
    super_user = User.objects.create_user("super-raw@example.com", is_superuser=True, is_staff=True)
    super_client = client(super_user)
    assert super_client.get("/api/v1/admin/fulfillment/shipments").status_code == 403

    # 2. Platform admin with capability succeeds
    res = setup.platform.get("/api/v1/admin/fulfillment/shipments")
    assert res.status_code == 200
    assert res.data["count"] >= 1

    detail_res = setup.platform.get(f"/api/v1/admin/fulfillment/shipments/{shipment.pk}")
    assert detail_res.status_code == 200
    assert detail_res.data["id"] == str(shipment.pk)

    # 3. Platform issue refund
    ref_res = setup.platform.post(
        "/api/v1/admin/fulfillment/refunds",
        {
            "seller_order_id": str(so_a.pk),
            "amount": "30.00",
            "reason": "Platform administrative concession",
        },
        format="json",
    )
    assert ref_res.status_code == 201
    assert ref_res.data["amount"] == "30.00"
