from typing import Any
from uuid import UUID

from django.contrib.auth.models import AnonymousUser
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError

from apps.accounts.models import User
from apps.catalog.models import ProductVariant
from apps.inventory.models import Inventory, InventoryTransaction, Warehouse
from apps.sellers.lifecycle_services import lock_seller_access, record


@transaction.atomic
def create_warehouse(
    seller_id: UUID,
    actor: User | AnonymousUser,
    data: dict[str, Any],
    *,
    remote_ip: str | None = None,
) -> Warehouse:
    access = lock_seller_access(actor, seller_id, "inventory.adjust")
    code = data["code"].strip().lower()
    if Warehouse.objects.filter(seller=access.seller, code=code).exists():
        raise ValidationError(
            {"code": "A warehouse with this code already exists for this seller."}
        )

    warehouse = Warehouse.objects.create(
        seller=access.seller,
        name=data["name"].strip(),
        code=code,
        address=data.get("address", "").strip(),
        is_active=data.get("is_active", True),
    )
    record(
        actor=access.membership.user,
        seller=access.seller,
        action="inventory.warehouse.create",
        target_type="warehouse",
        target_id=warehouse.pk,
        changes={"code": warehouse.code, "name": warehouse.name},
        remote_ip=remote_ip,
    )
    return warehouse


@transaction.atomic
def update_warehouse(
    seller_id: UUID,
    actor: User | AnonymousUser,
    warehouse_id: UUID,
    data: dict[str, Any],
    *,
    remote_ip: str | None = None,
) -> Warehouse:
    access = lock_seller_access(actor, seller_id, "inventory.adjust")
    warehouse = get_object_or_404(
        Warehouse.objects.select_for_update(),
        pk=warehouse_id,
        seller=access.seller,
    )

    if "name" in data:
        warehouse.name = data["name"].strip()
    if "address" in data:
        warehouse.address = data["address"].strip()
    if "is_active" in data:
        warehouse.is_active = bool(data["is_active"])

    warehouse.save(update_fields=["name", "address", "is_active", "updated_at"])
    record(
        actor=access.membership.user,
        seller=access.seller,
        action="inventory.warehouse.update",
        target_type="warehouse",
        target_id=warehouse.pk,
        changes={"name": warehouse.name, "is_active": warehouse.is_active},
        remote_ip=remote_ip,
    )
    return warehouse


@transaction.atomic
def get_or_create_inventory(
    seller_id: UUID,
    actor: User | AnonymousUser,
    warehouse_id: UUID,
    variant_id: UUID,
    reorder_level: int = 0,
    *,
    remote_ip: str | None = None,
) -> Inventory:
    access = lock_seller_access(actor, seller_id, "inventory.adjust")
    warehouse = get_object_or_404(
        Warehouse.objects.select_for_update(),
        pk=warehouse_id,
        seller=access.seller,
    )
    variant = get_object_or_404(
        ProductVariant.objects.select_for_update(),
        pk=variant_id,
        product__seller=access.seller,
    )

    if reorder_level < 0:
        raise ValidationError({"reorder_level": "Reorder level must be non-negative."})

    inventory, created = Inventory.objects.select_for_update().get_or_create(
        warehouse=warehouse,
        variant=variant,
        defaults={"reorder_level": reorder_level},
    )
    if created:
        record(
            actor=access.membership.user,
            seller=access.seller,
            action="inventory.item.create",
            target_type="inventory",
            target_id=inventory.pk,
            changes={
                "warehouse": str(warehouse.pk),
                "variant": str(variant.pk),
                "reorder_level": reorder_level,
            },
            remote_ip=remote_ip,
        )
    return inventory


@transaction.atomic
def adjust_inventory(
    seller_id: UUID,
    actor: User | AnonymousUser,
    inventory_id: UUID,
    quantity_delta: int,
    reason: str,
    *,
    reference_type: str = "",
    reference_id: str = "",
    remote_ip: str | None = None,
) -> Inventory:
    access = lock_seller_access(actor, seller_id, "inventory.adjust")
    inventory = get_object_or_404(
        Inventory.objects.select_for_update(),
        pk=inventory_id,
        warehouse__seller=access.seller,
    )

    if quantity_delta == 0:
        raise ValidationError({"quantity_delta": "Quantity delta cannot be zero."})
    if not reason.strip():
        raise ValidationError({"reason": "A reason for adjustment is required."})

    new_on_hand = inventory.quantity_on_hand + quantity_delta
    if new_on_hand < 0:
        raise ValidationError({"quantity_delta": "Quantity on hand cannot become negative."})
    if new_on_hand < inventory.quantity_reserved:
        raise ValidationError(
            {"quantity_delta": "Quantity on hand cannot fall below reserved quantity."}
        )

    inventory.quantity_on_hand = new_on_hand
    inventory.save(update_fields=["quantity_on_hand", "updated_at"])

    InventoryTransaction.objects.create(
        inventory=inventory,
        type=InventoryTransaction.Type.ADJUSTMENT,
        quantity_delta=quantity_delta,
        reference_type=reference_type,
        reference_id=reference_id,
        reason=reason.strip(),
        created_by=access.membership.user,
    )

    record(
        actor=access.membership.user,
        seller=access.seller,
        action="inventory.adjust",
        target_type="inventory",
        target_id=inventory.pk,
        changes={
            "quantity_delta": quantity_delta,
            "quantity_on_hand": inventory.quantity_on_hand,
            "reason": reason.strip(),
        },
        remote_ip=remote_ip,
    )
    return inventory


@transaction.atomic
def reserve_inventory(
    seller_id: UUID,
    actor: User | AnonymousUser,
    inventory_id: UUID,
    quantity: int,
    reason: str,
    *,
    reference_type: str = "",
    reference_id: str = "",
    remote_ip: str | None = None,
) -> Inventory:
    access = lock_seller_access(actor, seller_id, "inventory.adjust")
    inventory = get_object_or_404(
        Inventory.objects.select_for_update(),
        pk=inventory_id,
        warehouse__seller=access.seller,
    )

    if quantity <= 0:
        raise ValidationError({"quantity": "Reservation quantity must be positive."})

    available = inventory.quantity_on_hand - inventory.quantity_reserved
    if quantity > available:
        raise ValidationError(
            {"quantity": f"Cannot reserve {quantity}; only {available} available."}
        )

    inventory.quantity_reserved += quantity
    inventory.save(update_fields=["quantity_reserved", "updated_at"])

    InventoryTransaction.objects.create(
        inventory=inventory,
        type=InventoryTransaction.Type.RESERVATION,
        quantity_delta=quantity,
        reference_type=reference_type,
        reference_id=reference_id,
        reason=reason.strip(),
        created_by=access.membership.user,
    )

    record(
        actor=access.membership.user,
        seller=access.seller,
        action="inventory.reserve",
        target_type="inventory",
        target_id=inventory.pk,
        changes={"quantity_reserved": inventory.quantity_reserved, "quantity": quantity},
        remote_ip=remote_ip,
    )
    return inventory


@transaction.atomic
def release_inventory(
    seller_id: UUID,
    actor: User | AnonymousUser,
    inventory_id: UUID,
    quantity: int,
    reason: str,
    *,
    reference_type: str = "",
    reference_id: str = "",
    remote_ip: str | None = None,
) -> Inventory:
    access = lock_seller_access(actor, seller_id, "inventory.adjust")
    inventory = get_object_or_404(
        Inventory.objects.select_for_update(),
        pk=inventory_id,
        warehouse__seller=access.seller,
    )

    if quantity <= 0:
        raise ValidationError({"quantity": "Release quantity must be positive."})
    if quantity > inventory.quantity_reserved:
        raise ValidationError(
            {
                "quantity": (
                    f"Cannot release {quantity}; only {inventory.quantity_reserved} is reserved."
                )
            }
        )

    inventory.quantity_reserved -= quantity
    inventory.save(update_fields=["quantity_reserved", "updated_at"])

    InventoryTransaction.objects.create(
        inventory=inventory,
        type=InventoryTransaction.Type.RELEASE,
        quantity_delta=-quantity,
        reference_type=reference_type,
        reference_id=reference_id,
        reason=reason.strip(),
        created_by=access.membership.user,
    )

    record(
        actor=access.membership.user,
        seller=access.seller,
        action="inventory.release",
        target_type="inventory",
        target_id=inventory.pk,
        changes={"quantity_reserved": inventory.quantity_reserved, "quantity": quantity},
        remote_ip=remote_ip,
    )
    return inventory


@transaction.atomic
def consume_reserved_inventory(
    seller_id: UUID,
    actor: User | AnonymousUser,
    inventory_id: UUID,
    quantity: int,
    reason: str,
    *,
    reference_type: str = "",
    reference_id: str = "",
    remote_ip: str | None = None,
) -> Inventory:
    access = lock_seller_access(actor, seller_id, "inventory.adjust")
    inventory = get_object_or_404(
        Inventory.objects.select_for_update(),
        pk=inventory_id,
        warehouse__seller=access.seller,
    )

    if quantity <= 0:
        raise ValidationError({"quantity": "Consumed quantity must be positive."})
    if quantity > inventory.quantity_reserved:
        raise ValidationError(
            {
                "quantity": (
                    f"Cannot consume {quantity}; only {inventory.quantity_reserved} is reserved."
                )
            }
        )

    inventory.quantity_reserved -= quantity
    inventory.quantity_on_hand -= quantity
    inventory.save(update_fields=["quantity_reserved", "quantity_on_hand", "updated_at"])

    InventoryTransaction.objects.create(
        inventory=inventory,
        type=InventoryTransaction.Type.SALE,
        quantity_delta=-quantity,
        reference_type=reference_type,
        reference_id=reference_id,
        reason=reason.strip(),
        created_by=access.membership.user,
    )

    record(
        actor=access.membership.user,
        seller=access.seller,
        action="inventory.consume",
        target_type="inventory",
        target_id=inventory.pk,
        changes={
            "quantity_on_hand": inventory.quantity_on_hand,
            "quantity_reserved": inventory.quantity_reserved,
        },
        remote_ip=remote_ip,
    )
    return inventory


@transaction.atomic
def receive_return(
    seller_id: UUID,
    actor: User | AnonymousUser,
    inventory_id: UUID,
    quantity: int,
    reason: str,
    *,
    reference_type: str = "",
    reference_id: str = "",
    remote_ip: str | None = None,
) -> Inventory:
    access = lock_seller_access(actor, seller_id, "inventory.adjust")
    inventory = get_object_or_404(
        Inventory.objects.select_for_update(),
        pk=inventory_id,
        warehouse__seller=access.seller,
    )

    if quantity <= 0:
        raise ValidationError({"quantity": "Return quantity must be positive."})

    inventory.quantity_on_hand += quantity
    inventory.save(update_fields=["quantity_on_hand", "updated_at"])

    InventoryTransaction.objects.create(
        inventory=inventory,
        type=InventoryTransaction.Type.RETURN,
        quantity_delta=quantity,
        reference_type=reference_type,
        reference_id=reference_id,
        reason=reason.strip(),
        created_by=access.membership.user,
    )

    record(
        actor=access.membership.user,
        seller=access.seller,
        action="inventory.return",
        target_type="inventory",
        target_id=inventory.pk,
        changes={"quantity_on_hand": inventory.quantity_on_hand, "quantity": quantity},
        remote_ip=remote_ip,
    )
    return inventory
