import concurrent.futures
import uuid
from decimal import Decimal
from typing import Any

import pytest
from django import db
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.accounts.models import User
from apps.catalog.models import Category, Product, ProductVariant
from apps.finance.models import Payout, SellerBalance, SellerLedgerEntry
from apps.finance.services import approve_payout, ensure_seller_balance, process_payout
from apps.fulfillment.models import Refund, ReturnRequest
from apps.fulfillment.services import process_refund
from apps.inventory.models import Inventory, InventoryTransaction, Warehouse
from apps.inventory.services import adjust_inventory, reserve_inventory
from apps.orders.models import Order, OrderItem, OrderStatusHistory, SellerOrder
from apps.orders.services import confirm_seller_order
from apps.platform_access.models import PlatformAccess, PlatformRole
from apps.sellers.models import Seller, SellerMembership, SellerRole

pytestmark = pytest.mark.django_db(transaction=True, serialized_rollback=True)


def run_concurrent(
    target: Any, args_list: list[tuple[Any, ...]]
) -> tuple[list[Any], list[Exception]]:
    def wrapper(args: tuple[Any, ...]) -> Any:
        try:
            return target(*args)
        finally:
            db.connections.close_all()

    with concurrent.futures.ThreadPoolExecutor(max_workers=len(args_list)) as executor:
        futures = [executor.submit(wrapper, args) for args in args_list]
        results: list[Any] = []
        errors: list[Exception] = []
        for f in futures:
            try:
                results.append(f.result())
            except Exception as e:
                errors.append(e)
        return results, errors


@pytest.fixture
def base_setup() -> dict[str, Any]:
    owner = User.objects.create_user(email="race.owner@example.com", password="Password123!")
    admin = User.objects.create_user(email="race.admin@example.com", password="Password123!")
    customer = User.objects.create_user(email="race.customer@example.com", password="Password123!")

    super_role = PlatformRole.objects.get(name="SUPER_ADMIN")
    PlatformAccess.objects.create(user=admin, role=super_role, is_active=True)

    seller = Seller.objects.create(
        legal_name="Race Condition Corp",
        display_name="Race Store",
        slug="race-store",
        email="race@example.com",
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

    category = Category.objects.create(name="Tech", slug="tech")
    product = Product.objects.create(
        seller=seller,
        category=category,
        name="Concurrent Gadget",
        slug="concurrent-gadget",
        created_by=owner,
    )
    variant = ProductVariant.objects.create(
        seller=seller,
        product=product,
        sku="SKU-RACE-001",
        price=Decimal("100.00"),
    )
    warehouse = Warehouse.objects.create(
        seller=seller,
        name="Race Warehouse",
        code="WH-RACE",
    )

    return {
        "owner": owner,
        "admin": admin,
        "customer": customer,
        "seller": seller,
        "variant": variant,
        "warehouse": warehouse,
    }


# 1. Race condition on inventory reservation
def test_concurrent_inventory_reservation(base_setup: dict[str, Any]) -> None:
    seller = base_setup["seller"]
    owner = base_setup["owner"]
    warehouse = base_setup["warehouse"]
    variant = base_setup["variant"]

    inv = Inventory.objects.create(
        warehouse=warehouse,
        variant=variant,
        quantity_on_hand=5,
        quantity_reserved=0,
    )

    # Two concurrent requests both requesting 4 units (total 8 > 5 available)
    args_list = [
        (seller.pk, owner, inv.pk, 4, "Thread 1 Reservation"),
        (seller.pk, owner, inv.pk, 4, "Thread 2 Reservation"),
    ]

    results, errors = run_concurrent(reserve_inventory, args_list)

    # Exactly one must succeed and one must fail
    assert len(results) == 1
    assert len(errors) == 1
    assert isinstance(errors[0], ValidationError)
    assert "only" in str(errors[0]) or "available" in str(errors[0])

    inv.refresh_from_db()
    assert inv.quantity_reserved == 4
    assert inv.quantity_on_hand == 5
    assert inv.available_quantity == 1


# 2. Concurrent inventory adjustments
def test_concurrent_inventory_adjustments(base_setup: dict[str, Any]) -> None:
    seller = base_setup["seller"]
    owner = base_setup["owner"]
    warehouse = base_setup["warehouse"]
    variant = base_setup["variant"]

    inv = Inventory.objects.create(
        warehouse=warehouse,
        variant=variant,
        quantity_on_hand=50,
        quantity_reserved=0,
    )

    # 10 concurrent threads each adjusting by +10
    args_list = [(seller.pk, owner, inv.pk, 10, f"Thread {i} Increment") for i in range(10)]

    results, errors = run_concurrent(adjust_inventory, args_list)

    assert len(errors) == 0
    assert len(results) == 10

    inv.refresh_from_db()
    # 50 + 10 * 10 = 150
    assert inv.quantity_on_hand == 150
    assert InventoryTransaction.objects.filter(inventory=inv).count() == 10


# 3. Concurrent order confirmation
def test_concurrent_order_confirmation(base_setup: dict[str, Any]) -> None:
    seller = base_setup["seller"]
    owner = base_setup["owner"]
    customer = base_setup["customer"]

    order = Order.objects.create(
        order_number=f"ORD-RACE-{uuid.uuid4().hex[:6].upper()}",
        customer=customer,
        currency="USD",
        subtotal=Decimal("100.00"),
        grand_total=Decimal("100.00"),
    )
    so = SellerOrder.objects.create(
        order=order,
        seller=seller,
        seller_order_number=f"SO-RACE-{uuid.uuid4().hex[:6].upper()}",
        status=SellerOrder.Status.PENDING,
        subtotal=Decimal("100.00"),
        commission_total=Decimal("10.00"),
        seller_net_total=Decimal("90.00"),
    )

    args_list = [
        (seller.pk, owner, so.pk),
        (seller.pk, owner, so.pk),
    ]

    results, errors = run_concurrent(
        lambda s_id, act, so_id: confirm_seller_order(
            seller_id=s_id, actor=act, seller_order_id=so_id
        ),
        args_list,
    )

    # Exactly one confirmation succeeds, the duplicate raises ValidationError
    assert len(results) == 1
    assert len(errors) == 1
    assert isinstance(errors[0], ValidationError)

    so.refresh_from_db()
    assert so.status == SellerOrder.Status.CONFIRMED
    assert (
        OrderStatusHistory.objects.filter(
            seller_order=so, to_status=SellerOrder.Status.CONFIRMED
        ).count()
        == 1
    )


# 4. Concurrent payout approval
def test_concurrent_payout_approval(base_setup: dict[str, Any]) -> None:
    seller = base_setup["seller"]
    admin = base_setup["admin"]

    ensure_seller_balance(seller.pk)
    balance = SellerBalance.objects.get(seller=seller)
    balance.current_balance = Decimal("2000.00")
    balance.save(update_fields=["current_balance"])

    payout = Payout.objects.create(
        payout_number=f"PO-RACE-{uuid.uuid4().hex[:6].upper()}",
        seller=seller,
        amount=Decimal("500.00"),
        currency="USD",
        status=Payout.Status.PENDING,
    )

    args_list = [
        (admin, payout.pk),
        (admin, payout.pk),
    ]

    results, errors = run_concurrent(approve_payout, args_list)

    assert len(results) == 1
    assert len(errors) == 1
    assert isinstance(errors[0], ValidationError)

    payout.refresh_from_db()
    assert payout.status == Payout.Status.APPROVED


# 5. Concurrent payout processing
def test_concurrent_payout_processing(base_setup: dict[str, Any]) -> None:
    seller = base_setup["seller"]
    admin = base_setup["admin"]

    ensure_seller_balance(seller.pk)
    balance = SellerBalance.objects.get(seller=seller)
    balance.current_balance = Decimal("2000.00")
    balance.save(update_fields=["current_balance"])

    payout = Payout.objects.create(
        payout_number=f"PO-RACE-PROC-{uuid.uuid4().hex[:6].upper()}",
        seller=seller,
        amount=Decimal("500.00"),
        currency="USD",
        status=Payout.Status.APPROVED,
    )

    args_list = [
        (admin, payout.pk, "REF-T1"),
        (admin, payout.pk, "REF-T2"),
    ]

    results, errors = run_concurrent(process_payout, args_list)

    assert len(results) == 1
    assert len(errors) == 1
    assert isinstance(errors[0], ValidationError)

    payout.refresh_from_db()
    assert payout.status == Payout.Status.PROCESSED

    balance.refresh_from_db()
    # $2000 - $500 = $1500 (deducted exactly once)
    assert balance.current_balance == Decimal("1500.00")
    assert SellerLedgerEntry.objects.filter(payout=payout).count() == 1


# 6. Concurrent customer refund processing
def test_concurrent_refund_processing(base_setup: dict[str, Any]) -> None:
    seller = base_setup["seller"]
    owner = base_setup["owner"]
    customer = base_setup["customer"]
    product = base_setup["variant"].product
    variant = base_setup["variant"]
    warehouse = base_setup["warehouse"]

    ensure_seller_balance(seller.pk)
    balance = SellerBalance.objects.get(seller=seller)
    balance.current_balance = Decimal("1000.00")
    balance.save(update_fields=["current_balance"])

    order = Order.objects.create(
        order_number=f"ORD-RET-{uuid.uuid4().hex[:6].upper()}",
        customer=customer,
        currency="USD",
        subtotal=Decimal("100.00"),
        grand_total=Decimal("100.00"),
        payment_status=Order.PaymentStatus.PAID,
    )
    so = SellerOrder.objects.create(
        order=order,
        seller=seller,
        seller_order_number=f"SO-RET-{uuid.uuid4().hex[:6].upper()}",
        status=SellerOrder.Status.DELIVERED,
        subtotal=Decimal("100.00"),
        commission_total=Decimal("10.00"),
        seller_net_total=Decimal("90.00"),
    )
    oi = OrderItem.objects.create(
        seller_order=so,
        product=product,
        variant=variant,
        warehouse=warehouse,
        product_name_snapshot="Concurrent Gadget",
        sku_snapshot="SKU-RACE-001",
        quantity=1,
        unit_price=Decimal("100.00"),
        total=Decimal("100.00"),
        commission_amount=Decimal("10.00"),
        seller_net_amount=Decimal("90.00"),
    )
    ret = ReturnRequest.objects.create(
        return_number=f"RET-{uuid.uuid4().hex[:6].upper()}",
        seller=seller,
        seller_order=so,
        customer=customer,
        status=ReturnRequest.Status.RECEIVED,  # Received and ready for refund
        reason="Defective item",
    )
    ret.items.create(
        order_item=oi,
        quantity=1,
        reason="Defective",
        restock_inventory=False,
    )

    args_list = [
        (owner, seller.pk, so.pk, Decimal("100.00"), "Defective", ret.pk),
        (owner, seller.pk, so.pk, Decimal("100.00"), "Defective", ret.pk),
    ]

    results, errors = run_concurrent(
        lambda act, s_id, so_id, amt, rsn, ret_id: process_refund(
            actor=act,
            seller_id=s_id,
            seller_order_id=so_id,
            amount=amt,
            reason=rsn,
            return_request_id=ret_id,
        ),
        args_list,
    )

    assert len(results) == 1
    assert len(errors) == 1
    assert isinstance(errors[0], ValidationError)

    # Exactly 1 completed refund was created
    assert Refund.objects.filter(seller_order=so).count() == 1
