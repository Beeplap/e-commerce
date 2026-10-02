from decimal import Decimal, InvalidOperation
from typing import Any
from uuid import UUID, uuid4

from django.contrib.auth.models import AnonymousUser
from django.core.files.base import ContentFile
from django.core.files.storage import storages
from django.db import IntegrityError, connection, models, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.text import slugify
from rest_framework.exceptions import ValidationError

from apps.accounts.models import User
from apps.audit.models import AuditLog
from apps.catalog import serializers as schemas
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
from apps.catalog.selectors import TAXONOMY_MODELS
from apps.sellers.lifecycle_services import (
    lock_platform,
    lock_seller_access,
    prevent_self_review,
    record,
)
from apps.sellers.models import Seller
from apps.sellers.uploads import ValidatedDocument

TAXONOMY_INPUTS = {
    "categories": schemas.CategoryInput,
    "brands": schemas.BrandInput,
    "attributes": schemas.AttributeInput,
    "options": schemas.OptionInput,
    "category-attributes": schemas.CategoryAttributeInput,
}


def lock_taxonomy() -> None:
    # One transaction-scoped namespace for category cycles and configuration/product consistency.
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_advisory_xact_lock(51005)")


def global_audit(actor: User, obj: models.Model, action: str, fields: list[str]) -> None:
    AuditLog.objects.create(
        actor_id=actor.pk,
        seller_id=None,
        target_type=obj._meta.label_lower,
        target_id=obj.pk,
        action=action,
        changes={"changed_fields": sorted(fields)},
    )


@transaction.atomic
def save_taxonomy(
    actor: User | AnonymousUser, kind: str, data: Any, *, identity: UUID | None = None
) -> models.Model:
    actor = lock_platform(actor, "platform.catalog.manage")
    lock_taxonomy()
    serializer = TAXONOMY_INPUTS[kind](data=data)
    serializer.is_valid(raise_exception=True)
    values = dict(serializer.validated_data)
    model = TAXONOMY_MODELS[kind]
    obj: models.Model | None = (
        get_object_or_404(model._default_manager.select_for_update(), pk=identity)
        if identity
        else None
    )
    if model._default_manager.count() >= 10000 and obj is None:
        raise ValidationError("Catalog configuration limit reached.")
    if kind == "categories":
        values["slug"] = values["slug"].lower()
        parent_id = values["parent_id"]
        visited = {identity} if identity else set()
        depth = 0
        while parent_id is not None:
            if parent_id in visited:
                raise ValidationError({"parent_id": "Category hierarchy cannot contain a cycle."})
            visited.add(parent_id)
            parent = get_object_or_404(Category, pk=parent_id)
            parent_id = parent.parent_id
            depth += 1
            if depth >= 16:
                raise ValidationError({"parent_id": "Category hierarchy is limited to 16 levels."})
    elif kind == "brands":
        values["slug"] = values["slug"].lower()
    elif kind == "attributes" and obj is not None:
        for field in ("code", "scope", "value_type"):
            if getattr(obj, field) != values[field]:
                raise ValidationError(
                    {field: "Attribute identity and type cannot change. Create a new attribute."}
                )
    elif kind == "options":
        values["label"] = values.pop("name")
        if obj is not None:
            assert isinstance(obj, AttributeOption)
        attribute = get_object_or_404(Attribute, pk=values["attribute_id"])
        if attribute.value_type != "choice":
            raise ValidationError("Options belong only to choice attributes.")
        if obj is not None and (obj.attribute_id != attribute.pk or obj.value != values["value"]):
            raise ValidationError("Option identity cannot change.")
        if obj is None and attribute.options.count() >= 100:
            raise ValidationError("An attribute is limited to 100 options.")
    elif kind == "category-attributes":
        if obj is not None:
            assert isinstance(obj, CategoryAttribute)
        category = get_object_or_404(Category, pk=values["category_id"])
        get_object_or_404(Attribute, pk=values["attribute_id"])
        if obj is not None and (
            obj.category_id != category.pk or obj.attribute_id != values["attribute_id"]
        ):
            raise ValidationError("Category/attribute identity cannot change.")
        if obj is None and category.attribute_links.count() >= 30:
            raise ValidationError("A category is limited to 30 attributes.")
    try:
        with transaction.atomic():
            if obj is None:
                obj = model._default_manager.create(**values)
            else:
                for field, value in values.items():
                    setattr(obj, field, value)
                obj.save()
    except IntegrityError as error:
        raise ValidationError(
            "This catalog identifier or link already exists or is invalid."
        ) from error
    global_audit(actor, obj, f"catalog.{kind}.saved", list(values))
    return obj


def locked_product(
    actor: User | AnonymousUser, seller_id: UUID, product_id: UUID, capability: str
) -> tuple[User, Product]:
    access = lock_seller_access(actor, seller_id, capability, allow_pending=False)
    lock_taxonomy()
    product = get_object_or_404(
        Product.objects.select_for_update().filter(seller=access.seller), pk=product_id
    )
    return access.membership.user, product


def require_draft(product: Product) -> None:
    if product.status != Product.Status.DRAFT:
        raise ValidationError("Revise this product to a draft before editing its content.")


def available_category(category_id: UUID) -> Category:
    category = get_object_or_404(Category.objects.filter(is_active=True), pk=category_id)
    parent_id = category.parent_id
    while parent_id is not None:
        parent = get_object_or_404(Category.objects.filter(is_active=True), pk=parent_id)
        parent_id = parent.parent_id
    return category


def catalog_references(values: dict[str, Any]) -> None:
    available_category(values["category_id"])
    if values.get("brand_id"):
        get_object_or_404(Brand.objects.filter(is_active=True), pk=values["brand_id"])


@transaction.atomic
def create_product(actor: User | AnonymousUser, seller_id: UUID, data: Any) -> Product:
    access = lock_seller_access(actor, seller_id, "catalog.product.create", allow_pending=False)
    lock_taxonomy()
    serializer = schemas.ProductInput(data=data)
    serializer.is_valid(raise_exception=True)
    values = serializer.validated_data
    catalog_references(values)
    identity = uuid4()
    product = Product.objects.create(
        id=identity,
        seller=access.seller,
        created_by=access.membership.user,
        slug=f"{slugify(values['name'])[:90] or 'product'}-{identity.hex}",
        **values,
    )
    ProductStatusHistory.objects.create(
        seller=access.seller,
        product=product,
        actor_id=access.membership.user_id,
        from_status="",
        to_status="draft",
    )
    record(
        access.membership.user,
        access.seller,
        "catalog.product.created",
        target_type="product",
        target_id=product.pk,
        changes={"status": {"before": None, "after": "draft"}},
    )
    return product


@transaction.atomic
def update_product(
    actor: User | AnonymousUser, seller_id: UUID, product_id: UUID, data: Any
) -> Product:
    actor, product = locked_product(actor, seller_id, product_id, "catalog.product.update")
    require_draft(product)
    serializer = schemas.ProductInput(data=data)
    serializer.is_valid(raise_exception=True)
    values = serializer.validated_data
    catalog_references(values)
    if values["category_id"] != product.category_id and (
        product.attribute_values.exists()
        or VariantAttributeValue.objects.filter(variant__product=product).exists()
    ):
        raise ValidationError(
            "Remove product and variant attribute values before changing category."
        )
    for field, value in values.items():
        setattr(product, field, value)
    product.save(
        update_fields=[
            "category",
            "brand",
            "name",
            "description",
            "short_description",
            "updated_at",
        ]
    )
    record(
        actor,
        product.seller,
        "catalog.product.updated",
        target_type="product",
        target_id=product.pk,
        changes={"changed_fields": sorted(values)},
    )
    return product


@transaction.atomic
def save_variant(
    actor: User | AnonymousUser,
    seller_id: UUID,
    product_id: UUID,
    data: Any,
    *,
    variant_id: UUID | None = None,
) -> ProductVariant:
    actor, product = locked_product(actor, seller_id, product_id, "catalog.product.update")
    require_draft(product)
    serializer = schemas.VariantInput(data=data)
    serializer.is_valid(raise_exception=True)
    values = serializer.validated_data
    values["sku"] = values["sku"].upper()
    variant = (
        get_object_or_404(
            ProductVariant.objects.filter(seller_id=seller_id, product=product), pk=variant_id
        )
        if variant_id
        else None
    )
    if variant is None and product.variants.count() >= 100:
        raise ValidationError("A product is limited to 100 variants.")
    duplicates = ProductVariant.objects.filter(seller_id=seller_id, sku__iexact=values["sku"])
    if variant_id is not None:
        duplicates = duplicates.exclude(pk=variant_id)
    if duplicates.exists():
        raise ValidationError(
            {"sku": "SKU already exists within this seller, including inactive variants."}
        )
    if variant is None:
        variant = ProductVariant.objects.create(seller=product.seller, product=product, **values)
    else:
        for field, value in values.items():
            setattr(variant, field, value)
        variant.save()
    record(
        actor,
        product.seller,
        "catalog.variant.saved",
        target_type="product_variant",
        target_id=variant.pk,
        changes={"changed_fields": sorted(values)},
    )
    return variant


def attribute_value(
    product: Product, data: Any, scope: str
) -> tuple[Attribute, AttributeOption | None, str]:
    serializer = schemas.AttributeValueInput(data=data)
    serializer.is_valid(raise_exception=True)
    values = serializer.validated_data
    link = get_object_or_404(
        CategoryAttribute.objects.select_related("attribute").filter(
            category_id=product.category_id, attribute__is_active=True, attribute__scope=scope
        ),
        attribute_id=values["attribute_id"],
    )
    attribute = link.attribute
    option = None
    value = values["value"]
    if attribute.value_type == "choice":
        if value:
            raise ValidationError({"value": "Choice attributes accept only option_id."})
        option = get_object_or_404(
            AttributeOption.objects.filter(attribute=attribute, is_active=True),
            pk=values["option_id"],
        )
    else:
        if values["option_id"] is not None or not value:
            raise ValidationError("Non-choice attributes require a value and no option_id.")
        if attribute.value_type == "boolean" and value not in ("true", "false"):
            raise ValidationError({"value": "Use true or false."})
        if attribute.value_type == "number":
            try:
                number = Decimal(value)
                exponent = number.as_tuple().exponent
                if (
                    not number.is_finite()
                    or len(number.as_tuple().digits) > 18
                    or not isinstance(exponent, int)
                    or exponent < -6
                ):
                    raise InvalidOperation
                value = format(number, "f")
                if len(value) > 100:
                    raise InvalidOperation
            except (InvalidOperation, ValueError, TypeError) as error:
                raise ValidationError(
                    {"value": "Use a finite decimal with at most 18 digits and six decimal places."}
                ) from error
    return attribute, option, value


@transaction.atomic
def save_attribute_value(
    actor: User | AnonymousUser,
    seller_id: UUID,
    product_id: UUID,
    data: Any,
    *,
    variant_id: UUID | None = None,
) -> ProductAttributeValue | VariantAttributeValue:
    actor, product = locked_product(actor, seller_id, product_id, "catalog.product.update")
    require_draft(product)
    attribute, option, value = attribute_value(
        product, data, "variant" if variant_id else "product"
    )
    result: ProductAttributeValue | VariantAttributeValue
    if variant_id:
        variant = get_object_or_404(
            ProductVariant.objects.filter(product=product, seller_id=seller_id), pk=variant_id
        )
        result, _ = VariantAttributeValue.objects.update_or_create(
            variant=variant,
            attribute=attribute,
            defaults={"seller": product.seller, "option": option, "value": value},
        )
    else:
        result, _ = ProductAttributeValue.objects.update_or_create(
            product=product,
            attribute=attribute,
            defaults={"seller": product.seller, "option": option, "value": value},
        )
    record(
        actor,
        product.seller,
        "catalog.attribute.saved",
        target_type="attribute_value",
        target_id=result.pk,
        changes={"changed_fields": ["value"]},
    )
    return result


@transaction.atomic
def remove_attribute_value(
    actor: User | AnonymousUser,
    seller_id: UUID,
    product_id: UUID,
    value_id: UUID,
    *,
    variant_id: UUID | None = None,
) -> None:
    actor, product = locked_product(actor, seller_id, product_id, "catalog.product.update")
    require_draft(product)
    obj: ProductAttributeValue | VariantAttributeValue
    if variant_id:
        variant = get_object_or_404(
            ProductVariant.objects.filter(product=product, seller_id=seller_id), pk=variant_id
        )
        obj = get_object_or_404(
            VariantAttributeValue.objects.filter(variant=variant, seller_id=seller_id), pk=value_id
        )
    else:
        obj = get_object_or_404(
            ProductAttributeValue.objects.filter(product=product, seller_id=seller_id), pk=value_id
        )
    identity = obj.pk
    obj.delete()
    record(
        actor,
        product.seller,
        "catalog.attribute.removed",
        target_type="attribute_value",
        target_id=identity,
    )


def validate_submission(product: Product) -> None:
    available_category(product.category_id)
    if product.brand_id:
        get_object_or_404(Brand.objects.filter(is_active=True), pk=product.brand_id)
    variants = list(
        product.variants.filter(status="active").prefetch_related(
            "attribute_values__attribute", "attribute_values__option"
        )
    )
    if not variants:
        raise ValidationError("At least one active variant is required.")
    links = list(
        product.category.attribute_links.filter(attribute__is_active=True).select_related(
            "attribute"
        )
    )
    product_values = list(product.attribute_values.select_related("attribute", "option"))
    scopes = [("product", product_values)] + [
        ("variant", list(variant.attribute_values.all())) for variant in variants
    ]
    for scope, values in scopes:
        required = {
            link.attribute_id
            for link in links
            if link.is_required and link.attribute.scope == scope
        }
        if not required.issubset({value.attribute_id for value in values}):
            raise ValidationError(f"Complete all required {scope} attributes.")
        for value in values:
            attribute_value(
                product,
                {
                    "attribute_id": value.attribute_id,
                    "option_id": value.option_id,
                    "value": value.value,
                },
                scope,
            )


def change_status(actor: User, product: Product, after: str, reason: str = "") -> None:
    before = product.status
    product.status = after
    if after == "active":
        product.approved_by = actor
        product.approved_at = timezone.now()
    elif after == "draft":
        product.approved_by = None
        product.approved_at = None
    product.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])
    ProductStatusHistory.objects.create(
        seller=product.seller,
        product=product,
        actor_id=actor.pk,
        from_status=before,
        to_status=after,
        reason=reason,
    )
    record(
        actor,
        product.seller,
        "catalog.product.transition",
        target_type="product",
        target_id=product.pk,
        changes={"status": {"before": before, "after": after}},
    )


@transaction.atomic
def seller_action(
    actor: User | AnonymousUser, seller_id: UUID, product_id: UUID, action: str
) -> Product:
    actor, product = locked_product(
        actor,
        seller_id,
        product_id,
        "catalog.product.archive" if action == "archive" else "catalog.product.update",
    )
    legal = {
        "submit-for-review": ({"draft"}, "pending_review"),
        "revise": ({"active", "rejected", "pending_review"}, "draft"),
        "archive": ({"draft", "pending_review", "active", "rejected"}, "archived"),
    }
    if action not in legal:
        raise ValueError("Unknown product action.")
    before, after = legal[action]
    if product.status not in before:
        raise ValidationError("This product action is not valid in the current state.")
    if action == "submit-for-review":
        validate_submission(product)
    change_status(actor, product, after)
    return product


@transaction.atomic
def moderate_product(
    actor: User | AnonymousUser, product_id: UUID, *, approve: bool, reason: str = ""
) -> Product:
    actor = lock_platform(actor, "platform.products.moderate")
    # The admin endpoint has explicit platform scope. Resolve ownership before locking Seller.
    initial = get_object_or_404(Product, pk=product_id)
    seller = Seller.objects.select_for_update().get(pk=initial.seller_id)
    lock_taxonomy()
    product = Product.objects.select_for_update().get(pk=initial.pk)
    prevent_self_review(actor, seller)
    if seller.status != "active" or product.status != "pending_review":
        raise ValidationError("Only pending products of active sellers may be moderated.")
    if not approve:
        if not reason.strip() or len(reason.strip()) > 500:
            raise ValidationError(
                {"reason": "A rejection reason of at most 500 characters is required."}
            )
    else:
        validate_submission(product)
    change_status(actor, product, "active" if approve else "rejected", reason.strip())
    return product


def upload_image(
    actor: User | AnonymousUser,
    seller_id: UUID,
    product_id: UUID,
    *,
    image: ValidatedDocument,
    alt_text: str,
    sort_order: int,
) -> ProductImage:
    stored: str | None = None
    storage = storages["catalog"]
    try:
        with transaction.atomic(durable=True):
            actor, product = locked_product(actor, seller_id, product_id, "catalog.product.update")
            require_draft(product)
            if product.images.count() >= 50 or product.images.filter(is_active=True).count() >= 10:
                raise ValidationError(
                    "A product is limited to ten current images and 50 retained submissions."
                )
            identity = uuid4()
            stored = storage.save(
                f"{seller_id}/{product.pk}/{identity}.{image.extension}", ContentFile(image.content)
            )
            result = ProductImage.objects.create(
                id=identity,
                seller=product.seller,
                product=product,
                storage_key=stored,
                content_type=image.content_type,
                size=len(image.content),
                alt_text=alt_text,
                sort_order=sort_order,
            )
            record(
                actor,
                product.seller,
                "catalog.image.submitted",
                target_type="product_image",
                target_id=result.pk,
            )
        return result
    except Exception:
        if stored is not None:
            storage.delete(stored)
        raise


@transaction.atomic
def remove_image(
    actor: User | AnonymousUser, seller_id: UUID, product_id: UUID, image_id: UUID
) -> None:
    actor, product = locked_product(actor, seller_id, product_id, "catalog.product.update")
    require_draft(product)
    image = get_object_or_404(
        ProductImage.objects.filter(seller_id=seller_id, product=product, is_active=True),
        pk=image_id,
    )
    image.is_active = False
    image.save(update_fields=["is_active"])
    record(
        actor,
        product.seller,
        "catalog.image.removed",
        target_type="product_image",
        target_id=image.pk,
    )
