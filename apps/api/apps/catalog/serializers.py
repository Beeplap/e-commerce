from decimal import Decimal
from typing import Any

from rest_framework import serializers

from apps.accounts.serializers import StrictSerializer
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
from apps.sellers.lifecycle_serializers import PageSerializer


class CategoryInput(StrictSerializer):
    name = serializers.CharField(max_length=120)
    slug = serializers.SlugField(max_length=140)
    description = serializers.CharField(max_length=2000, allow_blank=True, default="")
    parent_id = serializers.UUIDField(allow_null=True, default=None)
    sort_order = serializers.IntegerField(min_value=0, max_value=100000, default=0)
    is_active = serializers.BooleanField(default=True)


class BrandInput(StrictSerializer):
    name = serializers.CharField(max_length=120)
    slug = serializers.SlugField(max_length=140)
    is_active = serializers.BooleanField(default=True)


class AttributeInput(StrictSerializer):
    name = serializers.CharField(max_length=120)
    code = serializers.SlugField(max_length=80)
    value_type = serializers.ChoiceField(choices=Attribute.ValueType.choices)
    scope = serializers.ChoiceField(choices=Attribute.Scope.choices)
    is_active = serializers.BooleanField(default=True)


class OptionInput(StrictSerializer):
    attribute_id = serializers.UUIDField()
    name = serializers.CharField(max_length=120)
    value = serializers.SlugField(max_length=80)
    is_active = serializers.BooleanField(default=True)


class CategoryAttributeInput(StrictSerializer):
    category_id = serializers.UUIDField()
    attribute_id = serializers.UUIDField()
    is_required = serializers.BooleanField(default=False)


class CategoryOutput(serializers.ModelSerializer[Category]):
    class Meta:
        model = Category
        fields = ["id", "parent_id", "name", "slug", "description", "sort_order", "is_active"]


class BrandOutput(serializers.ModelSerializer[Brand]):
    class Meta:
        model = Brand
        fields = ["id", "name", "slug", "is_active"]


class AttributeOutput(serializers.ModelSerializer[Attribute]):
    class Meta:
        model = Attribute
        fields = ["id", "name", "code", "value_type", "scope", "is_active"]


class OptionOutput(serializers.ModelSerializer[AttributeOption]):
    name = serializers.CharField(source="label", read_only=True)

    class Meta:
        model = AttributeOption
        fields = ["id", "attribute_id", "name", "value", "is_active"]


class CategoryAttributeOutput(serializers.ModelSerializer[CategoryAttribute]):
    attribute = AttributeOutput(read_only=True)

    class Meta:
        model = CategoryAttribute
        fields = ["id", "category_id", "attribute", "is_required"]


class ProductInput(StrictSerializer):
    category_id = serializers.UUIDField()
    brand_id = serializers.UUIDField(allow_null=True, default=None)
    name = serializers.CharField(max_length=200)
    description = serializers.CharField(max_length=10000, allow_blank=True, default="")
    short_description = serializers.CharField(max_length=500, allow_blank=True, default="")


class MoneyField(serializers.DecimalField):
    def to_internal_value(self, data: Any) -> Decimal:
        if not isinstance(data, str):
            raise serializers.ValidationError("Send money as a decimal string.")
        return super().to_internal_value(data)


class VariantInput(StrictSerializer):
    sku = serializers.CharField(max_length=80)
    barcode = serializers.CharField(max_length=80, allow_blank=True, default="")
    price = MoneyField(max_digits=14, decimal_places=2, min_value=Decimal("0"))
    compare_at_price = MoneyField(
        max_digits=14, decimal_places=2, min_value=Decimal("0"), allow_null=True, default=None
    )
    cost_price = MoneyField(
        max_digits=14, decimal_places=2, min_value=Decimal("0"), allow_null=True, default=None
    )
    weight = serializers.DecimalField(
        max_digits=12, decimal_places=3, min_value=Decimal("0"), allow_null=True, default=None
    )
    length = serializers.DecimalField(
        max_digits=12, decimal_places=3, min_value=Decimal("0"), allow_null=True, default=None
    )
    width = serializers.DecimalField(
        max_digits=12, decimal_places=3, min_value=Decimal("0"), allow_null=True, default=None
    )
    height = serializers.DecimalField(
        max_digits=12, decimal_places=3, min_value=Decimal("0"), allow_null=True, default=None
    )
    status = serializers.ChoiceField(choices=ProductVariant.Status.choices, default="active")

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if attrs["compare_at_price"] is not None and attrs["compare_at_price"] < attrs["price"]:
            raise serializers.ValidationError(
                {"compare_at_price": "Must be at least the selling price."}
            )
        return attrs


class AttributeValueInput(StrictSerializer):
    attribute_id = serializers.UUIDField()
    option_id = serializers.UUIDField(allow_null=True, default=None)
    value = serializers.CharField(max_length=500, allow_blank=True, default="")


class ImageInput(StrictSerializer):
    file = serializers.FileField(write_only=True)
    alt_text = serializers.CharField(max_length=200, allow_blank=True, default="")
    sort_order = serializers.IntegerField(min_value=0, max_value=100000, default=0)


class ProductOutput(serializers.ModelSerializer[Product]):
    category = CategoryOutput(read_only=True)
    brand = BrandOutput(read_only=True)
    currency = serializers.CharField(source="seller.default_currency", read_only=True)

    class Meta:
        model = Product
        fields = [
            "id",
            "seller_id",
            "category",
            "brand",
            "name",
            "slug",
            "description",
            "short_description",
            "status",
            "currency",
            "created_by_id",
            "approved_by_id",
            "approved_at",
            "created_at",
            "updated_at",
        ]


class VariantOutput(serializers.ModelSerializer[ProductVariant]):
    class Meta:
        model = ProductVariant
        fields = [
            "id",
            "product_id",
            "sku",
            "barcode",
            "price",
            "compare_at_price",
            "cost_price",
            "weight",
            "length",
            "width",
            "height",
            "status",
        ]


class ImageOutput(serializers.ModelSerializer[ProductImage]):
    class Meta:
        model = ProductImage
        fields = [
            "id",
            "product_id",
            "content_type",
            "size",
            "alt_text",
            "sort_order",
            "created_at",
        ]


class ProductValueOutput(serializers.ModelSerializer[ProductAttributeValue]):
    attribute = AttributeOutput(read_only=True)
    option = OptionOutput(read_only=True)

    class Meta:
        model = ProductAttributeValue
        fields = ["id", "attribute", "option", "value"]


class VariantValueOutput(serializers.ModelSerializer[VariantAttributeValue]):
    attribute = AttributeOutput(read_only=True)
    option = OptionOutput(read_only=True)

    class Meta:
        model = VariantAttributeValue
        fields = ["id", "attribute", "option", "value"]


class ProductHistoryOutput(serializers.ModelSerializer[ProductStatusHistory]):
    class Meta:
        model = ProductStatusHistory
        fields = ["id", "actor_id", "from_status", "to_status", "reason", "created_at"]


class CatalogFilter(StrictSerializer):
    page = serializers.IntegerField(min_value=1, max_value=10000, required=False)
    search = serializers.CharField(max_length=100, required=False, allow_blank=True)
    category_id = serializers.UUIDField(required=False)
    attribute_id = serializers.UUIDField(required=False)


class ProductFilter(StrictSerializer):
    page = serializers.IntegerField(min_value=1, max_value=10000, required=False)
    search = serializers.CharField(max_length=100, required=False, allow_blank=True)
    status = serializers.ChoiceField(choices=Product.Status.choices, required=False)
    category_id = serializers.UUIDField(required=False)


class CategoryPage(PageSerializer):
    results = CategoryOutput(many=True)


class BrandPage(PageSerializer):
    results = BrandOutput(many=True)


class AttributePage(PageSerializer):
    results = AttributeOutput(many=True)


class OptionPage(PageSerializer):
    results = OptionOutput(many=True)


class CategoryAttributePage(PageSerializer):
    results = CategoryAttributeOutput(many=True)


class ProductPage(PageSerializer):
    results = ProductOutput(many=True)


class VariantPage(PageSerializer):
    results = VariantOutput(many=True)


class ImagePage(PageSerializer):
    results = ImageOutput(many=True)


class ProductValuePage(PageSerializer):
    results = ProductValueOutput(many=True)


class VariantValuePage(PageSerializer):
    results = VariantValueOutput(many=True)


class ProductHistoryPage(PageSerializer):
    results = ProductHistoryOutput(many=True)
