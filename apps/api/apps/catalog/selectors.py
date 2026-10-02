from typing import Any
from uuid import UUID

from django.contrib.auth.models import AnonymousUser
from django.db import models
from django.db.models import Q
from django.shortcuts import get_object_or_404

from apps.accounts.models import User
from apps.catalog.models import (
    Attribute,
    AttributeOption,
    Brand,
    Category,
    CategoryAttribute,
    Product,
    ProductAttributeValue,
    ProductImage,
    ProductStatusHistory,
    ProductVariant,
    VariantAttributeValue,
)
from apps.sellers.lifecycle_selectors import require_platform
from apps.sellers.selectors import require_seller_access, tenant_queryset

TAXONOMY_MODELS: dict[str, type[models.Model]] = {
    "categories": Category,
    "brands": Brand,
    "attributes": Attribute,
    "options": AttributeOption,
    "category-attributes": CategoryAttribute,
}


def taxonomy(
    actor: User | AnonymousUser,
    kind: str,
    filters: dict[str, Any],
    *,
    seller_id: UUID | None = None,
) -> models.QuerySet[Any]:
    if seller_id is None:
        require_platform(actor, "platform.catalog.read")
    else:
        require_seller_access(actor, seller_id, "catalog.product.read")
    query: models.QuerySet[Any] = TAXONOMY_MODELS[kind]._default_manager.all()
    if kind == "category-attributes":
        query = query.select_related("attribute")
        if seller_id is not None:
            query = query.filter(category__is_active=True, attribute__is_active=True)
    elif seller_id is not None:
        query = query.filter(is_active=True)
    if kind == "options" and seller_id is not None:
        query = query.filter(attribute__is_active=True)
    if "category_id" in filters:
        if kind == "category-attributes":
            query = query.filter(category_id=filters["category_id"])
        elif kind == "attributes":
            query = query.filter(category_links__category_id=filters["category_id"])
    if "attribute_id" in filters and kind == "options":
        query = query.filter(attribute_id=filters["attribute_id"])
    if search := filters.get("search"):
        if kind in ("categories", "brands", "attributes"):
            query = query.filter(name__icontains=search)
        elif kind == "options":
            query = query.filter(label__icontains=search)
    return query


def products(
    actor: User | AnonymousUser, filters: dict[str, Any], *, seller_id: UUID | None = None
) -> models.QuerySet[Product]:
    if seller_id is None:
        require_platform(actor, "platform.products.read")
        query = Product.objects.all()
    else:
        query = tenant_queryset(
            user=actor, seller_id=seller_id, capability="catalog.product.read", model=Product
        )
    if search := filters.get("search"):
        query = query.filter(Q(name__icontains=search) | Q(slug__icontains=search))
    for field in ("status", "category_id"):
        if value := filters.get(field):
            query = query.filter(**{field: value})
    return query.select_related("seller", "category", "brand")


def product(
    actor: User | AnonymousUser, product_id: UUID, *, seller_id: UUID | None = None
) -> Product:
    return get_object_or_404(products(actor, {}, seller_id=seller_id), pk=product_id)


def child_rows(
    actor: User | AnonymousUser,
    product_id: UUID,
    kind: str,
    *,
    seller_id: UUID | None = None,
    variant_id: UUID | None = None,
) -> models.QuerySet[Any]:
    parent = product(actor, product_id, seller_id=seller_id)
    model: type[models.Model] = {
        "variants": ProductVariant,
        "images": ProductImage,
        "attributes": ProductAttributeValue,
        "history": ProductStatusHistory,
        "variant-attributes": VariantAttributeValue,
    }[kind]
    if seller_id is not None:
        query = tenant_queryset(
            user=actor, seller_id=seller_id, capability="catalog.product.read", model=model
        )
    else:
        query = model._default_manager.filter(seller_id=parent.seller_id)
    if kind == "variant-attributes":
        variant = get_object_or_404(
            ProductVariant.objects.filter(seller_id=parent.seller_id, product=parent), pk=variant_id
        )
        query = query.filter(variant=variant)
    else:
        query = query.filter(product=parent)
    if kind in ("attributes", "variant-attributes"):
        query = query.select_related("attribute", "option")
    if kind == "images":
        query = query.filter(is_active=True)
    return query
