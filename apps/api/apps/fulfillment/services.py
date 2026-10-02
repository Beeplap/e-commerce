from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal
from typing import Any
from uuid import UUID, uuid4

from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.finance.models import SellerLedgerEntry
from apps.finance.services import ensure_seller_balance, record_ledger_entry
from apps.fulfillment.models import (
    Refund,
    RefundTransaction,
    ReturnItem,
    ReturnRequest,
    ReturnStatusHistory,
    Shipment,
    ShipmentItem,
    ShippingMethod,
    ShippingRate,
    ShippingZone,
    TrackingEvent,
)
from apps.inventory.models import Inventory, Warehouse
from apps.inventory.services import consume_order_inventory, receive_return
from apps.orders.models import Order, OrderItem, OrderStatusHistory, SellerOrder
from apps.orders.services import sync_parent_order_fulfillment_status
from apps.platform_access.models import PlatformAccess
from apps.sellers.lifecycle_services import lock_seller_access, record

# -------------------------------------------------------------------------
# Shipping Setup Services
# -------------------------------------------------------------------------


@transaction.atomic
def create_shipping_zone(
    *,
    actor: Any,
    seller_id: UUID | None = None,
    name: str,
    countries: list[str] | None = None,
    is_active: bool = True,
) -> ShippingZone:
    cleaned_name = name.strip()
    if not cleaned_name:
        raise ValidationError({"name": "Zone name cannot be blank."})

    seller = None
    if seller_id is not None:
        access = lock_seller_access(actor, seller_id, "fulfillment.manage")
        seller = access.seller
    else:
        # Platform zone creation requires platform.fulfillment.manage
        if not PlatformAccess.objects.filter(
            user=actor,
            is_active=True,
            role__permissions__code="platform.fulfillment.manage",
        ).exists():
            raise PermissionDenied("Platform fulfillment capability required.")

    zone = ShippingZone.objects.create(
        seller=seller,
        name=cleaned_name,
        countries=countries or [],
        is_active=is_active,
    )
    return zone


@transaction.atomic
def create_shipping_method(
    *,
    actor: Any,
    seller_id: UUID | None = None,
    name: str,
    code: str,
    carrier: str,
    estimated_delivery_days_min: int = 1,
    estimated_delivery_days_max: int = 5,
    is_active: bool = True,
) -> ShippingMethod:
    cleaned_name = name.strip()
    cleaned_code = code.strip().lower()
    cleaned_carrier = carrier.strip()

    if not cleaned_name or not cleaned_code or not cleaned_carrier:
        raise ValidationError({"detail": "Name, code, and carrier are required."})

    if estimated_delivery_days_min > estimated_delivery_days_max:
        raise ValidationError({"estimated_delivery_days_min": "Min days cannot exceed max days."})

    seller = None
    if seller_id is not None:
        access = lock_seller_access(actor, seller_id, "fulfillment.manage")
        seller = access.seller
    else:
        if not PlatformAccess.objects.filter(
            user=actor,
            is_active=True,
            role__permissions__code="platform.fulfillment.manage",
        ).exists():
            raise PermissionDenied("Platform fulfillment capability required.")

    method = ShippingMethod.objects.create(
        seller=seller,
        name=cleaned_name,
        code=cleaned_code,
        carrier=cleaned_carrier,
        estimated_delivery_days_min=estimated_delivery_days_min,
        estimated_delivery_days_max=estimated_delivery_days_max,
        is_active=is_active,
    )
    return method


@transaction.atomic
def create_shipping_rate(
    *,
    actor: Any,
    zone_id: UUID,
    method_id: UUID,
    rate: Decimal,
    currency: str = "USD",
    min_order_amount: Decimal = Decimal("0.00"),
    max_order_amount: Decimal | None = None,
    weight_min: Decimal = Decimal("0.00"),
    weight_max: Decimal | None = None,
) -> ShippingRate:
    zone = get_object_or_404(ShippingZone, pk=zone_id)
    method = get_object_or_404(ShippingMethod, pk=method_id)

    if rate < Decimal("0.00"):
        raise ValidationError({"rate": "Shipping rate must be non-negative."})

    if zone.seller is not None:
        assert zone.seller_id is not None
        lock_seller_access(actor, zone.seller_id, "fulfillment.manage")
    else:
        if not PlatformAccess.objects.filter(
            user=actor,
            is_active=True,
            role__permissions__code="platform.fulfillment.manage",
        ).exists():
            raise PermissionDenied("Platform fulfillment capability required.")

    shipping_rate = ShippingRate.objects.create(
        zone=zone,
        method=method,
        rate=rate,
        currency=currency.strip().upper(),
        min_order_amount=min_order_amount,
        max_order_amount=max_order_amount,
        weight_min=weight_min,
        weight_max=weight_max,
    )
    return shipping_rate


# -------------------------------------------------------------------------
# Shipment Lifecycle Services
# -------------------------------------------------------------------------


@transaction.atomic
def create_shipment(
    *,
    actor: Any,
    seller_id: UUID,
    seller_order_id: UUID,
    carrier: str,
    tracking_number: str = "",
    tracking_url: str = "",
    shipping_method_id: UUID | None = None,
    items_data: list[dict[str, Any]],
    notes: str = "",
) -> Shipment:
    access = lock_seller_access(actor, seller_id, "fulfillment.manage")
    seller_order = get_object_or_404(
        SellerOrder.objects.select_for_update().filter(seller=access.seller),
        pk=seller_order_id,
    )

    if seller_order.status in [SellerOrder.Status.CANCELLED, SellerOrder.Status.PENDING]:
        raise ValidationError(
            {"status": f"Cannot create shipment for order in status '{seller_order.status}'."}
        )

    if not items_data:
        raise ValidationError({"items": "At least one item must be included in the shipment."})

    cleaned_carrier = carrier.strip()
    if not cleaned_carrier:
        raise ValidationError({"carrier": "Carrier is required."})

    shipping_method = None
    if shipping_method_id:
        shipping_method = get_object_or_404(ShippingMethod, pk=shipping_method_id)

    shipment_number = f"SHP-{uuid4().hex[:10].upper()}"

    shipment = Shipment.objects.create(
        shipment_number=shipment_number,
        seller_order=seller_order,
        seller=access.seller,
        shipping_method=shipping_method,
        carrier=cleaned_carrier,
        tracking_number=tracking_number.strip(),
        tracking_url=tracking_url.strip(),
        status=Shipment.Status.SHIPPED,
        shipped_at=timezone.now(),
        notes=notes.strip(),
    )

    # Process items and validate quantities
    for item_input in items_data:
        order_item_id = item_input.get("order_item_id")
        quantity = item_input.get("quantity")

        if not order_item_id or not isinstance(quantity, int) or quantity <= 0:
            raise ValidationError({"items": "Valid order_item_id and positive quantity required."})

        order_item = get_object_or_404(
            OrderItem.objects.select_for_update().filter(seller_order=seller_order),
            pk=order_item_id,
        )

        already_shipped = sum(
            ShipmentItem.objects.filter(
                shipment__seller_order=seller_order,
                shipment__status__in=[
                    Shipment.Status.PREPARING,
                    Shipment.Status.SHIPPED,
                    Shipment.Status.IN_TRANSIT,
                    Shipment.Status.OUT_FOR_DELIVERY,
                    Shipment.Status.DELIVERED,
                ],
                order_item=order_item,
            )
            .exclude(shipment=shipment)
            .values_list("quantity", flat=True)
        )
        remaining = order_item.quantity - already_shipped

        if quantity > remaining:
            raise ValidationError(
                {
                    "items": (
                        f"Cannot ship {quantity} units of {order_item.sku_snapshot}; "
                        f"only {remaining} remaining."
                    )
                }
            )

        ShipmentItem.objects.create(
            shipment=shipment,
            order_item=order_item,
            quantity=quantity,
        )

        # Consume inventory if order was still CONFIRMED or PROCESSING
        if (
            seller_order.status in [SellerOrder.Status.CONFIRMED, SellerOrder.Status.PROCESSING]
            and order_item.warehouse
            and order_item.variant
        ):
            inv = Inventory.objects.filter(
                warehouse=order_item.warehouse,
                variant=order_item.variant,
            ).first()
            if inv:
                consume_order_inventory(
                    inventory_id=inv.pk,
                    quantity=quantity,
                    reference_id=str(seller_order.pk),
                    reason=f"Shipped {shipment_number}",
                    actor=actor,
                )

    # Transition seller_order to SHIPPED if not already
    if seller_order.status in [SellerOrder.Status.CONFIRMED, SellerOrder.Status.PROCESSING]:
        old_status = seller_order.status
        seller_order.status = SellerOrder.Status.SHIPPED
        seller_order.save(update_fields=["status", "updated_at"])

        OrderStatusHistory.objects.create(
            seller_order=seller_order,
            actor_id=actor.id,
            from_status=old_status,
            to_status=SellerOrder.Status.SHIPPED,
            notes=f"Shipment {shipment_number} dispatched via {cleaned_carrier}.",
        )
        sync_parent_order_fulfillment_status(seller_order.order)

    # Initial tracking event
    TrackingEvent.objects.create(
        shipment=shipment,
        status="shipped",
        location="Origin Warehouse",
        description=f"Package received by {cleaned_carrier}.",
        timestamp=timezone.now(),
    )

    record(
        actor=actor,
        seller=access.seller,
        action="fulfillment.shipment.create",
        target_type="shipment",
        target_id=shipment.pk,
        changes={"shipment_number": shipment.shipment_number, "status": shipment.status},
    )

    return shipment


@transaction.atomic
def add_tracking_event(
    *,
    actor: Any,
    seller_id: UUID,
    shipment_id: UUID,
    status: str,
    location: str = "",
    description: str = "",
) -> TrackingEvent:
    access = lock_seller_access(actor, seller_id, "fulfillment.manage")
    shipment = get_object_or_404(
        Shipment.objects.select_for_update().filter(seller=access.seller),
        pk=shipment_id,
    )

    event = TrackingEvent.objects.create(
        shipment=shipment,
        status=status.strip().lower(),
        location=location.strip(),
        description=description.strip() or f"Status updated to {status}.",
        timestamp=timezone.now(),
    )

    status_lower = status.strip().lower()
    if status_lower in [choice[0] for choice in Shipment.Status.choices]:
        shipment.status = status_lower
        if status_lower == Shipment.Status.DELIVERED and not shipment.delivered_at:
            shipment.delivered_at = timezone.now()
        shipment.save(update_fields=["status", "delivered_at", "updated_at"])

    return event


@transaction.atomic
def mark_shipment_delivered(
    *,
    actor: Any,
    seller_id: UUID,
    shipment_id: UUID,
) -> Shipment:
    access = lock_seller_access(actor, seller_id, "fulfillment.manage")
    shipment = get_object_or_404(
        Shipment.objects.select_for_update().filter(seller=access.seller),
        pk=shipment_id,
    )

    if shipment.status == Shipment.Status.DELIVERED:
        return shipment

    shipment.status = Shipment.Status.DELIVERED
    shipment.delivered_at = timezone.now()
    shipment.save(update_fields=["status", "delivered_at", "updated_at"])

    TrackingEvent.objects.create(
        shipment=shipment,
        status="delivered",
        location="Destination",
        description="Shipment marked as delivered.",
        timestamp=timezone.now(),
    )

    seller_order = shipment.seller_order
    all_shipments = seller_order.shipments.all()
    if (
        all_shipments.exists()
        and all(s.status == Shipment.Status.DELIVERED for s in all_shipments)
        and seller_order.status != SellerOrder.Status.DELIVERED
    ):
        old_status = seller_order.status
        seller_order.status = SellerOrder.Status.DELIVERED
        seller_order.save(update_fields=["status", "updated_at"])

        OrderStatusHistory.objects.create(
            seller_order=seller_order,
            actor_id=actor.id,
            from_status=old_status,
            to_status=SellerOrder.Status.DELIVERED,
            notes="All shipments delivered to recipient.",
        )
        sync_parent_order_fulfillment_status(seller_order.order)

    record(
        actor=actor,
        seller=access.seller,
        action="fulfillment.shipment.deliver",
        target_type="shipment",
        target_id=shipment.pk,
        changes={"status": Shipment.Status.DELIVERED},
    )

    return shipment


# -------------------------------------------------------------------------
# Return Request Lifecycle Services
# -------------------------------------------------------------------------


@transaction.atomic
def create_return_request(
    *,
    actor: Any,
    seller_order_id: UUID,
    reason: str,
    customer_notes: str = "",
    items_data: list[dict[str, Any]],
) -> ReturnRequest:
    seller_order = get_object_or_404(
        SellerOrder.objects.select_for_update(),
        pk=seller_order_id,
    )

    if seller_order.status not in [SellerOrder.Status.SHIPPED, SellerOrder.Status.DELIVERED]:
        raise ValidationError(
            {"status": f"Cannot request return for order in status '{seller_order.status}'."}
        )

    if not items_data:
        raise ValidationError({"items": "At least one item must be returned."})

    cleaned_reason = reason.strip()
    if not cleaned_reason:
        raise ValidationError({"reason": "Return reason is required."})

    return_number = f"RET-{uuid4().hex[:10].upper()}"

    return_request = ReturnRequest.objects.create(
        return_number=return_number,
        seller_order=seller_order,
        seller=seller_order.seller,
        customer=seller_order.order.customer if seller_order.order else None,
        status=ReturnRequest.Status.REQUESTED,
        reason=cleaned_reason,
        customer_notes=customer_notes.strip(),
    )

    for item_input in items_data:
        order_item_id = item_input.get("order_item_id")
        quantity = item_input.get("quantity")
        item_reason = item_input.get("reason", cleaned_reason)

        if not order_item_id or not isinstance(quantity, int) or quantity <= 0:
            raise ValidationError({"items": "Valid order_item_id and positive quantity required."})

        order_item = get_object_or_404(
            OrderItem.objects.select_for_update().filter(seller_order=seller_order),
            pk=order_item_id,
        )

        already_returned = sum(
            ReturnItem.objects.filter(
                return_request__seller_order=seller_order,
                return_request__status__in=[
                    ReturnRequest.Status.REQUESTED,
                    ReturnRequest.Status.APPROVED,
                    ReturnRequest.Status.IN_TRANSIT,
                    ReturnRequest.Status.RECEIVED,
                    ReturnRequest.Status.REFUND_PENDING,
                    ReturnRequest.Status.REFUNDED,
                ],
                order_item=order_item,
            )
            .exclude(return_request=return_request)
            .values_list("quantity", flat=True)
        )
        returnable = order_item.quantity - already_returned

        if quantity > returnable:
            raise ValidationError(
                {
                    "items": (
                        f"Cannot return {quantity} units of {order_item.sku_snapshot}; "
                        f"only {returnable} returnable."
                    )
                }
            )

        unit_refund = (order_item.total / order_item.quantity).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        item_refund_total = (unit_refund * quantity).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

        ReturnItem.objects.create(
            return_request=return_request,
            order_item=order_item,
            quantity=quantity,
            reason=item_reason.strip(),
            warehouse=order_item.warehouse,
            refund_amount=item_refund_total,
        )

    ReturnStatusHistory.objects.create(
        return_request=return_request,
        actor_id=actor.id if actor and actor.is_authenticated else None,
        from_status="",
        to_status=ReturnRequest.Status.REQUESTED,
        notes=f"Return requested by customer. Reason: {cleaned_reason}",
    )

    return return_request


@transaction.atomic
def approve_return_request(
    *,
    actor: Any,
    seller_id: UUID,
    return_id: UUID,
    return_carrier: str = "",
    return_tracking_number: str = "",
) -> ReturnRequest:
    access = lock_seller_access(actor, seller_id, "returns.manage")
    return_request = get_object_or_404(
        ReturnRequest.objects.select_for_update().filter(seller=access.seller),
        pk=return_id,
    )

    if return_request.status != ReturnRequest.Status.REQUESTED:
        raise ValidationError(
            {"status": f"Cannot approve return in status '{return_request.status}'."}
        )

    old_status = return_request.status
    return_request.status = ReturnRequest.Status.APPROVED
    return_request.approved_at = timezone.now()
    if return_carrier:
        return_request.return_carrier = return_carrier.strip()
    if return_tracking_number:
        return_request.return_tracking_number = return_tracking_number.strip()
    return_request.save(
        update_fields=[
            "status",
            "approved_at",
            "return_carrier",
            "return_tracking_number",
            "updated_at",
        ]
    )

    ReturnStatusHistory.objects.create(
        return_request=return_request,
        actor_id=actor.id,
        from_status=old_status,
        to_status=ReturnRequest.Status.APPROVED,
        notes="Return request approved by seller.",
    )

    record(
        actor=actor,
        seller=access.seller,
        action="fulfillment.return.approve",
        target_type="return_request",
        target_id=return_request.pk,
        changes={"status": ReturnRequest.Status.APPROVED},
    )

    return return_request


@transaction.atomic
def reject_return_request(
    *,
    actor: Any,
    seller_id: UUID,
    return_id: UUID,
    reason: str,
) -> ReturnRequest:
    access = lock_seller_access(actor, seller_id, "returns.manage")
    return_request = get_object_or_404(
        ReturnRequest.objects.select_for_update().filter(seller=access.seller),
        pk=return_id,
    )

    cleaned_reason = reason.strip()
    if not cleaned_reason:
        raise ValidationError({"reason": "Rejection reason is required."})

    if return_request.status not in [ReturnRequest.Status.REQUESTED, ReturnRequest.Status.APPROVED]:
        raise ValidationError(
            {"status": f"Cannot reject return in status '{return_request.status}'."}
        )

    old_status = return_request.status
    return_request.status = ReturnRequest.Status.REJECTED
    return_request.rejection_reason = cleaned_reason
    return_request.closed_at = timezone.now()
    return_request.save(update_fields=["status", "rejection_reason", "closed_at", "updated_at"])

    ReturnStatusHistory.objects.create(
        return_request=return_request,
        actor_id=actor.id,
        from_status=old_status,
        to_status=ReturnRequest.Status.REJECTED,
        notes=f"Return rejected. Reason: {cleaned_reason}",
    )

    record(
        actor=actor,
        seller=access.seller,
        action="fulfillment.return.reject",
        target_type="return_request",
        target_id=return_request.pk,
        changes={"status": ReturnRequest.Status.REJECTED, "reason": cleaned_reason},
    )

    return return_request


@transaction.atomic
def mark_return_in_transit(
    *,
    actor: Any,
    seller_id: UUID,
    return_id: UUID,
    return_carrier: str = "",
    return_tracking_number: str = "",
) -> ReturnRequest:
    access = lock_seller_access(actor, seller_id, "returns.manage")
    return_request = get_object_or_404(
        ReturnRequest.objects.select_for_update().filter(seller=access.seller),
        pk=return_id,
    )

    if return_request.status != ReturnRequest.Status.APPROVED:
        raise ValidationError(
            {"status": f"Cannot mark return in transit from status '{return_request.status}'."}
        )

    old_status = return_request.status
    return_request.status = ReturnRequest.Status.IN_TRANSIT
    if return_carrier:
        return_request.return_carrier = return_carrier.strip()
    if return_tracking_number:
        return_request.return_tracking_number = return_tracking_number.strip()
    return_request.save(
        update_fields=[
            "status",
            "return_carrier",
            "return_tracking_number",
            "updated_at",
        ]
    )

    ReturnStatusHistory.objects.create(
        return_request=return_request,
        actor_id=actor.id,
        from_status=old_status,
        to_status=ReturnRequest.Status.IN_TRANSIT,
        notes="Return shipment in transit to seller warehouse.",
    )

    return return_request


@transaction.atomic
def receive_return_request(
    *,
    actor: Any,
    seller_id: UUID,
    return_id: UUID,
    items_inspection: list[dict[str, Any]] | None = None,
) -> ReturnRequest:
    access = lock_seller_access(actor, seller_id, "returns.manage")
    return_request = get_object_or_404(
        ReturnRequest.objects.select_for_update().filter(seller=access.seller),
        pk=return_id,
    )

    if return_request.status not in [
        ReturnRequest.Status.APPROVED,
        ReturnRequest.Status.IN_TRANSIT,
    ]:
        raise ValidationError(
            {"status": f"Cannot receive return in status '{return_request.status}'."}
        )

    inspection_map = {}
    if items_inspection:
        for insp in items_inspection:
            item_id = insp.get("return_item_id")
            if item_id:
                inspection_map[str(item_id)] = insp

    for item in return_request.items.select_related(
        "order_item", "warehouse", "order_item__variant"
    ):
        insp = inspection_map.get(str(item.pk), {})
        condition = insp.get("condition", item.condition)
        restock = insp.get("restock_inventory", item.restock_inventory)
        warehouse_id = insp.get("warehouse_id")

        if warehouse_id:
            warehouse = get_object_or_404(Warehouse, pk=warehouse_id, seller=access.seller)
            item.warehouse = warehouse

        item.condition = condition
        item.restock_inventory = restock
        item.save(update_fields=["condition", "restock_inventory", "warehouse"])

        # Inventory integration: if restocking, receive return into warehouse
        if restock and item.order_item.variant and item.warehouse:
            inventory = Inventory.objects.filter(
                warehouse=item.warehouse,
                variant=item.order_item.variant,
            ).first()
            if inventory:
                receive_return(
                    seller_id=access.seller.pk,
                    actor=actor,
                    inventory_id=inventory.pk,
                    quantity=item.quantity,
                    reason=f"Restock from return {return_request.return_number}",
                    reference_type="RETURN",
                    reference_id=str(return_request.pk),
                )

    old_status = return_request.status
    return_request.status = ReturnRequest.Status.REFUND_PENDING
    return_request.received_at = timezone.now()
    return_request.save(update_fields=["status", "received_at", "updated_at"])

    ReturnStatusHistory.objects.create(
        return_request=return_request,
        actor_id=actor.id,
        from_status=old_status,
        to_status=ReturnRequest.Status.REFUND_PENDING,
        notes="Return received and inspected. Queued for refund processing.",
    )

    record(
        actor=actor,
        seller=access.seller,
        action="fulfillment.return.receive",
        target_type="return_request",
        target_id=return_request.pk,
        changes={"status": ReturnRequest.Status.REFUND_PENDING},
    )

    return return_request


# -------------------------------------------------------------------------
# Refund Lifecycle and Financial Integration Services
# -------------------------------------------------------------------------


@transaction.atomic
def process_refund(
    *,
    actor: Any,
    seller_id: UUID,
    seller_order_id: UUID,
    amount: Decimal,
    reason: str,
    return_request_id: UUID | None = None,
) -> Refund:
    access = lock_seller_access(actor, seller_id, "returns.manage")
    seller_order = get_object_or_404(
        SellerOrder.objects.select_for_update().filter(seller=access.seller),
        pk=seller_order_id,
    )

    if amount <= Decimal("0.00"):
        raise ValidationError({"amount": "Refund amount must be positive."})

    cleaned_reason = reason.strip()
    if not cleaned_reason:
        raise ValidationError({"reason": "Refund reason is required."})

    return_request = None
    if return_request_id:
        return_request = get_object_or_404(
            ReturnRequest.objects.select_for_update().filter(seller=access.seller),
            pk=return_request_id,
        )
        if return_request.seller_order_id != seller_order.pk:
            raise ValidationError(
                {"return_request": "Return request does not belong to this seller order."}
            )

    order_total = (
        seller_order.subtotal
        + seller_order.tax_total
        + seller_order.shipping_total
        - seller_order.discount_total
    ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    total_refunded = sum(
        Refund.objects.filter(
            seller_order=seller_order,
            status=Refund.Status.COMPLETED,
        ).values_list("amount", flat=True)
    )
    remaining_refundable = order_total - total_refunded

    if amount > remaining_refundable:
        raise ValidationError(
            {
                "amount": (
                    f"Cannot refund {amount}; only {remaining_refundable} "
                    "remaining refundable on this order."
                )
            }
        )

    # Commission reversal: calculate proportional reversal of snapshotted commission
    ratio = amount / order_total if order_total > 0 else Decimal("0.00")
    commission_reversed = (seller_order.commission_total * ratio).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    commission_reversed = min(commission_reversed, seller_order.commission_total)
    seller_deduction = (amount - commission_reversed).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    ensure_seller_balance(access.seller.pk)

    refund_entry = record_ledger_entry(
        seller_id=access.seller.pk,
        entry_type=SellerLedgerEntry.EntryType.REFUND,
        amount=-amount,
        description=f"Customer refund on {seller_order.seller_order_number}: {cleaned_reason}",
        seller_order=seller_order,
        payment_reference=seller_order.order.order_number if seller_order.order else "",
    )

    comm_reversal_entry = record_ledger_entry(
        seller_id=access.seller.pk,
        entry_type=SellerLedgerEntry.EntryType.COMMISSION,
        amount=commission_reversed,
        description=(
            f"Marketplace commission reversal for refund on {seller_order.seller_order_number}"
        ),
        seller_order=seller_order,
        payment_reference=seller_order.order.order_number if seller_order.order else "",
    )

    refund_number = f"REF-{uuid4().hex[:10].upper()}"

    refund = Refund.objects.create(
        refund_number=refund_number,
        seller_order=seller_order,
        seller=access.seller,
        return_request=return_request,
        amount=amount,
        currency=seller_order.order.currency if seller_order.order else "USD",
        status=Refund.Status.COMPLETED,
        reason=cleaned_reason,
        commission_reversed=commission_reversed,
        seller_deduction=seller_deduction,
        created_by=actor if actor and actor.is_authenticated else None,
        completed_at=timezone.now(),
    )

    RefundTransaction.objects.create(
        refund=refund,
        transaction_type="PAYMENT_REVERSAL",
        amount=amount,
        gateway_reference=f"GW-{uuid4().hex[:8].upper()}",
        status="SUCCESS",
        raw_response={
            "ledger_entry_id": str(refund_entry.pk),
            "comm_entry_id": str(comm_reversal_entry.pk),
        },
    )

    if return_request:
        old_status = return_request.status
        return_request.status = ReturnRequest.Status.REFUNDED
        return_request.closed_at = timezone.now()
        return_request.save(update_fields=["status", "closed_at", "updated_at"])

        ReturnStatusHistory.objects.create(
            return_request=return_request,
            actor_id=actor.id if actor and actor.is_authenticated else None,
            from_status=old_status,
            to_status=ReturnRequest.Status.REFUNDED,
            notes=f"Refund {refund_number} processed for {amount}.",
        )

    if (total_refunded + amount) >= order_total and seller_order.order:
        seller_order.order.payment_status = Order.PaymentStatus.REFUNDED
        seller_order.order.save(update_fields=["payment_status", "updated_at"])

    record(
        actor=actor,
        seller=access.seller,
        action="fulfillment.refund.process",
        target_type="refund",
        target_id=refund.pk,
        changes={
            "amount": str(amount),
            "commission_reversed": str(commission_reversed),
            "seller_deduction": str(seller_deduction),
        },
    )

    return refund


@transaction.atomic
def process_platform_refund(
    *,
    actor: Any,
    seller_order_id: UUID,
    amount: Decimal,
    reason: str,
    return_request_id: UUID | None = None,
) -> Refund:
    if not PlatformAccess.objects.filter(
        user=actor,
        is_active=True,
        role__permissions__code="platform.refunds.manage",
    ).exists():
        raise PermissionDenied("Platform refunds capability required.")

    seller_order = get_object_or_404(
        SellerOrder.objects.select_for_update(),
        pk=seller_order_id,
    )

    if amount <= Decimal("0.00"):
        raise ValidationError({"amount": "Refund amount must be positive."})

    cleaned_reason = reason.strip()
    if not cleaned_reason:
        raise ValidationError({"reason": "Refund reason is required."})

    return_request = None
    if return_request_id:
        return_request = get_object_or_404(ReturnRequest, pk=return_request_id)
        if return_request.seller_order_id != seller_order.pk:
            raise ValidationError(
                {"return_request": "Return request does not belong to this seller order."}
            )

    order_total = (
        seller_order.subtotal
        + seller_order.tax_total
        + seller_order.shipping_total
        - seller_order.discount_total
    ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    total_refunded = sum(
        Refund.objects.filter(
            seller_order=seller_order,
            status=Refund.Status.COMPLETED,
        ).values_list("amount", flat=True)
    )
    remaining_refundable = order_total - total_refunded

    if amount > remaining_refundable:
        raise ValidationError(
            {
                "amount": (
                    f"Cannot refund {amount}; only {remaining_refundable} "
                    "remaining refundable on this order."
                )
            }
        )

    ratio = amount / order_total if order_total > 0 else Decimal("0.00")
    commission_reversed = (seller_order.commission_total * ratio).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    commission_reversed = min(commission_reversed, seller_order.commission_total)
    seller_deduction = (amount - commission_reversed).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    ensure_seller_balance(seller_order.seller_id)

    refund_entry = record_ledger_entry(
        seller_id=seller_order.seller_id,
        entry_type=SellerLedgerEntry.EntryType.REFUND,
        amount=-amount,
        description=f"Platform refund on {seller_order.seller_order_number}: {cleaned_reason}",
        seller_order=seller_order,
        payment_reference=seller_order.order.order_number if seller_order.order else "",
    )

    comm_reversal_entry = record_ledger_entry(
        seller_id=seller_order.seller_id,
        entry_type=SellerLedgerEntry.EntryType.COMMISSION,
        amount=commission_reversed,
        description=(
            f"Platform commission reversal for refund on {seller_order.seller_order_number}"
        ),
        seller_order=seller_order,
        payment_reference=seller_order.order.order_number if seller_order.order else "",
    )

    refund_number = f"REF-{uuid4().hex[:10].upper()}"

    refund = Refund.objects.create(
        refund_number=refund_number,
        seller_order=seller_order,
        seller=seller_order.seller,
        return_request=return_request,
        amount=amount,
        currency=seller_order.order.currency if seller_order.order else "USD",
        status=Refund.Status.COMPLETED,
        reason=cleaned_reason,
        commission_reversed=commission_reversed,
        seller_deduction=seller_deduction,
        created_by=actor,
        completed_at=timezone.now(),
    )

    RefundTransaction.objects.create(
        refund=refund,
        transaction_type="PAYMENT_REVERSAL",
        amount=amount,
        gateway_reference=f"GW-{uuid4().hex[:8].upper()}",
        status="SUCCESS",
        raw_response={
            "ledger_entry_id": str(refund_entry.pk),
            "comm_entry_id": str(comm_reversal_entry.pk),
        },
    )

    if return_request:
        old_status = return_request.status
        return_request.status = ReturnRequest.Status.REFUNDED
        return_request.closed_at = timezone.now()
        return_request.save(update_fields=["status", "closed_at", "updated_at"])

        ReturnStatusHistory.objects.create(
            return_request=return_request,
            actor_id=actor.id,
            from_status=old_status,
            to_status=ReturnRequest.Status.REFUNDED,
            notes=f"Platform refund {refund_number} processed for {amount}.",
        )

    if (total_refunded + amount) >= order_total and seller_order.order:
        seller_order.order.payment_status = Order.PaymentStatus.REFUNDED
        seller_order.order.save(update_fields=["payment_status", "updated_at"])

    return refund
