from collections.abc import Iterable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from decimal import Decimal
from io import BytesIO
from threading import Barrier
from typing import Any, cast
from unittest.mock import patch
from uuid import uuid4

import pytest
from django.core.files.storage import storages
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import DatabaseError, IntegrityError, close_old_connections, transaction
from django.http import Http404, StreamingHttpResponse
from django.utils import timezone
from PIL import Image
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.audit.models import AuditLog
from apps.catalog import services
from apps.catalog.models import (
    Attribute,
    AttributeOption,
    Category,
    CategoryAttribute,
    Product,
    ProductAttributeValue,
    ProductImage,
    ProductStatusHistory,
    ProductVariant,
    VariantAttributeValue,
)
from apps.platform_access.models import PlatformAccess, PlatformRole
from apps.sellers.models import Seller, SellerMembership, SellerRole
from apps.sellers.uploads import validate_document

pytestmark = pytest.mark.django_db


def client(user: User) -> APIClient:
    browser = APIClient(enforce_csrf_checks=True)
    browser.force_login(user, backend="django.contrib.auth.backends.ModelBackend")
    browser.credentials(HTTP_X_CSRFTOKEN=browser.get("/api/v1/auth/csrf").json()["csrf_token"])
    return browser


def png() -> SimpleUploadedFile:
    stream = BytesIO()
    Image.new("RGB", (8, 8), "white").save(stream, "PNG")
    return SimpleUploadedFile("original-name.png", stream.getvalue(), content_type="image/png")


@dataclass
class Setup:
    owner: User
    admin: User
    seller: Seller
    foreign: Seller
    category: Category
    product: Product
    foreign_product: Product
    variant: ProductVariant
    foreign_variant: ProductVariant
    browser: APIClient
    platform: APIClient


@pytest.fixture
def setup(settings: Any) -> Setup:
    settings.STORAGES = {
        **settings.STORAGES,
        "catalog": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
    }
    owner = User.objects.create_user("catalog-owner@example.com")
    other = User.objects.create_user("catalog-other@example.com")
    admin = User.objects.create_user("catalog-admin@example.com")
    PlatformAccess.objects.create(user=admin, role=PlatformRole.objects.get(name="SUPER_ADMIN"))
    seller = Seller.objects.create(
        legal_name="Catalog A",
        display_name="A",
        slug="catalog-a",
        email="a@example.com",
        status="active",
        default_currency="NPR",
    )
    foreign = Seller.objects.create(
        legal_name="Catalog B",
        display_name="B",
        slug="catalog-b",
        email="b@example.com",
        status="active",
    )
    role = SellerRole.objects.get(name="OWNER", is_system=True)
    SellerMembership.objects.create(
        seller=seller, user=owner, role=role, status="active", joined_at=timezone.now()
    )
    SellerMembership.objects.create(
        seller=foreign, user=other, role=role, status="active", joined_at=timezone.now()
    )
    category = Category.objects.create(name="Clothes", slug="clothes")
    product = services.create_product(
        owner, seller.pk, {"category_id": category.pk, "name": "Shirt"}
    )
    foreign_product = services.create_product(
        other, foreign.pk, {"category_id": category.pk, "name": "Foreign shirt"}
    )
    variant = services.save_variant(
        owner, seller.pk, product.pk, {"sku": "shirt", "price": "123.45"}
    )
    foreign_variant = services.save_variant(
        other, foreign.pk, foreign_product.pk, {"sku": "shirt", "price": "20.00"}
    )
    return Setup(
        owner,
        admin,
        seller,
        foreign,
        category,
        product,
        foreign_product,
        variant,
        foreign_variant,
        client(owner),
        client(admin),
    )


def root(setup: Setup, *, foreign: bool = False) -> str:
    return f"/api/v1/seller/products/{setup.foreign_product.pk if foreign else setup.product.pk}"


def test_product_create_assigns_verified_tenant_and_currency(setup: Setup) -> None:
    response = setup.browser.post(
        "/api/v1/seller/products",
        {"category_id": str(setup.category.pk), "name": "New"},
        format="json",
        HTTP_X_SELLER_ID=str(setup.seller.pk),
    )
    assert response.status_code == 201, response.data
    assert response.json()["seller_id"] == str(setup.seller.pk)
    assert response.data["currency"] == "NPR" and response.data["status"] == "draft"
    assert response.json()["created_by_id"] == str(setup.owner.pk)
    assert AuditLog.objects.filter(
        target_id=response.data["id"], action="catalog.product.created"
    ).exists()


@pytest.mark.parametrize(
    "field", ["seller_id", "status", "approved_by", "created_by", "currency", "slug"]
)
def test_product_rejects_mass_assignment(setup: Setup, field: str) -> None:
    response = setup.browser.post(
        "/api/v1/seller/products",
        {"category_id": str(setup.category.pk), "name": "Attack", field: str(setup.foreign.pk)},
        format="json",
        HTTP_X_SELLER_ID=str(setup.seller.pk),
    )
    assert response.status_code == 400


@pytest.mark.parametrize("suffix", ["", "/variants", "/images", "/attributes", "/history"])
def test_foreign_product_reads_and_children_are_not_enumerated(setup: Setup, suffix: str) -> None:
    assert (
        setup.browser.get(
            root(setup, foreign=True) + suffix, HTTP_X_SELLER_ID=str(setup.seller.pk)
        ).status_code
        == 404
    )
    page = setup.browser.get("/api/v1/seller/products", HTTP_X_SELLER_ID=str(setup.seller.pk)).data
    assert page["count"] == 1 and page["results"][0]["id"] == str(setup.product.pk)


@pytest.mark.parametrize("suffix", ["/submit-for-review", "/archive", "/revise", "/variants"])
def test_foreign_product_mutations_are_rejected(setup: Setup, suffix: str) -> None:
    body = {"sku": "attack", "price": "1.00"} if suffix == "/variants" else {}
    assert (
        setup.browser.post(
            root(setup, foreign=True) + suffix,
            body,
            format="json",
            HTTP_X_SELLER_ID=str(setup.seller.pk),
        ).status_code
        == 404
    )
    setup.foreign_product.refresh_from_db()
    assert setup.foreign_product.status == "draft"


def test_foreign_variants_and_fk_resolution_are_scoped(setup: Setup) -> None:
    path = root(setup) + f"/variants/{setup.foreign_variant.pk}"
    assert (
        setup.browser.put(
            path,
            {"sku": "attack", "price": "1.00"},
            format="json",
            HTTP_X_SELLER_ID=str(setup.seller.pk),
        ).status_code
        == 404
    )
    assert (
        setup.browser.get(path + "/attributes", HTTP_X_SELLER_ID=str(setup.seller.pk)).status_code
        == 404
    )
    assert (
        setup.browser.put(
            path + "/attributes",
            {"attribute_id": str(uuid4()), "value": "x"},
            format="json",
            HTTP_X_SELLER_ID=str(setup.seller.pk),
        ).status_code
        == 404
    )
    assert setup.browser.get(root(setup), HTTP_X_SELLER_ID=str(setup.foreign.pk)).status_code == 404


@pytest.mark.parametrize("change", ["membership", "seller", "user"])
def test_access_revocation_is_immediate(setup: Setup, change: str) -> None:
    if change == "membership":
        SellerMembership.objects.filter(seller=setup.seller, user=setup.owner).update(
            status="suspended"
        )
    elif change == "seller":
        Seller.objects.filter(pk=setup.seller.pk).update(status="suspended")
    else:
        User.objects.filter(pk=setup.owner.pk).update(is_active=False)
    assert setup.browser.get(root(setup), HTTP_X_SELLER_ID=str(setup.seller.pk)).status_code == (
        403 if change == "user" else 404
    )


def test_capability_required_and_superuser_does_not_bypass_tenant(setup: Setup) -> None:
    setup.owner.is_superuser = True
    setup.owner.save()
    membership = SellerMembership.objects.get(user=setup.owner, seller=setup.seller)
    membership.role = SellerRole.objects.get(name="SUPPORT_AGENT", is_system=True)
    membership.save()
    assert setup.browser.get(root(setup), HTTP_X_SELLER_ID=str(setup.seller.pk)).status_code == 403
    assert setup.browser.get("/api/v1/admin/products").status_code == 403


@pytest.mark.parametrize(
    "values",
    [
        {"price": 1.2},
        {"price": "-1.00"},
        {"price": "1.001"},
        {"price": "NaN"},
        {"price": "1000000000000.00"},
        {"price": "10.00", "compare_at_price": "9.99"},
        {"price": "1.00", "cost_price": "-1.00"},
        {"price": "1.00", "weight": "-0.01"},
    ],
)
def test_variant_decimal_validation(setup: Setup, values: dict[str, Any]) -> None:
    response = setup.browser.post(
        root(setup) + "/variants",
        {"sku": "new", **values},
        format="json",
        HTTP_X_SELLER_ID=str(setup.seller.pk),
    )
    assert response.status_code == 400, response.data


def test_money_precision_and_sku_scope(setup: Setup) -> None:
    values = {"sku": "NEW", "price": "999999999999.99", "compare_at_price": "999999999999.99"}
    response = setup.browser.post(
        root(setup) + "/variants", values, format="json", HTTP_X_SELLER_ID=str(setup.seller.pk)
    )
    assert response.status_code == 201 and response.data["price"] == "999999999999.99"
    assert ProductVariant.objects.get(pk=response.data["id"]).price == Decimal("999999999999.99")
    assert (
        setup.browser.post(
            root(setup) + "/variants",
            {**values, "sku": "new"},
            format="json",
            HTTP_X_SELLER_ID=str(setup.seller.pk),
        ).status_code
        == 400
    )
    assert setup.foreign_variant.sku == setup.variant.sku


def test_required_attributes_and_wrong_category_or_option(setup: Setup) -> None:
    attribute = Attribute.objects.create(
        name="Material", code="material", value_type="choice", scope="product"
    )
    CategoryAttribute.objects.create(category=setup.category, attribute=attribute, is_required=True)
    option = AttributeOption.objects.create(attribute=attribute, label="Cotton", value="cotton")
    other = Attribute.objects.create(name="Size", code="size", value_type="choice", scope="variant")
    bad_option = AttributeOption.objects.create(attribute=other, label="Large", value="large")
    with pytest.raises(ValidationError):
        services.seller_action(setup.owner, setup.seller.pk, setup.product.pk, "submit-for-review")
    with pytest.raises(Http404):
        services.save_attribute_value(
            setup.owner,
            setup.seller.pk,
            setup.product.pk,
            {"attribute_id": attribute.pk, "option_id": bad_option.pk},
        )
    with pytest.raises(Http404):
        services.save_attribute_value(
            setup.owner,
            setup.seller.pk,
            setup.product.pk,
            {"attribute_id": other.pk, "option_id": bad_option.pk},
        )
    services.save_attribute_value(
        setup.owner,
        setup.seller.pk,
        setup.product.pk,
        {"attribute_id": attribute.pk, "option_id": option.pk},
    )
    assert (
        services.seller_action(
            setup.owner, setup.seller.pk, setup.product.pk, "submit-for-review"
        ).status
        == "pending_review"
    )
    option.is_active = False
    option.save()
    with pytest.raises(Http404):
        services.moderate_product(setup.admin, setup.product.pk, approve=True)


def test_variant_attributes_required_for_every_active_variant(setup: Setup) -> None:
    attribute = Attribute.objects.create(
        name="Size", code="size", value_type="text", scope="variant"
    )
    CategoryAttribute.objects.create(category=setup.category, attribute=attribute, is_required=True)
    with pytest.raises(ValidationError):
        services.seller_action(setup.owner, setup.seller.pk, setup.product.pk, "submit-for-review")
    services.save_attribute_value(
        setup.owner,
        setup.seller.pk,
        setup.product.pk,
        {"attribute_id": attribute.pk, "value": "Medium"},
        variant_id=setup.variant.pk,
    )
    assert (
        services.seller_action(
            setup.owner, setup.seller.pk, setup.product.pk, "submit-for-review"
        ).status
        == "pending_review"
    )


def test_moderation_history_and_explicit_revision(setup: Setup) -> None:
    services.seller_action(setup.owner, setup.seller.pk, setup.product.pk, "submit-for-review")
    product = services.moderate_product(setup.admin, setup.product.pk, approve=True)
    assert product.status == "active" and product.approved_by == setup.admin and product.approved_at
    with pytest.raises(ValidationError):
        services.save_variant(
            setup.owner, setup.seller.pk, product.pk, {"sku": "new", "price": "1.00"}
        )
    product = services.seller_action(setup.owner, setup.seller.pk, product.pk, "revise")
    assert (
        product.status == "draft" and product.approved_by_id is None and product.approved_at is None
    )
    services.seller_action(setup.owner, setup.seller.pk, product.pk, "submit-for-review")
    product = services.moderate_product(
        setup.admin, product.pk, approve=False, reason="Improve description"
    )
    history = product.status_history.first()
    assert product.status == "rejected" and history is not None
    assert history.reason == "Improve description"
    product = services.seller_action(setup.owner, setup.seller.pk, product.pk, "archive")
    assert product.status == "archived"
    for action in ["archive", "revise", "submit-for-review"]:
        with pytest.raises(ValidationError):
            services.seller_action(setup.owner, setup.seller.pk, product.pk, action)
    assert ProductStatusHistory.objects.filter(product=product).count() == 7


def test_self_approval_forbidden_even_platform_member(setup: Setup) -> None:
    PlatformAccess.objects.create(
        user=setup.owner, role=PlatformRole.objects.get(name="SUPER_ADMIN")
    )
    services.seller_action(setup.owner, setup.seller.pk, setup.product.pk, "submit-for-review")
    for approve in [True, False]:
        response = setup.browser.post(
            f"/api/v1/admin/products/{setup.product.pk}/{'approve' if approve else 'reject'}",
            {} if approve else {"reason": "Own review"},
            format="json",
        )
        assert response.status_code == 403
    setup.product.refresh_from_db()
    assert setup.product.status == "pending_review"


def test_invalid_categories_and_inactive_ancestors(setup: Setup) -> None:
    for category_id in [uuid4(), setup.category.pk]:
        setup.category.is_active = False
        setup.category.save()
        response = setup.browser.put(
            root(setup),
            {"category_id": str(category_id), "name": "Bad"},
            format="json",
            HTTP_X_SELLER_ID=str(setup.seller.pk),
        )
        assert response.status_code == 404
    child = Category.objects.create(name="Child", slug="child", parent=setup.category)
    with pytest.raises(Http404):
        services.create_product(
            setup.owner, setup.seller.pk, {"category_id": child.pk, "name": "Bad"}
        )


def test_taxonomy_cycle_and_identity_guards_and_audit(setup: Setup) -> None:
    category = services.save_taxonomy(
        setup.admin,
        "categories",
        {"name": "Child", "slug": "child", "parent_id": setup.category.pk},
    )
    with pytest.raises(ValidationError):
        services.save_taxonomy(
            setup.admin,
            "categories",
            {"name": "Clothes", "slug": "clothes", "parent_id": category.pk},
            identity=setup.category.pk,
        )
    attribute = services.save_taxonomy(
        setup.admin,
        "attributes",
        {"name": "Color", "code": "color", "scope": "variant", "value_type": "text"},
    )
    with pytest.raises(ValidationError):
        services.save_taxonomy(
            setup.admin,
            "attributes",
            {"name": "Color", "code": "color", "scope": "variant", "value_type": "number"},
            identity=attribute.pk,
        )
    assert AuditLog.objects.filter(seller_id=None, target_id=attribute.pk).exists()
    assert (
        setup.browser.post(
            "/api/v1/admin/catalog/brands", {"name": "Bad", "slug": "bad"}, format="json"
        ).status_code
        == 403
    )


@pytest.mark.parametrize(
    "query", ["?unknown=1", "?page=0", "?page=10001", "?page=1&page=2", "?status=invalid"]
)
def test_bounded_allowlisted_filters(setup: Setup, query: str) -> None:
    assert (
        setup.browser.get(
            "/api/v1/seller/products" + query, HTTP_X_SELLER_ID=str(setup.seller.pk)
        ).status_code
        == 400
    )


def test_unsafe_operations_require_csrf(setup: Setup) -> None:
    setup.browser.credentials()
    assert (
        setup.browser.post(
            root(setup) + "/archive", {}, format="json", HTTP_X_SELLER_ID=str(setup.seller.pk)
        ).status_code
        == 403
    )
    anonymous = APIClient(enforce_csrf_checks=True)
    assert anonymous.post("/api/v1/admin/catalog/categories", {}, format="json").status_code == 403


def test_database_rejects_foreign_children_and_reassignment(setup: Setup) -> None:
    with pytest.raises(IntegrityError), transaction.atomic():
        ProductVariant.objects.create(
            seller=setup.foreign, product=setup.product, sku="attack", price="1.00"
        )
    with pytest.raises(IntegrityError), transaction.atomic():
        ProductVariant.objects.filter(pk=setup.variant.pk).update(product=setup.foreign_product)
    with pytest.raises(IntegrityError), transaction.atomic():
        Product.objects.filter(pk=setup.product.pk).update(seller=setup.foreign)
    with pytest.raises(IntegrityError), transaction.atomic():
        ProductVariant.objects.create(
            seller=setup.seller, product=setup.product, sku="ShIrT", price="1.00"
        )
    with pytest.raises(IntegrityError), transaction.atomic():
        ProductVariant.objects.filter(pk=setup.variant.pk).update(price="-1.00")
    with pytest.raises(DatabaseError), transaction.atomic():
        ProductStatusHistory.objects.filter(product=setup.product).update(reason="Changed")


def test_database_attribute_scope_identity_and_category_guards(setup: Setup) -> None:
    attribute = Attribute.objects.create(
        name="Size", code="size", scope="variant", value_type="text"
    )
    CategoryAttribute.objects.create(category=setup.category, attribute=attribute)
    with pytest.raises(IntegrityError), transaction.atomic():
        ProductAttributeValue.objects.create(
            seller=setup.seller, product=setup.product, attribute=attribute, value="Bad"
        )
    value = VariantAttributeValue.objects.create(
        seller=setup.seller, variant=setup.variant, attribute=attribute, value="Medium"
    )
    with pytest.raises(IntegrityError), transaction.atomic():
        VariantAttributeValue.objects.filter(pk=value.pk).update(variant=setup.foreign_variant)
    with pytest.raises(IntegrityError), transaction.atomic():
        Attribute.objects.filter(pk=attribute.pk).update(value_type="number")
    category = Category.objects.create(name="Other", slug="other")
    with pytest.raises(IntegrityError), transaction.atomic():
        Product.objects.filter(pk=setup.product.pk).update(category=category)
    with pytest.raises(IntegrityError), transaction.atomic():
        Category.objects.filter(pk=setup.category.pk).update(parent=setup.category)


def test_audit_failure_rolls_back_product_changes(setup: Setup) -> None:
    with (
        patch("apps.catalog.services.record", side_effect=RuntimeError("Audit unavailable")),
        pytest.raises(RuntimeError),
    ):
        services.seller_action(setup.owner, setup.seller.pk, setup.product.pk, "archive")
    setup.product.refresh_from_db()
    assert setup.product.status == "draft" and setup.product.status_history.count() == 1


def test_image_upload_download_is_private_scoped_and_removed(setup: Setup) -> None:
    response = setup.browser.post(
        root(setup) + "/images/upload",
        {"file": png(), "alt_text": "Shirt"},
        format="multipart",
        HTTP_X_SELLER_ID=str(setup.seller.pk),
    )
    assert response.status_code == 201, response.data
    assert "storage_key" not in response.data and "url" not in response.data
    image = ProductImage.objects.get(pk=response.data["id"])
    assert "original-name" not in image.storage_key
    download = setup.browser.get(
        root(setup) + f"/images/{image.pk}/download", HTTP_X_SELLER_ID=str(setup.seller.pk)
    )
    assert download.status_code == 200 and download["Cache-Control"] == "no-store"
    assert download["Content-Type"] == "application/octet-stream"
    assert "attachment" in download["Content-Disposition"]
    assert b"".join(
        cast(Iterable[bytes], cast(StreamingHttpResponse, download).streaming_content)
    ).startswith(b"\x89PNG")
    assert (
        setup.browser.get(
            root(setup, foreign=True) + f"/images/{image.pk}/download",
            HTTP_X_SELLER_ID=str(setup.seller.pk),
        ).status_code
        == 404
    )
    with pytest.raises(IntegrityError), transaction.atomic():
        ProductImage.objects.filter(pk=image.pk).update(storage_key="replacement.png")
    assert (
        setup.browser.delete(
            root(setup) + f"/images/{image.pk}",
            {},
            format="json",
            HTTP_X_SELLER_ID=str(setup.seller.pk),
        ).status_code
        == 204
    )
    assert (
        setup.browser.get(
            root(setup) + f"/images/{image.pk}/download", HTTP_X_SELLER_ID=str(setup.seller.pk)
        ).status_code
        == 404
    )
    assert storages["catalog"].exists(image.storage_key)


@pytest.mark.parametrize(
    "file",
    [
        SimpleUploadedFile("attack.svg", b"<svg></svg>", content_type="image/svg+xml"),
        SimpleUploadedFile("bad.png", b"not-an-image", content_type="image/png"),
        SimpleUploadedFile("big.png", b"x" * (5 * 1024 * 1024 + 1), content_type="image/png"),
    ],
)
def test_image_upload_validation(setup: Setup, file: SimpleUploadedFile) -> None:
    assert (
        setup.browser.post(
            root(setup) + "/images/upload",
            {"file": file},
            format="multipart",
            HTTP_X_SELLER_ID=str(setup.seller.pk),
        ).status_code
        == 400
    )
    assert not ProductImage.objects.exists()


def test_upload_compensates_audit_failure(setup: Setup) -> None:
    storage = storages["catalog"]
    with patch.object(storage, "delete", wraps=storage.delete) as cleanup:
        with (
            patch("apps.catalog.services.record", side_effect=RuntimeError("Audit unavailable")),
            pytest.raises(RuntimeError),
        ):
            services.upload_image(
                setup.owner,
                setup.seller.pk,
                setup.product.pk,
                image=validate_document(png()),
                alt_text="",
                sort_order=0,
            )
        cleanup.assert_called_once()
        assert not storage.exists(cleanup.call_args.args[0])
    assert not ProductImage.objects.exists()


@pytest.mark.django_db(transaction=True, serialized_rollback=True)
def test_concurrent_moderation_commits_one_transition(setup: Setup) -> None:
    services.seller_action(setup.owner, setup.seller.pk, setup.product.pk, "submit-for-review")
    gate = Barrier(2)

    def approve() -> str:
        close_old_connections()
        try:
            gate.wait(timeout=10)
            services.moderate_product(
                User.objects.get(pk=setup.admin.pk), setup.product.pk, approve=True
            )
            return "approved"
        except ValidationError:
            return "invalid-state"
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: approve(), range(2)))
    assert sorted(results) == ["approved", "invalid-state"]
    assert setup.product.status_history.filter(to_status="active").count() == 1
