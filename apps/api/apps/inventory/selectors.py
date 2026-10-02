from uuid import UUID

from django.contrib.auth.models import AnonymousUser
from django.db.models import F, Q, QuerySet
from django.shortcuts import get_object_or_404

from apps.accounts.models import User
from apps.inventory.models import Inventory, InventoryTransaction, Warehouse
from apps.sellers.lifecycle_selectors import require_platform
from apps.sellers.selectors import require_seller_access, tenant_queryset


def list_warehouses(
    actor: User | AnonymousUser,
    seller_id: UUID,
    *,
    is_active: bool | None = None,
) -> QuerySet[Warehouse]:
    qs = tenant_queryset(
        user=actor,
        seller_id=seller_id,
        capability="inventory.read",
        model=Warehouse,
    )
    if is_active is not None:
        qs = qs.filter(is_active=is_active)
    return qs.order_by("name", "code")


def get_warehouse(
    actor: User | AnonymousUser,
    seller_id: UUID,
    warehouse_id: UUID,
) -> Warehouse:
    return get_object_or_404(
        tenant_queryset(
            user=actor,
            seller_id=seller_id,
            capability="inventory.read",
            model=Warehouse,
        ),
        pk=warehouse_id,
    )


def list_inventory(
    actor: User | AnonymousUser,
    seller_id: UUID,
    *,
    warehouse_id: UUID | None = None,
    variant_id: UUID | None = None,
    search: str | None = None,
    low_stock: bool | None = None,
) -> QuerySet[Inventory]:
    access = require_seller_access(actor, seller_id, "inventory.read")
    qs = Inventory.objects.filter(warehouse__seller=access.seller).select_related(
        "warehouse",
        "variant",
        "variant__product",
    )

    if warehouse_id:
        qs = qs.filter(warehouse_id=warehouse_id)
    if variant_id:
        qs = qs.filter(variant_id=variant_id)
    if search:
        search = search.strip()
        qs = qs.filter(
            Q(variant__sku__icontains=search)
            | Q(variant__barcode__icontains=search)
            | Q(variant__product__name__icontains=search)
            | Q(warehouse__name__icontains=search)
            | Q(warehouse__code__icontains=search)
        )
    if low_stock is True:
        qs = qs.filter(quantity_on_hand__lte=F("quantity_reserved") + F("reorder_level"))

    return qs.order_by("-updated_at", "-id")


def get_inventory(
    actor: User | AnonymousUser,
    seller_id: UUID,
    inventory_id: UUID,
) -> Inventory:
    access = require_seller_access(actor, seller_id, "inventory.read")
    return get_object_or_404(
        Inventory.objects.filter(warehouse__seller=access.seller).select_related(
            "warehouse",
            "variant",
            "variant__product",
        ),
        pk=inventory_id,
    )


def list_transactions(
    actor: User | AnonymousUser,
    seller_id: UUID,
    *,
    inventory_id: UUID | None = None,
    transaction_type: str | None = None,
) -> QuerySet[InventoryTransaction]:
    access = require_seller_access(actor, seller_id, "inventory.read")
    qs = InventoryTransaction.objects.filter(
        inventory__warehouse__seller=access.seller
    ).select_related("inventory", "inventory__warehouse", "inventory__variant", "created_by")

    if inventory_id:
        qs = qs.filter(inventory_id=inventory_id)
    if transaction_type:
        qs = qs.filter(type=transaction_type)

    return qs.order_by("-created_at", "-id")


def list_platform_inventory(
    actor: User | AnonymousUser,
    *,
    seller_id: UUID | None = None,
    warehouse_id: UUID | None = None,
    search: str | None = None,
    low_stock: bool | None = None,
) -> QuerySet[Inventory]:
    require_platform(actor, "platform.inventory.read")
    qs = Inventory.objects.select_related(
        "warehouse",
        "warehouse__seller",
        "variant",
        "variant__product",
    )

    if seller_id:
        qs = qs.filter(warehouse__seller_id=seller_id)
    if warehouse_id:
        qs = qs.filter(warehouse_id=warehouse_id)
    if search:
        search = search.strip()
        qs = qs.filter(
            Q(variant__sku__icontains=search)
            | Q(variant__barcode__icontains=search)
            | Q(variant__product__name__icontains=search)
            | Q(warehouse__name__icontains=search)
        )
    if low_stock is True:
        qs = qs.filter(quantity_on_hand__lte=F("quantity_reserved") + F("reorder_level"))

    return qs.order_by("-updated_at", "-id")


def get_platform_inventory(
    actor: User | AnonymousUser,
    inventory_id: UUID,
) -> Inventory:
    require_platform(actor, "platform.inventory.read")
    return get_object_or_404(
        Inventory.objects.select_related(
            "warehouse",
            "warehouse__seller",
            "variant",
            "variant__product",
        ),
        pk=inventory_id,
    )


def list_platform_transactions(
    actor: User | AnonymousUser,
    *,
    inventory_id: UUID | None = None,
    seller_id: UUID | None = None,
    transaction_type: str | None = None,
) -> QuerySet[InventoryTransaction]:
    require_platform(actor, "platform.inventory.read")
    qs = InventoryTransaction.objects.select_related(
        "inventory",
        "inventory__warehouse",
        "inventory__warehouse__seller",
        "inventory__variant",
        "created_by",
    )

    if inventory_id:
        qs = qs.filter(inventory_id=inventory_id)
    if seller_id:
        qs = qs.filter(inventory__warehouse__seller_id=seller_id)
    if transaction_type:
        qs = qs.filter(type=transaction_type)

    return qs.order_by("-created_at", "-id")
