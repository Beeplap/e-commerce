from io import BytesIO
from typing import Any
from uuid import uuid4

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.catalog import services as catalog_services
from apps.catalog.models import (
    Attribute,
    AttributeOption,
    Brand,
    Category,
    CategoryAttribute,
    Product,
    ProductVariant,
    VariantAttributeValue,
)
from apps.inventory.models import Inventory, Warehouse
from apps.reviews.models import ProductReview
from apps.sellers.models import (
    Seller,
    SellerAddress,
    SellerMembership,
    SellerProfile,
    SellerRole,
    SellerSettings,
)
from apps.sellers.uploads import validate_document

pytestmark = pytest.mark.django_db


def create_png() -> SimpleUploadedFile:
    stream = BytesIO()
    Image.new("RGB", (16, 16), "blue").save(stream, "PNG")
    return SimpleUploadedFile("product.png", stream.getvalue(), content_type="image/png")


@pytest.fixture
def storefront_data(settings: Any) -> dict[str, Any]:
    settings.STORAGES = {
        **settings.STORAGES,
        "catalog": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
    }

    # Sellers
    seller_user = User.objects.create_user("seller1@example.com")
    owner_role = SellerRole.objects.get(name="OWNER", is_system=True)

    seller = Seller.objects.create(
        legal_name="Acme Corporation Ltd",
        display_name="Acme Superstore",
        slug="acme-store",
        email="acme@example.com",
        status=Seller.Status.ACTIVE,
        verification_status=Seller.VerificationStatus.VERIFIED,
        default_currency="USD",
    )
    SellerMembership.objects.create(
        seller=seller, user=seller_user, role=owner_role, status="active", joined_at=timezone.now()
    )
    SellerProfile.objects.create(
        seller=seller,
        description="Best tech and gadgets store",
        website="https://acme.example.com",
    )
    SellerSettings.objects.create(
        seller=seller,
        support_email="support@acme.example.com",
    )
    SellerAddress.objects.create(
        seller=seller,
        kind=SellerAddress.Kind.REGISTERED,
        line1="123 Market St",
        city="San Francisco",
        region="CA",
        postal_code="94105",
        country="US",
    )

    suspended_seller = Seller.objects.create(
        legal_name="Suspended Co",
        display_name="Suspended Shop",
        slug="suspended-shop",
        email="suspended@example.com",
        status=Seller.Status.ACTIVE,
        default_currency="USD",
    )

    # Categories & Brands
    electronics = Category.objects.create(name="Electronics", slug="electronics", is_active=True)
    smartphones = Category.objects.create(
        name="Smartphones", slug="smartphones", parent=electronics, is_active=True
    )
    brand_apple = Brand.objects.create(name="Apple", slug="apple", is_active=True)
    brand_samsung = Brand.objects.create(name="Samsung", slug="samsung", is_active=True)

    # Warehouse & Inventory setup
    warehouse = Warehouse.objects.create(
        seller=seller, name="Acme Main WH", code="acme-main", is_active=True
    )

    # Active Product 1 (Phone X)
    p1 = catalog_services.create_product(
        seller_user,
        seller.pk,
        {
            "category_id": smartphones.pk,
            "brand_id": brand_apple.pk,
            "name": "Phone X",
            "short_description": "Flagship smartphone",
            "description": "Full description of Phone X with groundbreaking specs.",
        },
    )

    v1 = catalog_services.save_variant(
        seller_user,
        seller.pk,
        p1.pk,
        {"sku": "PX-64-BLK", "price": "799.00", "compare_at_price": "899.00"},
    )
    v1.status = ProductVariant.Status.ACTIVE
    v1.save(update_fields=["status"])

    # Stock for v1: on_hand=10, reserved=2 -> available=8
    Inventory.objects.create(
        warehouse=warehouse, variant=v1, quantity_on_hand=10, quantity_reserved=2
    )

    # Variant attributes
    color_attr = Attribute.objects.create(
        name="Color",
        code="color",
        value_type=Attribute.ValueType.CHOICE,
        scope=Attribute.Scope.VARIANT,
        is_active=True,
    )
    CategoryAttribute.objects.create(category=smartphones, attribute=color_attr)
    color_opt = AttributeOption.objects.create(
        attribute=color_attr, label="Space Black", value="space-black", is_active=True
    )
    VariantAttributeValue.objects.create(
        seller=seller, variant=v1, attribute=color_attr, option=color_opt
    )

    # Image for p1
    img1 = catalog_services.upload_image(
        seller_user,
        seller.pk,
        p1.pk,
        image=validate_document(create_png()),
        alt_text="Phone X Front View",
        sort_order=0,
    )

    p1.status = Product.Status.ACTIVE
    p1.save(update_fields=["status"])

    # Customer Reviews for p1
    cust1 = User.objects.create_user("john.doe@example.com")
    cust2 = User.objects.create_user("jane@example.com")
    r1 = ProductReview.objects.create(
        customer=cust1,
        product=p1,
        rating=5,
        title="Incredible phone!",
        body="Amazing battery life and screen quality.",
        verified_purchase=True,
        status=ProductReview.Status.APPROVED,
    )
    r2 = ProductReview.objects.create(
        customer=cust2,
        product=p1,
        rating=4,
        title="Very solid",
        body="Good performance but slightly heavy.",
        verified_purchase=False,
        status=ProductReview.Status.APPROVED,
    )

    # Active Product 2 (Galaxy S)
    p2 = catalog_services.create_product(
        seller_user,
        seller.pk,
        {
            "category_id": smartphones.pk,
            "brand_id": brand_samsung.pk,
            "name": "Galaxy S",
            "short_description": "Android flagship",
            "description": "Galaxy specs",
        },
    )
    v2 = catalog_services.save_variant(
        seller_user, seller.pk, p2.pk, {"sku": "GS-128", "price": "699.00"}
    )
    v2.status = ProductVariant.Status.ACTIVE
    v2.save(update_fields=["status"])
    Inventory.objects.create(
        warehouse=warehouse, variant=v2, quantity_on_hand=5, quantity_reserved=0
    )

    p2.status = Product.Status.ACTIVE
    p2.save(update_fields=["status"])

    # Inactive / Draft Product
    p_draft = catalog_services.create_product(
        seller_user,
        seller.pk,
        {"category_id": electronics.pk, "name": "Secret Prototype"},
    )
    # p_draft is draft by default

    # Product on Suspended Seller
    suspended_owner = User.objects.create_user("suspended-owner@example.com")
    SellerMembership.objects.create(
        seller=suspended_seller,
        user=suspended_owner,
        role=owner_role,
        status="active",
        joined_at=timezone.now(),
    )
    p_suspended = catalog_services.create_product(
        suspended_owner,
        suspended_seller.pk,
        {"category_id": electronics.pk, "name": "Suspended Product"},
    )
    p_suspended.status = Product.Status.ACTIVE
    p_suspended.save(update_fields=["status"])

    suspended_seller.status = Seller.Status.SUSPENDED
    suspended_seller.save(update_fields=["status"])

    return {
        "seller": seller,
        "suspended_seller": suspended_seller,
        "electronics": electronics,
        "smartphones": smartphones,
        "brand_apple": brand_apple,
        "brand_samsung": brand_samsung,
        "p1": p1,
        "v1": v1,
        "img1": img1,
        "p2": p2,
        "p_draft": p_draft,
        "p_suspended": p_suspended,
        "cust1": cust1,
        "cust2": cust2,
        "r1": r1,
        "r2": r2,
    }


def test_public_category_listing(storefront_data: dict[str, Any]) -> None:
    client = APIClient()
    response = client.get("/api/v1/storefront/categories")
    assert response.status_code == 200
    assert response["Cache-Control"] == "public, max-age=60, s-maxage=300"

    data = response.json()
    assert isinstance(data, list)
    cat_names = [c["name"] for c in data]
    assert "Smartphones" in cat_names
    assert "Electronics" in cat_names

    # Check product count
    smartphones_data = next(c for c in data if c["name"] == "Smartphones")
    assert smartphones_data["product_count"] == 2


def test_public_brand_listing(storefront_data: dict[str, Any]) -> None:
    client = APIClient()
    response = client.get("/api/v1/storefront/brands")
    assert response.status_code == 200
    assert response["Cache-Control"] == "public, max-age=60, s-maxage=300"

    data = response.json()
    assert isinstance(data, list)
    brand_names = [b["name"] for b in data]
    assert "Apple" in brand_names
    assert "Samsung" in brand_names

    apple_data = next(b for b in data if b["name"] == "Apple")
    assert apple_data["product_count"] == 1


def test_product_listing_and_filtering(storefront_data: dict[str, Any]) -> None:
    client = APIClient()
    p1 = storefront_data["p1"]
    p2 = storefront_data["p2"]
    seller = storefront_data["seller"]
    smartphones = storefront_data["smartphones"]
    brand_apple = storefront_data["brand_apple"]

    # All active products
    res = client.get("/api/v1/storefront/products")
    assert res.status_code == 200
    assert res.json()["count"] == 2
    assert res["Cache-Control"] == "public, max-age=60, s-maxage=300"

    # Filter by category
    res = client.get(f"/api/v1/storefront/products?category={smartphones.pk}")
    assert res.status_code == 200
    assert res.json()["count"] == 2

    # Filter by brand
    res = client.get(f"/api/v1/storefront/products?brand={brand_apple.pk}")
    assert res.status_code == 200
    results = res.json()["results"]
    assert len(results) == 1
    assert results[0]["id"] == str(p1.pk)
    assert results[0]["title"] == "Phone X"
    assert results[0]["starting_price"] == "799.00"
    assert results[0]["compare_at_price"] == "899.00"
    assert results[0]["in_stock"] is True
    assert results[0]["average_rating"] == 4.5
    assert results[0]["review_count"] == 2

    # Filter by seller
    res = client.get(f"/api/v1/storefront/products?seller={seller.pk}")
    assert res.status_code == 200
    assert res.json()["count"] == 2

    # Sort price ascending (Galaxy S 699, Phone X 799)
    res = client.get("/api/v1/storefront/products?sort=price_asc")
    assert res.status_code == 200
    items = res.json()["results"]
    assert items[0]["id"] == str(p2.pk)
    assert items[1]["id"] == str(p1.pk)

    # Sort price descending (Phone X 799, Galaxy S 699)
    res = client.get("/api/v1/storefront/products?sort=price_desc")
    assert res.status_code == 200
    items = res.json()["results"]
    assert items[0]["id"] == str(p1.pk)
    assert items[1]["id"] == str(p2.pk)

    # Sort by rating
    res = client.get("/api/v1/storefront/products?sort=rating")
    assert res.status_code == 200
    items = res.json()["results"]
    assert items[0]["id"] == str(p1.pk)


def test_inactive_and_foreign_exclusions(storefront_data: dict[str, Any]) -> None:
    client = APIClient()
    p_draft = storefront_data["p_draft"]
    p_suspended = storefront_data["p_suspended"]
    suspended_seller = storefront_data["suspended_seller"]

    # Listings exclude draft and suspended seller products
    res = client.get("/api/v1/storefront/products")
    product_ids = [p["id"] for p in res.json()["results"]]
    assert str(p_draft.pk) not in product_ids
    assert str(p_suspended.pk) not in product_ids

    # Detail 404 for draft
    res = client.get(f"/api/v1/storefront/products/{p_draft.pk}")
    assert res.status_code == 404

    # Detail 404 for product under suspended seller
    res = client.get(f"/api/v1/storefront/products/{p_suspended.pk}")
    assert res.status_code == 404

    # Suspended seller detail 404
    res = client.get(f"/api/v1/storefront/sellers/{suspended_seller.pk}")
    assert res.status_code == 404


def test_product_detail_endpoint(storefront_data: dict[str, Any]) -> None:
    client = APIClient()
    p1 = storefront_data["p1"]
    seller = storefront_data["seller"]

    res = client.get(f"/api/v1/storefront/products/{p1.pk}")
    assert res.status_code == 200
    assert res["Cache-Control"] == "public, max-age=60, s-maxage=300"

    data = res.json()
    assert data["id"] == str(p1.pk)
    assert data["title"] == "Phone X"
    assert data["slug"] == p1.slug
    assert data["description"] == "Full description of Phone X with groundbreaking specs."
    assert data["short_description"] == "Flagship smartphone"
    assert data["starting_price"] == "799.00"
    assert data["compare_at_price"] == "899.00"
    assert data["currency"] == "USD"
    assert data["in_stock"] is True
    assert data["total_available_stock"] == 8  # 10 - 2
    assert data["average_rating"] == 4.5
    assert data["review_count"] == 2
    assert data["rating_breakdown"] == {"5": 1, "4": 1, "3": 0, "2": 0, "1": 0}

    # Variants with attributes
    assert len(data["variants"]) == 1
    variant = data["variants"][0]
    assert variant["sku"] == "PX-64-BLK"
    assert variant["price"] == "799.00"
    assert variant["compare_at_price"] == "899.00"
    assert variant["in_stock"] is True
    assert variant["available_quantity"] == 8
    assert variant["attributes"] == {"color": "Space Black"}

    # Seller badge
    assert data["seller"]["id"] == str(seller.pk)
    assert data["seller"]["name"] == "Acme Superstore"
    assert data["seller"]["store_name"] == "Acme Superstore"

    # Images
    assert len(data["images"]) == 1
    assert data["images"][0]["alt_text"] == "Phone X Front View"

    # Masked reviews
    assert len(data["recent_reviews"]) == 2
    reviewer_names = [r["customer_name"] for r in data["recent_reviews"]]
    assert "John D." in reviewer_names
    assert "Jane Customer" in reviewer_names
    for r in data["recent_reviews"]:
        assert "@" not in r["customer_name"]
        assert "example.com" not in r["customer_name"]


def test_public_seller_detail(storefront_data: dict[str, Any]) -> None:
    client = APIClient()
    seller = storefront_data["seller"]

    res = client.get(f"/api/v1/storefront/sellers/{seller.pk}")
    assert res.status_code == 200
    assert res["Cache-Control"] == "public, max-age=60, s-maxage=300"

    data = res.json()
    assert data["id"] == str(seller.pk)
    assert data["name"] == "Acme Superstore"
    assert data["store_name"] == "Acme Superstore"
    assert data["description"] == "Best tech and gadgets store"
    assert data["contact_email"] == "support@acme.example.com"
    assert data["city"] == "San Francisco"
    assert data["state"] == "CA"
    assert data["country"] == "US"
    assert data["total_products"] == 2
    assert data["average_rating"] == 4.5


def test_image_streaming(storefront_data: dict[str, Any]) -> None:
    client = APIClient()
    p1 = storefront_data["p1"]
    img1 = storefront_data["img1"]

    res = client.get(f"/api/v1/storefront/products/{p1.pk}/images/{img1.pk}")
    assert res.status_code == 200
    assert res["Content-Type"] == "image/png"
    assert res["Cache-Control"] == "public, max-age=86400, immutable"

    # Inactive product image returns 404
    p_draft = storefront_data["p_draft"]
    res = client.get(f"/api/v1/storefront/products/{p_draft.pk}/images/{img1.pk}")
    assert res.status_code == 404

    # Non-existent image returns 404
    res = client.get(f"/api/v1/storefront/products/{p1.pk}/images/{uuid4()}")
    assert res.status_code == 404


def test_invalid_parameters_rejected() -> None:
    client = APIClient()
    # Invalid query param
    res = client.get("/api/v1/storefront/products?unknown=foo")
    assert res.status_code == 400

    # Invalid UUID
    res = client.get("/api/v1/storefront/products?category=not-a-uuid")
    assert res.status_code == 400

    # Invalid sort option
    res = client.get("/api/v1/storefront/products?sort=hacked")
    assert res.status_code == 400
