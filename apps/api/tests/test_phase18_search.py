from io import BytesIO
from typing import Any

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
    SellerMembership,
    SellerRole,
)
from apps.sellers.uploads import validate_document

pytestmark = pytest.mark.django_db


def create_png() -> SimpleUploadedFile:
    stream = BytesIO()
    Image.new("RGB", (16, 16), "blue").save(stream, "PNG")
    return SimpleUploadedFile("product.png", stream.getvalue(), content_type="image/png")


@pytest.fixture
def search_catalog_data(settings: Any) -> dict[str, Any]:
    settings.STORAGES = {
        **settings.STORAGES,
        "catalog": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
    }

    # Sellers
    seller_user = User.objects.create_user("seller_search@example.com")
    owner_role = SellerRole.objects.get(name="OWNER", is_system=True)

    seller_active = Seller.objects.create(
        legal_name="Apex Global Inc",
        display_name="Apex Electronics",
        slug="apex-electronics",
        email="apex@example.com",
        status=Seller.Status.ACTIVE,
        verification_status=Seller.VerificationStatus.VERIFIED,
        default_currency="USD",
    )
    SellerMembership.objects.create(
        seller=seller_active,
        user=seller_user,
        role=owner_role,
        status="active",
        joined_at=timezone.now(),
    )

    suspended_seller = Seller.objects.create(
        legal_name="Suspended Corp",
        display_name="Suspended Merchant",
        slug="suspended-merchant",
        email="suspended@example.com",
        status=Seller.Status.ACTIVE,
        default_currency="USD",
    )

    # Categories
    electronics = Category.objects.create(name="Electronics", slug="electronics", is_active=True)
    audio = Category.objects.create(
        name="Audio & Headphones", slug="audio", parent=electronics, is_active=True
    )
    computing = Category.objects.create(
        name="Computing", slug="computing", parent=electronics, is_active=True
    )

    # Brands
    apex_brand = Brand.objects.create(name="Apex", slug="apex", is_active=True)
    sonic_brand = Brand.objects.create(name="SonicWave", slug="sonicwave", is_active=True)

    # Attributes
    color_attr = Attribute.objects.create(
        name="Color",
        code="color",
        value_type=Attribute.ValueType.CHOICE,
        scope=Attribute.Scope.VARIANT,
        is_active=True,
    )
    CategoryAttribute.objects.create(category=electronics, attribute=color_attr)
    CategoryAttribute.objects.create(category=audio, attribute=color_attr)
    CategoryAttribute.objects.create(category=computing, attribute=color_attr)
    opt_black = AttributeOption.objects.create(
        attribute=color_attr, value="black", label="Black", is_active=True
    )
    opt_silver = AttributeOption.objects.create(
        attribute=color_attr, value="silver", label="Silver", is_active=True
    )

    # Warehouse
    warehouse = Warehouse.objects.create(
        seller=seller_active,
        name="Apex Search Warehouse",
        code="apex-wh",
        is_active=True,
    )

    # 1. Product 1: "Apex Wireless Noise-Cancelling Headphones" ($149.00, in stock, rating 4.5)
    p1 = catalog_services.create_product(
        seller_user,
        seller_active.pk,
        {
            "category_id": audio.pk,
            "brand_id": apex_brand.pk,
            "name": "Apex Wireless Noise-Cancelling Headphones",
            "description": (
                "Premium studio quality wireless headphones with active noise cancellation."
            ),
            "short_description": "Wireless headphones",
        },
    )
    v1 = catalog_services.save_variant(
        seller_user,
        seller_active.pk,
        p1.pk,
        {"sku": "APX-AUD-BLK", "price": "149.00", "compare_at_price": "199.00"},
    )
    v1.status = ProductVariant.Status.ACTIVE
    v1.save(update_fields=["status"])

    VariantAttributeValue.objects.create(
        seller=seller_active,
        variant=v1,
        attribute=color_attr,
        option=opt_black,
    )
    Inventory.objects.create(
        warehouse=warehouse,
        variant=v1,
        quantity_on_hand=25,
        quantity_reserved=5,
    )
    catalog_services.upload_image(
        seller_user,
        seller_active.pk,
        p1.pk,
        image=validate_document(create_png()),
        alt_text="Apex Headphones",
        sort_order=0,
    )
    p1.status = Product.Status.ACTIVE
    p1.save(update_fields=["status"])

    # Reviews for P1 (avg: 4.5)
    cust1 = User.objects.create_user("cust1@example.com")
    cust2 = User.objects.create_user("cust2@example.com")
    ProductReview.objects.create(
        customer=cust1,
        product=p1,
        rating=5,
        title="Unbelievable bass",
        body="Clear highs and incredible soundstage.",
        status=ProductReview.Status.APPROVED,
    )
    ProductReview.objects.create(
        customer=cust2,
        product=p1,
        rating=4,
        title="Very good comfort",
        body="Can wear for hours without fatigue.",
        status=ProductReview.Status.APPROVED,
    )

    # 2. Product 2: "SonicWave Bluetooth Portable Speaker" ($45.00, in stock, rating 3.0)
    p2 = catalog_services.create_product(
        seller_user,
        seller_active.pk,
        {
            "category_id": audio.pk,
            "brand_id": sonic_brand.pk,
            "name": "SonicWave Bluetooth Portable Speaker",
            "description": "Waterproof portable outdoor bluetooth speaker with 12h battery life.",
            "short_description": "Portable speaker",
        },
    )
    v2 = catalog_services.save_variant(
        seller_user,
        seller_active.pk,
        p2.pk,
        {"sku": "SNC-SPK-BLU", "price": "45.00", "compare_at_price": "59.00"},
    )
    v2.status = ProductVariant.Status.ACTIVE
    v2.save(update_fields=["status"])

    VariantAttributeValue.objects.create(
        seller=seller_active,
        variant=v2,
        attribute=color_attr,
        option=opt_silver,
    )
    Inventory.objects.create(
        warehouse=warehouse,
        variant=v2,
        quantity_on_hand=50,
        quantity_reserved=0,
    )
    p2.status = Product.Status.ACTIVE
    p2.save(update_fields=["status"])

    ProductReview.objects.create(
        customer=cust1,
        product=p2,
        rating=3,
        title="Decent for price",
        body="Average sound quality but rugged build.",
        status=ProductReview.Status.APPROVED,
    )

    # 3. Product 3: "Apex Ultra Pro Laptop" ($899.00, out of stock, no reviews)
    p3 = catalog_services.create_product(
        seller_user,
        seller_active.pk,
        {
            "category_id": computing.pk,
            "brand_id": apex_brand.pk,
            "name": "Apex Ultra Pro Laptop",
            "description": "High-performance laptop with 32GB RAM and 4K display.",
            "short_description": "Flagship laptop",
        },
    )
    v3 = catalog_services.save_variant(
        seller_user,
        seller_active.pk,
        p3.pk,
        {"sku": "APX-LPT-32G", "price": "899.00", "compare_at_price": "1099.00"},
    )
    v3.status = ProductVariant.Status.ACTIVE
    v3.save(update_fields=["status"])

    VariantAttributeValue.objects.create(
        seller=seller_active,
        variant=v3,
        attribute=color_attr,
        option=opt_silver,
    )
    # Out of stock: on_hand == reserved
    Inventory.objects.create(
        warehouse=warehouse,
        variant=v3,
        quantity_on_hand=2,
        quantity_reserved=2,
    )
    p3.status = Product.Status.ACTIVE
    p3.save(update_fields=["status"])

    # 4. Product 4: Draft product (should never appear in search)
    p4_draft = catalog_services.create_product(
        seller_user,
        seller_active.pk,
        {
            "category_id": audio.pk,
            "brand_id": apex_brand.pk,
            "name": "Apex Secret Prototype Earbuds",
            "description": "Unreleased prototype.",
        },
    )
    v4 = catalog_services.save_variant(
        seller_user,
        seller_active.pk,
        p4_draft.pk,
        {"sku": "APX-PROTO-01", "price": "299.00"},
    )
    v4.status = ProductVariant.Status.ACTIVE
    v4.save(update_fields=["status"])

    # 5. Product 5: Product belonging to suspended seller (should never appear)
    SellerMembership.objects.create(
        seller=suspended_seller,
        user=seller_user,
        role=owner_role,
        status="active",
        joined_at=timezone.now(),
    )
    p5_suspended = catalog_services.create_product(
        seller_user,
        suspended_seller.pk,
        {
            "category_id": audio.pk,
            "brand_id": sonic_brand.pk,
            "name": "Suspended Brand Wireless Speaker",
            "description": "Should be completely hidden.",
        },
    )
    v5 = catalog_services.save_variant(
        seller_user,
        suspended_seller.pk,
        p5_suspended.pk,
        {"sku": "SUSP-SPK-01", "price": "99.00"},
    )
    v5.status = ProductVariant.Status.ACTIVE
    v5.save(update_fields=["status"])
    p5_suspended.status = Product.Status.ACTIVE
    p5_suspended.save(update_fields=["status"])

    # Now suspend the seller
    suspended_seller.status = Seller.Status.SUSPENDED
    suspended_seller.save(update_fields=["status"])

    return {
        "seller": seller_active,
        "suspended_seller": suspended_seller,
        "electronics": electronics,
        "audio": audio,
        "computing": computing,
        "apex_brand": apex_brand,
        "sonic_brand": sonic_brand,
        "product_headphones": p1,
        "product_speaker": p2,
        "product_laptop": p3,
        "product_draft": p4_draft,
        "product_suspended": p5_suspended,
    }


def test_full_text_search_matches_query(search_catalog_data: dict[str, Any]) -> None:
    client = APIClient()

    # Search for "Noise-Cancelling"
    response = client.get("/api/v1/storefront/search?q=Noise-Cancelling")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 1
    assert data["results"][0]["id"] == str(search_catalog_data["product_headphones"].pk)
    assert data["results"][0]["title"] == "Apex Wireless Noise-Cancelling Headphones"

    # Search by brand "SonicWave"
    response = client.get("/api/v1/storefront/search?q=SonicWave")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 1
    assert data["results"][0]["id"] == str(search_catalog_data["product_speaker"].pk)

    # Search by category "Computing"
    response = client.get("/api/v1/storefront/search?q=Computing")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 1
    assert data["results"][0]["id"] == str(search_catalog_data["product_laptop"].pk)

    # Search by SKU "APX-AUD-BLK"
    response = client.get("/api/v1/storefront/search?q=APX-AUD-BLK")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 1
    assert data["results"][0]["id"] == str(search_catalog_data["product_headphones"].pk)

    # Partial substring query "Wire"
    response = client.get("/api/v1/storefront/search?q=Wire")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 1
    assert data["results"][0]["id"] == str(search_catalog_data["product_headphones"].pk)


def test_search_faceted_counts_dynamic_aggregation(search_catalog_data: dict[str, Any]) -> None:
    client = APIClient()

    # Query all active products in search
    response = client.get("/api/v1/storefront/search")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 3  # P1, P2, P3
    facets = data["facets"]

    # Verify categories facet
    cat_names = {c["name"]: c["count"] for c in facets["categories"]}
    assert cat_names.get("Audio & Headphones") == 2
    assert cat_names.get("Computing") == 1

    # Verify brands facet
    brand_names = {b["name"]: b["count"] for b in facets["brands"]}
    assert brand_names.get("Apex") == 2
    assert brand_names.get("SonicWave") == 1

    # Verify price brackets: Under $50 (P2: $45), $100-$250 (P1: $149), $500+ (P3: $899)
    price_map = {b["label"]: b["count"] for b in facets["price_brackets"]}
    assert price_map.get("Under $50") == 1
    assert price_map.get("$100 to $250") == 1
    assert price_map.get("$500 & Above") == 1

    # Verify rating brackets: 4 stars & above (P1: 4.5 avg), 3 stars & above (P1 & P2: 3.0 avg)
    rating_map = {r["min_rating"]: r["count"] for r in facets["rating_brackets"]}
    assert rating_map.get(4) == 1
    assert rating_map.get(3) == 2

    # Verify in_stock count: P1 and P2 have available stock; P3 has 0 available
    assert facets["in_stock_count"] == 2


def test_search_filtering_by_facets(search_catalog_data: dict[str, Any]) -> None:
    client = APIClient()

    # Filter by category
    audio_id = search_catalog_data["audio"].pk
    resp = client.get(f"/api/v1/storefront/search?category={audio_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 2
    ids = {r["id"] for r in data["results"]}
    assert ids == {
        str(search_catalog_data["product_headphones"].pk),
        str(search_catalog_data["product_speaker"].pk),
    }

    # Filter by brand
    brand_sonic_id = search_catalog_data["sonic_brand"].pk
    resp = client.get(f"/api/v1/storefront/search?brand={brand_sonic_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 1
    assert data["results"][0]["id"] == str(search_catalog_data["product_speaker"].pk)

    # Filter by price range ($100 to $200)
    resp = client.get("/api/v1/storefront/search?min_price=100&max_price=200")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 1
    assert data["results"][0]["id"] == str(search_catalog_data["product_headphones"].pk)

    # Filter by in_stock=true
    resp = client.get("/api/v1/storefront/search?in_stock=true")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 2
    in_stock_ids = {r["id"] for r in data["results"]}
    assert str(search_catalog_data["product_laptop"].pk) not in in_stock_ids

    # Filter by min_rating=4.0
    resp = client.get("/api/v1/storefront/search?min_rating=4.0")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 1
    assert data["results"][0]["id"] == str(search_catalog_data["product_headphones"].pk)


def test_search_sorting_orders(search_catalog_data: dict[str, Any]) -> None:
    client = APIClient()

    # Price ascending ($45.00 -> $149.00 -> $899.00)
    resp = client.get("/api/v1/storefront/search?sort=price_asc")
    assert resp.status_code == 200
    prices = [float(r["starting_price"]) for r in resp.json()["results"]]
    assert prices == [45.0, 149.0, 899.0]

    # Price descending ($899.00 -> $149.00 -> $45.00)
    resp = client.get("/api/v1/storefront/search?sort=price_desc")
    assert resp.status_code == 200
    prices = [float(r["starting_price"]) for r in resp.json()["results"]]
    assert prices == [899.0, 149.0, 45.0]

    # Rating descending (4.5 -> 3.0 -> None)
    resp = client.get("/api/v1/storefront/search?sort=rating")
    assert resp.status_code == 200
    results = resp.json()["results"]
    assert results[0]["id"] == str(search_catalog_data["product_headphones"].pk)
    assert results[1]["id"] == str(search_catalog_data["product_speaker"].pk)


def test_search_suggest_autocomplete(search_catalog_data: dict[str, Any]) -> None:
    client = APIClient()

    # Query suggest for "ap"
    resp = client.get("/api/v1/storefront/search/suggest?q=ap")
    assert resp.status_code == 200
    data = resp.json()
    assert data["query"] == "ap"

    # Contains Apex brand
    brand_names = [b["name"] for b in data["brands"]]
    assert "Apex" in brand_names

    # Contains product matches
    prod_titles = [p["title"] for p in data["products"]]
    assert any("Apex" in title for title in prod_titles)

    # Text suggestions list populated
    assert len(data["suggestions"]) > 0


def test_search_sanitization_and_isolation(search_catalog_data: dict[str, Any]) -> None:
    client = APIClient()

    # Search with control characters and extra spaces
    resp = client.get("/api/v1/storefront/search?q=%00%1F%20Noise-Cancelling%20%07")
    assert resp.status_code == 200
    assert resp.json()["count"] == 1

    # Search query targeting draft product should return 0 results
    resp = client.get("/api/v1/storefront/search?q=Secret%20Prototype")
    assert resp.status_code == 200
    assert resp.json()["count"] == 0

    # Search query targeting suspended seller product should return 0 results
    resp = client.get("/api/v1/storefront/search?q=Suspended%20Brand")
    assert resp.status_code == 200
    assert resp.json()["count"] == 0


def test_search_pagination_bounds(search_catalog_data: dict[str, Any]) -> None:
    client = APIClient()

    # Limit capped at 50, test limit=1
    resp = client.get("/api/v1/storefront/search?limit=1&page=1")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 3
    assert len(data["results"]) == 1
    assert data["next"] == "?page=2"
    assert data["previous"] is None

    # Page 2
    resp2 = client.get("/api/v1/storefront/search?limit=1&page=2")
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert len(data2["results"]) == 1
    assert data2["next"] == "?page=3"
    assert data2["previous"] == "?page=1"

    # Invalid negative page
    resp_invalid = client.get("/api/v1/storefront/search?page=-1")
    assert resp_invalid.status_code == 400


def test_search_query_budget(
    search_catalog_data: dict[str, Any], django_assert_num_queries: Any
) -> None:
    client = APIClient()

    # Assert search execution with facets completes within a bounded query budget
    with django_assert_num_queries(8):
        resp = client.get("/api/v1/storefront/search?q=Apex&limit=20")
        assert resp.status_code == 200
        assert resp.json()["count"] >= 1
