import uuid

from django.conf import settings
from django.db import models
from django.db.models.functions import Lower

from apps.sellers.models import Seller


class Entity(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class Category(Entity):
    parent = models.ForeignKey(
        "self", on_delete=models.PROTECT, null=True, blank=True, related_name="children"
    )
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=140, unique=True)
    description = models.TextField(max_length=2000, blank=True)
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["sort_order", "name", "id"]
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(parent_id=models.F("id")), name="category_not_own_parent"
            )
        ]


class Brand(Entity):
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=140, unique=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name", "id"]


class Attribute(Entity):
    class ValueType(models.TextChoices):
        TEXT = "text"
        NUMBER = "number"
        CHOICE = "choice"
        BOOLEAN = "boolean"

    class Scope(models.TextChoices):
        PRODUCT = "product"
        VARIANT = "variant"

    name = models.CharField(max_length=120)
    code = models.SlugField(max_length=80, unique=True)
    value_type = models.CharField(max_length=10, choices=ValueType.choices)
    scope = models.CharField(max_length=10, choices=Scope.choices)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name", "id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(
                    value_type__in=["text", "number", "choice", "boolean"],
                    scope__in=["product", "variant"],
                ),
                name="attribute_type_scope_valid",
            )
        ]


class AttributeOption(Entity):
    attribute = models.ForeignKey(Attribute, on_delete=models.PROTECT, related_name="options")
    label = models.CharField(max_length=120)
    value = models.SlugField(max_length=80)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["label", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["attribute", "value"], name="attribute_option_value_unique"
            )
        ]


class CategoryAttribute(Entity):
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="attribute_links")
    attribute = models.ForeignKey(
        Attribute, on_delete=models.PROTECT, related_name="category_links"
    )
    is_required = models.BooleanField(default=False)

    class Meta:
        ordering = ["attribute__name", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["category", "attribute"], name="category_attribute_unique"
            )
        ]


class Product(Entity):
    class Status(models.TextChoices):
        DRAFT = "draft"
        PENDING_REVIEW = "pending_review"
        ACTIVE = "active"
        REJECTED = "rejected"
        ARCHIVED = "archived"

    seller = models.ForeignKey(Seller, on_delete=models.PROTECT, related_name="products")
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="products")
    brand = models.ForeignKey(
        Brand, on_delete=models.PROTECT, null=True, blank=True, related_name="products"
    )
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=140)
    description = models.TextField(max_length=10000, blank=True)
    short_description = models.CharField(max_length=500, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_products"
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="approved_products",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "id"]
        indexes = [models.Index(fields=["seller", "status", "-created_at"])]
        constraints = [
            models.UniqueConstraint(fields=["seller", "slug"], name="product_seller_slug_unique"),
            models.CheckConstraint(
                condition=models.Q(
                    status__in=["draft", "pending_review", "active", "rejected", "archived"]
                ),
                name="product_status_valid",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(approved_by__isnull=True, approved_at__isnull=True)
                    | models.Q(approved_by__isnull=False, approved_at__isnull=False)
                ),
                name="product_approval_pair",
            ),
        ]


class ProductVariant(Entity):
    class Status(models.TextChoices):
        ACTIVE = "active"
        INACTIVE = "inactive"

    seller = models.ForeignKey(Seller, on_delete=models.PROTECT)
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="variants")
    sku = models.CharField(max_length=80)
    barcode = models.CharField(max_length=80, blank=True)
    price = models.DecimalField(max_digits=14, decimal_places=2)
    compare_at_price = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    cost_price = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    weight = models.DecimalField(max_digits=12, decimal_places=3, null=True, blank=True)
    length = models.DecimalField(max_digits=12, decimal_places=3, null=True, blank=True)
    width = models.DecimalField(max_digits=12, decimal_places=3, null=True, blank=True)
    height = models.DecimalField(max_digits=12, decimal_places=3, null=True, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)

    class Meta:
        ordering = ["sku", "id"]
        constraints = [
            models.UniqueConstraint(Lower("sku"), "seller", name="variant_seller_sku_unique"),
            models.CheckConstraint(
                condition=models.Q(price__gte=0)
                & (
                    models.Q(compare_at_price__isnull=True)
                    | models.Q(compare_at_price__gte=models.F("price"))
                )
                & (models.Q(cost_price__isnull=True) | models.Q(cost_price__gte=0)),
                name="variant_money_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(status__in=["active", "inactive"]), name="variant_status_valid"
            ),
            *[
                models.CheckConstraint(
                    condition=models.Q(**{f"{field}__isnull": True})
                    | models.Q(**{f"{field}__gte": 0}),
                    name=f"variant_{field}_nonnegative",
                )
                for field in ["weight", "length", "width", "height"]
            ],
        ]


class ProductImage(Entity):
    seller = models.ForeignKey(Seller, on_delete=models.PROTECT)
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="images")
    storage_key = models.CharField(max_length=200, unique=True)
    content_type = models.CharField(max_length=32)
    size = models.PositiveIntegerField()
    alt_text = models.CharField(max_length=200, blank=True)
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(
                    content_type__in=["image/png", "image/jpeg"],
                    size__gt=0,
                    size__lte=5 * 1024 * 1024,
                ),
                name="product_image_file_valid",
            )
        ]


class AttributeValue(Entity):
    seller = models.ForeignKey(Seller, on_delete=models.PROTECT)
    attribute = models.ForeignKey(Attribute, on_delete=models.PROTECT)
    option = models.ForeignKey(AttributeOption, on_delete=models.PROTECT, null=True, blank=True)
    value = models.CharField(max_length=500, blank=True)

    class Meta:
        abstract = True


class ProductAttributeValue(AttributeValue):
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="attribute_values")

    class Meta:
        ordering = ["attribute__name", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["product", "attribute"], name="product_attribute_unique"
            )
        ]


class VariantAttributeValue(AttributeValue):
    variant = models.ForeignKey(
        ProductVariant, on_delete=models.PROTECT, related_name="attribute_values"
    )

    class Meta:
        ordering = ["attribute__name", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["variant", "attribute"], name="variant_attribute_unique"
            )
        ]


class ProductStatusHistory(Entity):
    seller = models.ForeignKey(Seller, on_delete=models.PROTECT)
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="status_history")
    actor_id = models.UUIDField()
    from_status = models.CharField(max_length=20, blank=True)
    to_status = models.CharField(max_length=20, choices=Product.Status.choices)
    reason = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
