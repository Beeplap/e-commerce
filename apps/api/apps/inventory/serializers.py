from typing import Any

from rest_framework import serializers

from apps.accounts.serializers import StrictSerializer
from apps.catalog.models import ProductVariant
from apps.inventory.models import Inventory, InventoryTransaction, Warehouse
from apps.sellers.lifecycle_serializers import PageSerializer


class WarehouseInput(StrictSerializer):
    name = serializers.CharField(max_length=120)
    code = serializers.SlugField(max_length=50)
    address = serializers.CharField(max_length=500, allow_blank=True, default="")
    is_active = serializers.BooleanField(default=True)


class WarehouseUpdateInput(StrictSerializer):
    name = serializers.CharField(max_length=120, required=False)
    address = serializers.CharField(max_length=500, allow_blank=True, required=False)
    is_active = serializers.BooleanField(required=False)


class WarehouseOutput(serializers.ModelSerializer[Warehouse]):
    class Meta:
        model = Warehouse
        fields = ["id", "name", "code", "address", "is_active", "created_at", "updated_at"]


class InventoryCreateInput(StrictSerializer):
    warehouse_id = serializers.UUIDField()
    variant_id = serializers.UUIDField()
    reorder_level = serializers.IntegerField(min_value=0, default=0)


class InventoryAdjustInput(StrictSerializer):
    quantity_delta = serializers.IntegerField()
    reason = serializers.CharField(max_length=500)
    reference_type = serializers.CharField(max_length=50, allow_blank=True, default="")
    reference_id = serializers.CharField(max_length=100, allow_blank=True, default="")


class InventoryReserveInput(StrictSerializer):
    quantity = serializers.IntegerField(min_value=1)
    reason = serializers.CharField(max_length=500, allow_blank=True, default="")
    reference_type = serializers.CharField(max_length=50, allow_blank=True, default="")
    reference_id = serializers.CharField(max_length=100, allow_blank=True, default="")


class InventoryReleaseInput(StrictSerializer):
    quantity = serializers.IntegerField(min_value=1)
    reason = serializers.CharField(max_length=500, allow_blank=True, default="")
    reference_type = serializers.CharField(max_length=50, allow_blank=True, default="")
    reference_id = serializers.CharField(max_length=100, allow_blank=True, default="")


class InventoryVariantOutput(serializers.ModelSerializer[ProductVariant]):
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = ProductVariant
        fields = ["id", "sku", "barcode", "product_id", "product_name"]


class InventoryOutput(serializers.ModelSerializer[Inventory]):
    warehouse = WarehouseOutput(read_only=True)
    variant = InventoryVariantOutput(read_only=True)
    available_quantity = serializers.IntegerField(read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = Inventory
        fields = [
            "id",
            "warehouse",
            "variant",
            "quantity_on_hand",
            "quantity_reserved",
            "available_quantity",
            "reorder_level",
            "is_low_stock",
            "updated_at",
        ]


class InventoryTransactionOutput(serializers.ModelSerializer[InventoryTransaction]):
    class Meta:
        model = InventoryTransaction
        fields = [
            "id",
            "inventory_id",
            "type",
            "quantity_delta",
            "reference_type",
            "reference_id",
            "reason",
            "created_by_id",
            "created_at",
        ]


class WarehouseFilter(serializers.Serializer[Any]):
    page = serializers.IntegerField(required=False, min_value=1, max_value=10000, default=1)
    is_active = serializers.BooleanField(required=False, allow_null=True, default=None)


class InventoryFilter(serializers.Serializer[Any]):
    page = serializers.IntegerField(required=False, min_value=1, max_value=10000, default=1)
    warehouse_id = serializers.UUIDField(required=False)
    variant_id = serializers.UUIDField(required=False)
    seller_id = serializers.UUIDField(required=False)
    search = serializers.CharField(required=False, max_length=100)
    low_stock = serializers.BooleanField(required=False, allow_null=True, default=None)


class TransactionFilter(serializers.Serializer[Any]):
    page = serializers.IntegerField(required=False, min_value=1, max_value=10000, default=1)
    inventory_id = serializers.UUIDField(required=False)
    seller_id = serializers.UUIDField(required=False)
    type = serializers.ChoiceField(choices=InventoryTransaction.Type.choices, required=False)


class WarehousePage(PageSerializer):
    results = WarehouseOutput(many=True)


class InventoryPage(PageSerializer):
    results = InventoryOutput(many=True)


class InventoryTransactionPage(PageSerializer):
    results = InventoryTransactionOutput(many=True)
