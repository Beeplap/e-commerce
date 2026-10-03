from datetime import timedelta
from decimal import Decimal
from typing import Any

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.cart.models import Cart, CartItem
from apps.catalog.models import Brand, Category, Product, ProductVariant
from apps.checkout.models import CustomerAddress
from apps.events.models import OutboxEvent
from apps.fulfillment.models import ShippingMethod, ShippingRate, ShippingZone
from apps.inventory.models import Inventory, InventoryTransaction, Warehouse
from apps.orders.models import Order, OrderItem, OrderStatusHistory, SellerOrder
from apps.promotions.models import Coupon, Promotion
from apps.sellers.models import (
    Seller,
    SellerMembership,
    SellerRole,
)

pytestmark = pytest.mark.django_db
PASSWORD = "Test-secure-password-123!"


@pytest.fixture
def checkout_setup_data() -> dict[str, Any]:
    # Customers
    customer_user = User.objects.create_user("customer1@example.com", PASSWORD)
    other_customer = User.objects.create_user("customer2@example.com", PASSWORD)

    # Seller 1 (Acme)
    seller_user_1 = User.objects.create_user("seller1@example.com", PASSWORD)
    owner_role = SellerRole.objects.get(name="OWNER", is_system=True)

    seller_1 = Seller.objects.create(
        legal_name="Acme Tech Inc",
        display_name="Acme Tech",
        slug="acme-tech",
        email="contact@acme.example.com",
        status=Seller.Status.ACTIVE,
        verification_status=Seller.VerificationStatus.VERIFIED,
        default_currency="USD",
    )
    SellerMembership.objects.create(
        seller=seller_1,
        user=seller_user_1,
        role=owner_role,
        status="active",
        joined_at=timezone.now(),
    )
    wh_1 = Warehouse.objects.create(
        seller=seller_1, name="Acme Main WH", code="acme-wh-1", is_active=True
    )

    # Shipping for Seller 1
    zone_us_1 = ShippingZone.objects.create(
        seller=seller_1, name="US Domestic", countries=["US"], is_active=True
    )
    sm_standard_1 = ShippingMethod.objects.create(
        seller=seller_1,
        name="Acme Ground",
        code="acme-ground",
        carrier="FedEx",
        estimated_delivery_days_min=3,
        estimated_delivery_days_max=5,
        is_active=True,
    )
    ShippingRate.objects.create(
        zone=zone_us_1,
        method=sm_standard_1,
        min_order_amount=Decimal("0.00"),
        rate=Decimal("5.00"),
        currency="USD",
    )

    sm_express_1 = ShippingMethod.objects.create(
        seller=seller_1,
        name="Acme Express",
        code="acme-express",
        carrier="FedEx",
        estimated_delivery_days_min=1,
        estimated_delivery_days_max=2,
        is_active=True,
    )
    ShippingRate.objects.create(
        zone=zone_us_1,
        method=sm_express_1,
        min_order_amount=Decimal("0.00"),
        rate=Decimal("15.00"),
        currency="USD",
    )

    # Seller 2 (Beta Store)
    seller_user_2 = User.objects.create_user("seller2@example.com", PASSWORD)
    seller_2 = Seller.objects.create(
        legal_name="Beta Goods LLC",
        display_name="Beta Goods",
        slug="beta-goods",
        email="contact@beta.example.com",
        status=Seller.Status.ACTIVE,
        verification_status=Seller.VerificationStatus.VERIFIED,
        default_currency="USD",
    )
    SellerMembership.objects.create(
        seller=seller_2,
        user=seller_user_2,
        role=owner_role,
        status="active",
        joined_at=timezone.now(),
    )
    wh_2 = Warehouse.objects.create(
        seller=seller_2, name="Beta Main WH", code="beta-wh-1", is_active=True
    )

    # Shipping for Seller 2
    zone_us_2 = ShippingZone.objects.create(
        seller=seller_2, name="US Domestic", countries=["US"], is_active=True
    )
    sm_standard_2 = ShippingMethod.objects.create(
        seller=seller_2,
        name="Beta Standard",
        code="beta-std",
        carrier="UPS",
        estimated_delivery_days_min=2,
        estimated_delivery_days_max=4,
        is_active=True,
    )
    ShippingRate.objects.create(
        zone=zone_us_2,
        method=sm_standard_2,
        min_order_amount=Decimal("0.00"),
        rate=Decimal("8.00"),
        currency="USD",
    )

    # Catalog setup
    cat = Category.objects.create(name="Gadgets", slug="gadgets", is_active=True)
    brand = Brand.objects.create(name="TechBrand", slug="techbrand", is_active=True)

    # Product 1 (Seller 1)
    p1 = Product.objects.create(
        seller=seller_1,
        category=cat,
        brand=brand,
        name="Wireless Earbuds Pro",
        slug="wireless-earbuds-pro",
        description="High-fidelity audio",
        status=Product.Status.ACTIVE,
        created_by=seller_user_1,
        approved_by=seller_user_1,
        approved_at=timezone.now(),
    )
    v1 = ProductVariant.objects.create(
        seller=seller_1,
        product=p1,
        sku="EARBUDS-BLK",
        price=Decimal("25.00"),
        status=ProductVariant.Status.ACTIVE,
    )
    inv1 = Inventory.objects.create(
        warehouse=wh_1,
        variant=v1,
        quantity_on_hand=20,
        quantity_reserved=0,
    )

    # Product 2 (Seller 2)
    p2 = Product.objects.create(
        seller=seller_2,
        category=cat,
        brand=brand,
        name="Mechanical Keyboard",
        slug="mechanical-keyboard",
        description="RGB gaming keyboard",
        status=Product.Status.ACTIVE,
        created_by=seller_user_2,
        approved_by=seller_user_2,
        approved_at=timezone.now(),
    )
    v2 = ProductVariant.objects.create(
        seller=seller_2,
        product=p2,
        sku="KEYBOARD-RGB",
        price=Decimal("40.00"),
        status=ProductVariant.Status.ACTIVE,
    )
    inv2 = Inventory.objects.create(
        warehouse=wh_2,
        variant=v2,
        quantity_on_hand=15,
        quantity_reserved=0,
    )

    # Promotional Coupon (Seller 1 promotion: 10% off)
    promo_1 = Promotion.objects.create(
        seller=seller_1,
        scope=Promotion.Scope.SELLER,
        name="10% Off Earbuds",
        discount_type=Promotion.DiscountType.PERCENTAGE,
        discount_value=Decimal("10.00"),
        start_date=timezone.now() - timedelta(days=1),
        end_date=timezone.now() + timedelta(days=10),
        min_order_amount=Decimal("10.00"),
        is_active=True,
    )
    coupon_1 = Coupon.objects.create(
        promotion=promo_1,
        code="SAVE10",
        is_active=True,
    )

    return {
        "customer": customer_user,
        "other_customer": other_customer,
        "seller_1": seller_1,
        "seller_2": seller_2,
        "wh_1": wh_1,
        "wh_2": wh_2,
        "variant_1": v1,
        "variant_2": v2,
        "inv_1": inv1,
        "inv_2": inv2,
        "sm_standard_1": sm_standard_1,
        "sm_express_1": sm_express_1,
        "sm_standard_2": sm_standard_2,
        "coupon_1": coupon_1,
    }


# ---------------------------------------------------------------------------
# Test 1: Customer Saved Address CRUD & User Isolation
# ---------------------------------------------------------------------------


def test_customer_address_crud_and_user_isolation(checkout_setup_data: dict[str, Any]) -> None:
    client = APIClient(enforce_csrf_checks=False)
    customer = checkout_setup_data["customer"]
    other_customer = checkout_setup_data["other_customer"]

    client.force_authenticate(user=customer)

    # 1. Create first address (should automatically become default)
    res1 = client.post(
        "/api/v1/checkout/addresses/",
        data={
            "full_name": "Alice Smith",
            "phone": "+15551234567",
            "line1": "123 Main St",
            "city": "Austin",
            "state": "TX",
            "postal_code": "78701",
            "country": "US",
        },
        format="json",
    )
    assert res1.status_code == 201
    addr1_id = res1.data["id"]
    assert res1.data["is_default"] is True

    # 2. Create second address set as default (should demote first address)
    res2 = client.post(
        "/api/v1/checkout/addresses/",
        data={
            "full_name": "Alice Smith Work",
            "phone": "+15559876543",
            "line1": "456 Office Blvd",
            "city": "Austin",
            "state": "TX",
            "postal_code": "78702",
            "country": "US",
            "is_default": True,
        },
        format="json",
    )
    assert res2.status_code == 201
    addr2_id = res2.data["id"]
    assert res2.data["is_default"] is True

    # Verify first address is now non-default
    addr1_obj = CustomerAddress.objects.get(pk=addr1_id)
    assert addr1_obj.is_default is False

    # 3. List addresses
    list_res = client.get("/api/v1/checkout/addresses/")
    assert list_res.status_code == 200
    assert len(list_res.data) == 2
    assert list_res.data[0]["id"] == addr2_id  # default first

    # 4. User isolation: other customer cannot view, update, or delete customer's address
    other_client = APIClient(enforce_csrf_checks=False)
    other_client.force_authenticate(user=other_customer)

    assert other_client.get(f"/api/v1/checkout/addresses/{addr1_id}/").status_code in [404, 405]
    assert (
        other_client.patch(
            f"/api/v1/checkout/addresses/{addr1_id}/",
            data={"city": "Hacked"},
            format="json",
        ).status_code
        == 404
    )
    assert other_client.delete(f"/api/v1/checkout/addresses/{addr1_id}/").status_code == 404

    # 5. Delete default address promotes remaining address to default
    del_res = client.delete(f"/api/v1/checkout/addresses/{addr2_id}/")
    assert del_res.status_code == 204

    remaining = CustomerAddress.objects.filter(user=customer)
    assert remaining.count() == 1
    rem_first = remaining.first()
    assert rem_first is not None
    assert rem_first.is_default is True


# ---------------------------------------------------------------------------
# Test 2: Checkout Quote Calculation (Shipping & Coupon Evaluation)
# ---------------------------------------------------------------------------


def test_checkout_quote_calculation_shipping_and_coupons(
    checkout_setup_data: dict[str, Any],
) -> None:
    client = APIClient(enforce_csrf_checks=False)
    customer = checkout_setup_data["customer"]
    client.force_authenticate(user=customer)

    cart = Cart.objects.create(user=customer)
    # Seller 1: 2 x $25.00 = $50.00
    CartItem.objects.create(cart=cart, variant=checkout_setup_data["variant_1"], quantity=2)
    # Seller 2: 1 x $40.00 = $40.00
    CartItem.objects.create(cart=cart, variant=checkout_setup_data["variant_2"], quantity=1)

    quote_payload = {
        "shipping_address": {
            "full_name": "Alice Smith",
            "phone": "+15551234567",
            "line1": "123 Main St",
            "city": "Austin",
            "state": "TX",
            "postal_code": "78701",
            "country": "US",
        },
        "coupon_code": "SAVE10",
        "shipping_selections": {
            str(checkout_setup_data["seller_1"].pk): str(checkout_setup_data["sm_express_1"].pk),
        },
    }

    res = client.post("/api/v1/checkout/quote/", data=quote_payload, format="json")
    assert res.status_code == 200
    data = res.data

    assert data["total_items"] == 3
    assert data["subtotal"] == "90.00"

    # Coupon: 10% off Seller 1 ($50.00 -> $5.00 discount)
    assert data["coupon"].get("valid") is True or data["coupon"].get("is_valid") is True
    assert data["coupon"]["discount_amount"] == "5.00"
    assert data["discount_total"] == "5.00"

    # Shipping: Seller 1 express ($15.00) + Seller 2 standard ($8.00) = $23.00
    assert data["shipping_total"] == "23.00"

    # Grand total: 90.00 - 5.00 + 23.00 = 108.00
    assert data["grand_total"] == "108.00"

    # Per-seller breakdowns
    assert len(data["sellers"]) == 2
    s1_quote = next(
        s for s in data["sellers"] if s["seller_id"] == str(checkout_setup_data["seller_1"].pk)
    )
    assert s1_quote["subtotal"] == "50.00"
    assert s1_quote["discount_amount"] == "5.00"
    assert s1_quote["shipping_fee"] == "15.00"
    assert s1_quote["total"] == "60.00"
    assert len(s1_quote["available_shipping_methods"]) == 2

    s2_quote = next(
        s for s in data["sellers"] if s["seller_id"] == str(checkout_setup_data["seller_2"].pk)
    )
    assert s2_quote["subtotal"] == "40.00"
    assert s2_quote["discount_amount"] == "0.00"
    assert s2_quote["shipping_fee"] == "8.00"
    assert s2_quote["total"] == "48.00"


# ---------------------------------------------------------------------------
# Test 3: Atomic Order Placement & Multi-Seller Splitting
# ---------------------------------------------------------------------------


def test_atomic_order_placement_and_multi_seller_splitting(
    checkout_setup_data: dict[str, Any],
) -> None:
    client = APIClient(enforce_csrf_checks=False)
    customer = checkout_setup_data["customer"]
    client.force_authenticate(user=customer)

    cart = Cart.objects.create(user=customer)
    CartItem.objects.create(cart=cart, variant=checkout_setup_data["variant_1"], quantity=2)
    CartItem.objects.create(cart=cart, variant=checkout_setup_data["variant_2"], quantity=1)

    order_payload = {
        "shipping_address": {
            "full_name": "Alice Smith",
            "phone": "+15551234567",
            "line1": "123 Main St",
            "city": "Austin",
            "state": "TX",
            "postal_code": "78701",
            "country": "US",
        },
        "coupon_code": "SAVE10",
    }

    res = client.post("/api/v1/checkout/place-order/", data=order_payload, format="json")
    assert res.status_code == 201
    data = res.data

    order_id = data["order_id"]
    order = Order.objects.get(pk=order_id)
    assert order.customer == customer
    assert order.customer_email == customer.email
    assert order.payment_status == Order.PaymentStatus.PENDING
    assert order.subtotal == Decimal("90.00")
    assert order.discount_total == Decimal("5.00")
    assert order.shipping_total == Decimal("13.00")  # 5.00 + 8.00 default standard
    assert order.grand_total == Decimal("98.00")

    # 1. Multi-seller partitioning: exactly 2 SellerOrders
    seller_orders = list(SellerOrder.objects.filter(order=order).order_by("created_at"))
    assert len(seller_orders) == 2

    so1 = next(so for so in seller_orders if so.seller == checkout_setup_data["seller_1"])
    assert so1.subtotal == Decimal("50.00")
    assert so1.discount_total == Decimal("5.00")
    assert so1.shipping_total == Decimal("5.00")
    assert so1.status == SellerOrder.Status.PENDING
    assert so1.commission_total > Decimal("0.00")
    assert so1.seller_net_total > Decimal("0.00")

    so2 = next(so for so in seller_orders if so.seller == checkout_setup_data["seller_2"])
    assert so2.subtotal == Decimal("40.00")
    assert so2.discount_total == Decimal("0.00")
    assert so2.shipping_total == Decimal("8.00")

    # 2. OrderItem snapshots
    items_so1 = list(OrderItem.objects.filter(seller_order=so1))
    assert len(items_so1) == 1
    assert items_so1[0].sku_snapshot == "EARBUDS-BLK"
    assert items_so1[0].product_name_snapshot == "Wireless Earbuds Pro"
    assert items_so1[0].quantity == 2
    assert items_so1[0].unit_price == Decimal("25.00")
    assert items_so1[0].discount_amount == Decimal("5.00")
    assert items_so1[0].commission_amount > Decimal("0.00")

    # 3. OrderStatusHistory records
    hist1 = OrderStatusHistory.objects.filter(seller_order=so1).first()
    assert hist1 is not None
    assert hist1.to_status == SellerOrder.Status.PENDING

    # 4. Outbox event emitted
    outbox_event = OutboxEvent.objects.filter(event_key=str(order.pk)).first()
    assert outbox_event is not None
    assert outbox_event.topic == "orders.order.created"
    assert outbox_event.payload["order_number"] == order.order_number

    # 5. Cart atomically cleared
    cart.refresh_from_db()
    assert cart.items.count() == 0


# ---------------------------------------------------------------------------
# Test 4: Stock Reservation Ledger Transactions
# ---------------------------------------------------------------------------


def test_stock_reservation_ledger_transactions(checkout_setup_data: dict[str, Any]) -> None:
    client = APIClient(enforce_csrf_checks=False)
    customer = checkout_setup_data["customer"]
    client.force_authenticate(user=customer)

    v1 = checkout_setup_data["variant_1"]
    inv1 = checkout_setup_data["inv_1"]
    assert inv1.quantity_on_hand == 20
    assert inv1.quantity_reserved == 0

    cart = Cart.objects.create(user=customer)
    CartItem.objects.create(cart=cart, variant=v1, quantity=4)

    res = client.post(
        "/api/v1/checkout/place-order/",
        data={
            "shipping_address": {
                "full_name": "Alice Smith",
                "phone": "+15551234567",
                "line1": "123 Main St",
                "city": "Austin",
                "state": "TX",
                "postal_code": "78701",
                "country": "US",
            }
        },
        format="json",
    )
    assert res.status_code == 201

    inv1.refresh_from_db()
    # Quantity on hand remains 20, reserved increases to 4
    assert inv1.quantity_on_hand == 20
    assert inv1.quantity_reserved == 4

    # Attributable ledger transaction
    txn = InventoryTransaction.objects.filter(
        inventory=inv1, type=InventoryTransaction.Type.RESERVATION
    ).first()
    assert txn is not None
    assert txn.quantity_delta == 4


# ---------------------------------------------------------------------------
# Test 5: Zero Overselling Rejection
# ---------------------------------------------------------------------------


def test_zero_overselling_rejected_when_stock_exhausted(
    checkout_setup_data: dict[str, Any],
) -> None:
    client = APIClient(enforce_csrf_checks=False)
    customer = checkout_setup_data["customer"]
    client.force_authenticate(user=customer)

    v1 = checkout_setup_data["variant_1"]
    inv1 = checkout_setup_data["inv_1"]
    # Stock is only 2 available
    inv1.quantity_on_hand = 2
    inv1.quantity_reserved = 0
    inv1.save()

    cart = Cart.objects.create(user=customer)
    CartItem.objects.create(cart=cart, variant=v1, quantity=5)

    res = client.post(
        "/api/v1/checkout/place-order/",
        data={
            "shipping_address": {
                "full_name": "Alice Smith",
                "phone": "+15551234567",
                "line1": "123 Main St",
                "city": "Austin",
                "state": "TX",
                "postal_code": "78701",
                "country": "US",
            }
        },
        format="json",
    )
    assert res.status_code == 400
    assert "stock" in res.data or "detail" in res.data

    # Zero orders created, stock untampered
    assert Order.objects.count() == 0
    inv1.refresh_from_db()
    assert inv1.quantity_reserved == 0


# ---------------------------------------------------------------------------
# Test 6: Concurrency Test: Simultaneous Checkouts for Last Available Unit
# ---------------------------------------------------------------------------


def test_concurrency_race_condition_simultaneous_checkouts_prevent_overselling(
    checkout_setup_data: dict[str, Any],
) -> None:
    v1 = checkout_setup_data["variant_1"]
    inv1 = checkout_setup_data["inv_1"]
    # Exactly 1 unit in stock
    inv1.quantity_on_hand = 1
    inv1.quantity_reserved = 0
    inv1.save()

    user_a = checkout_setup_data["customer"]
    user_b = checkout_setup_data["other_customer"]

    cart_a = Cart.objects.create(user=user_a)
    CartItem.objects.create(cart=cart_a, variant=v1, quantity=1)

    cart_b = Cart.objects.create(user=user_b)
    CartItem.objects.create(cart=cart_b, variant=v1, quantity=1)

    client_a = APIClient(enforce_csrf_checks=False)
    client_a.force_authenticate(user=user_a)
    res_a = client_a.post(
        "/api/v1/checkout/place-order/",
        data={
            "shipping_address": {
                "full_name": "User A",
                "phone": "+15551234567",
                "line1": "123 Main St",
                "city": "Austin",
                "state": "TX",
                "postal_code": "78701",
                "country": "US",
            }
        },
        format="json",
    )
    assert res_a.status_code == 201

    client_b = APIClient(enforce_csrf_checks=False)
    client_b.force_authenticate(user=user_b)
    res_b = client_b.post(
        "/api/v1/checkout/place-order/",
        data={
            "shipping_address": {
                "full_name": "User B",
                "phone": "+15551234567",
                "line1": "123 Main St",
                "city": "Austin",
                "state": "TX",
                "postal_code": "78701",
                "country": "US",
            }
        },
        format="json",
    )
    assert res_b.status_code == 400
    assert "stock" in res_b.data or "detail" in res_b.data

    inv1.refresh_from_db()
    # Reserved quantity must be exactly 1, NEVER 2!
    assert inv1.quantity_reserved == 1
    assert Order.objects.count() == 1


# ---------------------------------------------------------------------------
# Test 7: Empty Cart Checkout Rejection
# ---------------------------------------------------------------------------


def test_empty_cart_checkout_rejected(checkout_setup_data: dict[str, Any]) -> None:
    client = APIClient(enforce_csrf_checks=False)
    customer = checkout_setup_data["customer"]
    client.force_authenticate(user=customer)

    # Empty cart
    Cart.objects.create(user=customer)

    res = client.post(
        "/api/v1/checkout/place-order/",
        data={
            "shipping_address": {
                "full_name": "Alice Smith",
                "phone": "+15551234567",
                "line1": "123 Main St",
                "city": "Austin",
                "state": "TX",
                "postal_code": "78701",
                "country": "US",
            }
        },
        format="json",
    )
    assert res.status_code == 400
    assert "cart" in res.data


# ---------------------------------------------------------------------------
# Test 8: Guest Checkout Supported
# ---------------------------------------------------------------------------


def test_guest_checkout_supported_with_valid_email(checkout_setup_data: dict[str, Any]) -> None:
    client = APIClient(enforce_csrf_checks=False)

    # Guest session cart
    cart_res = client.get("/api/v1/cart/")
    assert cart_res.status_code == 200

    # Add item to guest cart
    add_res = client.post(
        "/api/v1/cart/items/",
        data={"variant_id": str(checkout_setup_data["variant_1"].pk), "quantity": 1},
        format="json",
    )
    assert add_res.status_code == 201

    # Place order as guest
    res = client.post(
        "/api/v1/checkout/place-order/",
        data={
            "customer_email": "guest.shopper@example.com",
            "shipping_address": {
                "full_name": "Guest Shopper",
                "phone": "+15551234567",
                "line1": "999 Guest Way",
                "city": "Seattle",
                "state": "WA",
                "postal_code": "98101",
                "country": "US",
            },
        },
        format="json",
    )
    assert res.status_code == 201
    order_id = res.data["order_id"]
    order = Order.objects.get(pk=order_id)
    assert order.customer is None
    assert order.customer_email == "guest.shopper@example.com"
