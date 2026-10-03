from decimal import Decimal
from typing import Any

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.cart.models import Cart, CartItem
from apps.catalog.models import Brand, Category, Product, ProductVariant
from apps.inventory.models import Inventory, Warehouse
from apps.sellers.models import (
    Seller,
    SellerAddress,
    SellerMembership,
    SellerProfile,
    SellerRole,
    SellerSettings,
)

pytestmark = pytest.mark.django_db
PASSWORD = "Test-secure-password-123!"


@pytest.fixture
def cart_setup_data() -> dict[str, Any]:
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
    SellerProfile.objects.create(seller=seller_1, description="Acme store")
    SellerSettings.objects.create(seller=seller_1, support_email="support@acme.example.com")
    SellerAddress.objects.create(
        seller=seller_1,
        kind=SellerAddress.Kind.REGISTERED,
        line1="100 Market St",
        city="San Francisco",
        region="CA",
        postal_code="94105",
        country="US",
    )
    wh_1 = Warehouse.objects.create(
        seller=seller_1, name="Acme Main WH", code="acme-wh-1", is_active=True
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
        price=Decimal("29.99"),
        compare_at_price=Decimal("39.99"),
        status=ProductVariant.Status.ACTIVE,
    )
    # Available stock = 10 - 2 = 8
    inv_1 = Inventory.objects.create(
        warehouse=wh_1, variant=v1, quantity_on_hand=10, quantity_reserved=2
    )

    v2 = ProductVariant.objects.create(
        seller=seller_1,
        product=p1,
        sku="EARBUDS-WHT",
        price=Decimal("34.99"),
        status=ProductVariant.Status.ACTIVE,
    )
    # Available stock = 5 - 0 = 5
    inv_2 = Inventory.objects.create(
        warehouse=wh_1, variant=v2, quantity_on_hand=5, quantity_reserved=0
    )

    # Product 2 (Seller 2)
    p2 = Product.objects.create(
        seller=seller_2,
        category=cat,
        brand=brand,
        name="Smart Fitness Band",
        slug="smart-fitness-band",
        description="Track your daily activity",
        status=Product.Status.ACTIVE,
        created_by=seller_user_2,
        approved_by=seller_user_2,
        approved_at=timezone.now(),
    )
    v3 = ProductVariant.objects.create(
        seller=seller_2,
        product=p2,
        sku="FITBAND-BLU",
        price=Decimal("15.00"),
        status=ProductVariant.Status.ACTIVE,
    )
    # Available stock = 20 - 0 = 20
    inv_3 = Inventory.objects.create(
        warehouse=wh_2, variant=v3, quantity_on_hand=20, quantity_reserved=0
    )

    # Customers
    cust_1 = User.objects.create_user("customer1@example.com", PASSWORD)
    cust_2 = User.objects.create_user("customer2@example.com", PASSWORD)

    return {
        "seller_1": seller_1,
        "seller_2": seller_2,
        "v1": v1,
        "v2": v2,
        "v3": v3,
        "inv_1": inv_1,
        "inv_2": inv_2,
        "inv_3": inv_3,
        "cust_1": cust_1,
        "cust_2": cust_2,
    }


@pytest.fixture
def browser() -> APIClient:
    client = APIClient(enforce_csrf_checks=True)
    resp = client.get("/api/v1/auth/csrf")
    assert resp.status_code == 200
    return client


def post_json(browser: APIClient, path: str, data: dict[str, Any] | None = None) -> Any:
    return browser.post(
        path, data or {}, format="json", HTTP_X_CSRFTOKEN=browser.cookies["csrftoken"].value
    )


def patch_json(browser: APIClient, path: str, data: dict[str, Any]) -> Any:
    return browser.patch(
        path, data, format="json", HTTP_X_CSRFTOKEN=browser.cookies["csrftoken"].value
    )


def delete_json(browser: APIClient, path: str) -> Any:
    return browser.delete(path, HTTP_X_CSRFTOKEN=browser.cookies["csrftoken"].value)


def test_guest_cart_add_and_fetch(cart_setup_data: dict[str, Any], browser: APIClient) -> None:
    v1 = cart_setup_data["v1"]

    # Initially empty
    resp = browser.get("/api/v1/cart/")
    assert resp.status_code == 200
    assert resp.data["total_items"] == 0
    assert resp.data["subtotal"] == "0.00"
    assert len(resp.data["sellers"]) == 0

    # Add 2 items of v1 ($29.99 each)
    post_resp = post_json(
        browser,
        "/api/v1/cart/items/",
        {"variant_id": str(v1.id), "quantity": 2},
    )
    assert post_resp.status_code == 201
    assert post_resp.data["total_items"] == 2
    assert post_resp.data["total_unique_items"] == 1
    assert post_resp.data["subtotal"] == "59.98"
    assert post_resp.data["has_out_of_stock_items"] is False

    sellers = post_resp.data["sellers"]
    assert len(sellers) == 1
    assert sellers[0]["seller_name"] == "Acme Tech"
    assert sellers[0]["subtotal"] == "59.98"
    assert sellers[0]["item_count"] == 2

    item = sellers[0]["items"][0]
    assert item["sku"] == "EARBUDS-BLK"
    assert item["unit_price"] == "29.99"
    assert item["compare_at_price"] == "39.99"
    assert item["quantity"] == 2
    assert item["line_subtotal"] == "59.98"
    assert item["available_stock"] == 8
    assert item["is_available"] is True

    # Re-fetch via GET
    get_resp = browser.get("/api/v1/cart/")
    assert get_resp.status_code == 200
    assert get_resp.data["total_items"] == 2
    assert get_resp.data["subtotal"] == "59.98"


def test_cart_item_update_and_capping(cart_setup_data: dict[str, Any], browser: APIClient) -> None:
    v1 = cart_setup_data["v1"]

    # Add 2 items (available = 8)
    add_resp = post_json(
        browser,
        "/api/v1/cart/items/",
        {"variant_id": str(v1.id), "quantity": 2},
    )
    item_id = add_resp.data["sellers"][0]["items"][0]["id"]

    # Update quantity to 5
    patch_resp = patch_json(
        browser,
        f"/api/v1/cart/items/{item_id}/",
        {"quantity": 5},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.data["total_items"] == 5
    assert patch_resp.data["subtotal"] == "149.95"
    assert patch_resp.data["sellers"][0]["items"][0]["quantity"] == 5

    # Request 50 units (exceeds available stock of 8) -> capped to 8
    cap_resp = patch_json(
        browser,
        f"/api/v1/cart/items/{item_id}/",
        {"quantity": 50},
    )
    assert cap_resp.status_code == 200
    assert cap_resp.data["total_items"] == 8
    assert cap_resp.data["subtotal"] == "239.92"
    assert cap_resp.data["sellers"][0]["items"][0]["quantity"] == 8

    # Set quantity to 0 -> item is removed
    del_resp = patch_json(
        browser,
        f"/api/v1/cart/items/{item_id}/",
        {"quantity": 0},
    )
    assert del_resp.status_code == 200
    assert del_resp.data["total_items"] == 0
    assert len(del_resp.data["sellers"]) == 0


def test_cart_item_remove_and_clear(cart_setup_data: dict[str, Any], browser: APIClient) -> None:
    v1 = cart_setup_data["v1"]
    v2 = cart_setup_data["v2"]

    # Add v1 and v2
    post_json(
        browser,
        "/api/v1/cart/items/",
        {"variant_id": str(v1.id), "quantity": 1},
    )
    add_resp2 = post_json(
        browser,
        "/api/v1/cart/items/",
        {"variant_id": str(v2.id), "quantity": 2},
    )
    assert add_resp2.data["total_items"] == 3
    items = add_resp2.data["sellers"][0]["items"]
    item_v1_id = [i for i in items if str(i["variant_id"]) == str(v1.id)][0]["id"]

    # Delete v1
    del_resp = delete_json(
        browser,
        f"/api/v1/cart/items/{item_v1_id}/",
    )
    assert del_resp.status_code == 200
    assert del_resp.data["total_items"] == 2
    assert del_resp.data["total_unique_items"] == 1
    assert str(del_resp.data["sellers"][0]["items"][0]["variant_id"]) == str(v2.id)

    # Clear cart
    clear_resp = post_json(
        browser,
        "/api/v1/cart/clear/",
        {},
    )
    assert clear_resp.status_code == 200
    assert clear_resp.data["total_items"] == 0
    assert clear_resp.data["subtotal"] == "0.00"


def test_cart_login_merging(cart_setup_data: dict[str, Any], browser: APIClient) -> None:
    v1 = cart_setup_data["v1"]
    v2 = cart_setup_data["v2"]
    cust_1 = cart_setup_data["cust_1"]

    # Guest adds v1 (qty=2) in guest session
    post_json(
        browser,
        "/api/v1/cart/items/",
        {"variant_id": str(v1.id), "quantity": 2},
    )
    guest_cart = Cart.objects.filter(session_key=browser.session.session_key).first()
    assert guest_cart is not None

    # Cust_1 already has a cart with v1 (qty=3) and v2 (qty=1)
    user_cart = Cart.objects.create(user=cust_1)
    CartItem.objects.create(cart=user_cart, variant=v1, quantity=3)
    CartItem.objects.create(cart=user_cart, variant=v2, quantity=1)

    # Login as cust_1
    login_resp = post_json(
        browser,
        "/api/v1/auth/login",
        {"email": "customer1@example.com", "password": PASSWORD},
    )
    assert login_resp.status_code == 200

    # Verify cart after login:
    # v1 merged: 3 + 2 = 5 (within available stock of 8)
    # v2 preserved: 1
    cart_resp = browser.get("/api/v1/cart/")
    assert cart_resp.status_code == 200
    assert cart_resp.data["total_items"] == 6
    assert cart_resp.data["total_unique_items"] == 2

    # Guest cart should have been deleted
    assert not Cart.objects.filter(id=guest_cart.id).exists()


def test_multi_seller_grouping(cart_setup_data: dict[str, Any], browser: APIClient) -> None:
    v1 = cart_setup_data["v1"]  # Seller 1 ($29.99)
    v3 = cart_setup_data["v3"]  # Seller 2 ($15.00)

    post_json(
        browser,
        "/api/v1/cart/items/",
        {"variant_id": str(v1.id), "quantity": 2},
    )
    post_json(
        browser,
        "/api/v1/cart/items/",
        {"variant_id": str(v3.id), "quantity": 3},
    )

    resp = browser.get("/api/v1/cart/")
    assert resp.status_code == 200
    assert resp.data["total_items"] == 5
    assert resp.data["total_unique_items"] == 2
    # 2 * 29.99 + 3 * 15.00 = 59.98 + 45.00 = 104.98
    assert resp.data["subtotal"] == "104.98"

    sellers = resp.data["sellers"]
    assert len(sellers) == 2

    seller_names = {s["seller_name"] for s in sellers}
    assert seller_names == {"Acme Tech", "Beta Goods"}

    acme = [s for s in sellers if s["seller_name"] == "Acme Tech"][0]
    assert acme["subtotal"] == "59.98"
    assert acme["item_count"] == 2

    beta = [s for s in sellers if s["seller_name"] == "Beta Goods"][0]
    assert beta["subtotal"] == "45.00"
    assert beta["item_count"] == 3


def test_cart_stock_validation(cart_setup_data: dict[str, Any], browser: APIClient) -> None:
    v1 = cart_setup_data["v1"]
    inv_1 = cart_setup_data["inv_1"]

    post_json(
        browser,
        "/api/v1/cart/items/",
        {"variant_id": str(v1.id), "quantity": 5},
    )

    # Initially valid (available = 8 >= 5)
    val_resp = browser.get("/api/v1/cart/validate/")
    assert val_resp.status_code == 200
    assert val_resp.data["valid"] is True
    assert len(val_resp.data["issues"]) == 0

    # Simulate stock reduction: set quantity_on_hand=5, quantity_reserved=3 -> available = 2
    inv_1.quantity_on_hand = 5
    inv_1.quantity_reserved = 3
    inv_1.save(update_fields=["quantity_on_hand", "quantity_reserved"])

    val_resp_2 = browser.get("/api/v1/cart/validate/")
    assert val_resp_2.status_code == 200
    assert val_resp_2.data["valid"] is False
    assert len(val_resp_2.data["issues"]) == 1
    issue = val_resp_2.data["issues"][0]
    assert issue["issue"] == "insufficient_stock"
    assert issue["available_stock"] == 2
    assert issue["requested_quantity"] == 5

    # Cart GET also flags has_out_of_stock_items
    cart_resp = browser.get("/api/v1/cart/")
    assert cart_resp.data["has_out_of_stock_items"] is True
    assert cart_resp.data["sellers"][0]["items"][0]["is_available"] is False


def test_cross_customer_cart_isolation(cart_setup_data: dict[str, Any], browser: APIClient) -> None:
    v1 = cart_setup_data["v1"]
    cust_1 = cart_setup_data["cust_1"]

    # Customer 1 cart
    cart_1 = Cart.objects.create(user=cust_1)
    item_1 = CartItem.objects.create(cart=cart_1, variant=v1, quantity=2)

    # Customer 2 logs in
    login_resp = post_json(
        browser,
        "/api/v1/auth/login",
        {"email": "customer2@example.com", "password": PASSWORD},
    )
    assert login_resp.status_code == 200

    # Customer 2 attempts to patch Customer 1's item
    patch_resp = patch_json(
        browser,
        f"/api/v1/cart/items/{item_1.id}/",
        {"quantity": 10},
    )
    assert patch_resp.status_code in (404, 403)

    # Customer 2 attempts to delete Customer 1's item
    del_resp = delete_json(
        browser,
        f"/api/v1/cart/items/{item_1.id}/",
    )
    assert del_resp.status_code in (404, 403)

    # Customer 1's item is untouched
    item_1.refresh_from_db()
    assert item_1.quantity == 2


def test_price_tamper_protection(cart_setup_data: dict[str, Any], browser: APIClient) -> None:
    v1 = cart_setup_data["v1"]

    # Attempt to inject custom unit price
    post_resp = post_json(
        browser,
        "/api/v1/cart/items/",
        {"variant_id": str(v1.id), "quantity": 1, "unit_price": "0.01"},
    )
    # StrictSerializer rejects unknown field or if allowed, server calculates from database price
    if post_resp.status_code == 201:
        assert post_resp.data["sellers"][0]["items"][0]["unit_price"] == "29.99"
        assert post_resp.data["subtotal"] == "29.99"
    else:
        assert post_resp.status_code == 400
