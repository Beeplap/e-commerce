from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any
from uuid import UUID

from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError

from apps.catalog.models import ProductVariant
from apps.inventory.models import Inventory, Warehouse
from apps.inventory.services import (
    consume_order_inventory,
    release_order_inventory,
    reserve_order_inventory,
)
from apps.orders.models import Order, OrderItem, OrderStatusHistory, SellerOrder
from apps.sellers.lifecycle_services import lock_seller_access, record
from apps.sellers.models import Seller

User = get_user_model()


def sync_parent_order_fulfillment_status(order: Order) -> None:
    statuses = set(order.seller_orders.values_list("status", flat=True))
    if not statuses:
        return
    if statuses == {SellerOrder.Status.DELIVERED}:
        order.fulfillment_status = Order.FulfillmentStatus.FULFILLED
    elif statuses == {SellerOrder.Status.CANCELLED}:
        order.fulfillment_status = Order.FulfillmentStatus.CANCELLED
    elif any(s in [SellerOrder.Status.SHIPPED, SellerOrder.Status.DELIVERED] for s in statuses):
        order.fulfillment_status = Order.FulfillmentStatus.PARTIALLY_FULFILLED
    else:
        order.fulfillment_status = Order.FulfillmentStatus.UNFULFILLED
    order.save(update_fields=["fulfillment_status", "updated_at"])


@transaction.atomic
def create_order(
    *,
    actor: Any = None,
    customer: Any = None,
    customer_email: str,
    currency: str,
    items_data: list[dict[str, Any]],
    billing_address: dict[str, Any],
    shipping_address: dict[str, Any],
    order_number: str | None = None,
) -> Order:
    if not items_data:
        raise ValidationError({"items": "Order must contain at least one item."})

    cleaned_currency = currency.strip().upper()
    if len(cleaned_currency) != 3:
        raise ValidationError({"currency": "Currency must be a 3-letter code."})

    if not customer_email or "@" not in customer_email:
        raise ValidationError({"customer_email": "A valid customer email is required."})

    # Group items by seller
    seller_items_map: dict[Seller, list[dict[str, Any]]] = {}

    for idx, item_input in enumerate(items_data):
        variant_id = item_input.get("variant_id")
        warehouse_id = item_input.get("warehouse_id")
        quantity = item_input.get("quantity")

        if not variant_id:
            raise ValidationError({f"items[{idx}].variant_id": "Variant is required."})
        if not warehouse_id:
            raise ValidationError({f"items[{idx}].warehouse_id": "Warehouse is required."})
        if not isinstance(quantity, int) or quantity <= 0:
            raise ValidationError(
                {f"items[{idx}].quantity": "Quantity must be a positive integer."}
            )

        variant = get_object_or_404(
            ProductVariant.objects.select_related("product", "product__seller"),
            pk=variant_id,
        )
        if variant.status != ProductVariant.Status.ACTIVE or variant.product.status != "active":
            raise ValidationError(
                {
                    f"items[{idx}].variant_id": (
                        f"Variant {variant.sku} is not active or available for sale."
                    )
                }
            )

        warehouse = get_object_or_404(
            Warehouse.objects.select_related("seller"),
            pk=warehouse_id,
        )
        if not warehouse.is_active:
            raise ValidationError(
                {f"items[{idx}].warehouse_id": f"Warehouse {warehouse.code} is inactive."}
            )

        if variant.product.seller_id != warehouse.seller_id:
            raise ValidationError(
                {f"items[{idx}]": "Variant and warehouse must belong to the same seller."}
            )

        seller = variant.product.seller
        if seller.status != Seller.Status.ACTIVE:
            raise ValidationError({f"items[{idx}]": f"Seller {seller.display_name} is not active."})

        unit_price = Decimal(str(item_input.get("unit_price", variant.price)))
        if unit_price < 0:
            raise ValidationError({f"items[{idx}].unit_price": "Unit price cannot be negative."})

        discount_amount = Decimal(str(item_input.get("discount_amount", "0.00")))
        if discount_amount < 0:
            raise ValidationError(
                {f"items[{idx}].discount_amount": "Discount amount cannot be negative."}
            )

        tax_amount = Decimal(str(item_input.get("tax_amount", "0.00")))
        if tax_amount < 0:
            raise ValidationError({f"items[{idx}].tax_amount": "Tax amount cannot be negative."})

        commission_amount = Decimal(str(item_input.get("commission_amount", "0.00")))
        if commission_amount < 0:
            raise ValidationError(
                {f"items[{idx}].commission_amount": "Commission amount cannot be negative."}
            )

        total = (unit_price * quantity) - discount_amount + tax_amount
        if total < 0:
            raise ValidationError({f"items[{idx}].total": "Total amount cannot be negative."})

        seller_net_amount = total - commission_amount
        if seller_net_amount < 0:
            raise ValidationError(
                {f"items[{idx}].seller_net_amount": "Seller net amount cannot be negative."}
            )

        # Ensure inventory record exists
        inventory = get_object_or_404(
            Inventory.objects.select_for_update(),
            warehouse=warehouse,
            variant=variant,
        )

        if seller not in seller_items_map:
            seller_items_map[seller] = []

        variant_snapshot = {
            "sku": variant.sku,
            "barcode": variant.barcode,
            "length": str(variant.length) if variant.length else None,
            "width": str(variant.width) if variant.width else None,
            "height": str(variant.height) if variant.height else None,
            "weight": str(variant.weight) if variant.weight else None,
        }

        seller_items_map[seller].append(
            {
                "variant": variant,
                "product": variant.product,
                "warehouse": warehouse,
                "inventory": inventory,
                "product_name_snapshot": variant.product.name,
                "sku_snapshot": variant.sku,
                "variant_snapshot": variant_snapshot,
                "quantity": quantity,
                "unit_price": unit_price,
                "discount_amount": discount_amount,
                "tax_amount": tax_amount,
                "total": total,
                "commission_amount": commission_amount,
                "seller_net_amount": seller_net_amount,
            }
        )

    # Generate order number
    generated_order_number = order_number or f"ORD-{uuid.uuid4().hex[:8].upper()}"

    parent_order = Order.objects.create(
        order_number=generated_order_number,
        customer=customer if (customer and customer.is_authenticated) else None,
        customer_email=customer_email,
        currency=cleaned_currency,
        subtotal=Decimal("0.00"),
        discount_total=Decimal("0.00"),
        tax_total=Decimal("0.00"),
        shipping_total=Decimal("0.00"),
        grand_total=Decimal("0.00"),
        payment_status=Order.PaymentStatus.PENDING,
        fulfillment_status=Order.FulfillmentStatus.UNFULFILLED,
        billing_address_snapshot=billing_address or {},
        shipping_address_snapshot=shipping_address or {},
    )

    grand_subtotal = Decimal("0.00")
    grand_discount = Decimal("0.00")
    grand_tax = Decimal("0.00")
    grand_shipping = Decimal("0.00")

    for seller, items in seller_items_map.items():
        so_subtotal = sum(
            (item["unit_price"] * item["quantity"] for item in items), Decimal("0.00")
        )
        so_discount = sum((item["discount_amount"] for item in items), Decimal("0.00"))
        so_tax = sum((item["tax_amount"] for item in items), Decimal("0.00"))
        so_shipping = Decimal("0.00")
        so_commission = sum((item["commission_amount"] for item in items), Decimal("0.00"))
        so_net = sum((item["seller_net_amount"] for item in items), Decimal("0.00"))

        seller_order_number = f"SO-{generated_order_number}-{seller.slug[:6].upper()}"
        if SellerOrder.objects.filter(seller_order_number=seller_order_number).exists():
            seller_order_number = f"SO-{generated_order_number}-{uuid.uuid4().hex[:4].upper()}"

        seller_order = SellerOrder.objects.create(
            order=parent_order,
            seller=seller,
            seller_order_number=seller_order_number,
            subtotal=so_subtotal,
            discount_total=so_discount,
            tax_total=so_tax,
            shipping_total=so_shipping,
            commission_total=so_commission,
            seller_net_total=so_net,
            status=SellerOrder.Status.PENDING,
        )

        for item in items:
            OrderItem.objects.create(
                seller_order=seller_order,
                product=item["product"],
                variant=item["variant"],
                warehouse=item["warehouse"],
                product_name_snapshot=item["product_name_snapshot"],
                sku_snapshot=item["sku_snapshot"],
                variant_snapshot=item["variant_snapshot"],
                quantity=item["quantity"],
                unit_price=item["unit_price"],
                discount_amount=item["discount_amount"],
                tax_amount=item["tax_amount"],
                total=item["total"],
                commission_amount=item["commission_amount"],
                seller_net_amount=item["seller_net_amount"],
            )

            # Reserve inventory atomically
            reserve_order_inventory(
                inventory_id=item["inventory"].pk,
                quantity=item["quantity"],
                reference_id=str(seller_order.pk),
                reason=f"Order reservation for {seller_order.seller_order_number}",
                actor=actor,
            )

        OrderStatusHistory.objects.create(
            seller_order=seller_order,
            actor_id=actor.id if actor else None,
            from_status="none",
            to_status=SellerOrder.Status.PENDING,
            notes="Order placed and inventory reserved.",
        )

        if actor is not None and getattr(actor, "is_authenticated", False):
            record(
                actor=actor,
                seller=seller,
                action="order.created",
                target_type="seller_order",
                target_id=seller_order.id,
                changes={
                    "order_number": parent_order.order_number,
                    "seller_order_number": seller_order.seller_order_number,
                },
            )

        grand_subtotal += so_subtotal
        grand_discount += so_discount
        grand_tax += so_tax
        grand_shipping += so_shipping

    parent_order.subtotal = grand_subtotal
    parent_order.discount_total = grand_discount
    parent_order.tax_total = grand_tax
    parent_order.shipping_total = grand_shipping
    parent_order.grand_total = grand_subtotal - grand_discount + grand_tax + grand_shipping
    parent_order.save(
        update_fields=[
            "subtotal",
            "discount_total",
            "tax_total",
            "shipping_total",
            "grand_total",
            "updated_at",
        ]
    )

    from apps.events.services import publish_outbox_event

    publish_outbox_event(
        topic="orders.order.created",
        event_key=str(parent_order.pk),
        payload={
            "order_id": str(parent_order.pk),
            "order_number": parent_order.order_number,
            "currency": parent_order.currency,
            "grand_total": str(parent_order.grand_total),
            "customer_email": parent_order.customer_email,
        },
    )

    return parent_order


@transaction.atomic
def confirm_seller_order(
    *,
    seller_id: UUID,
    actor: Any,
    seller_order_id: UUID,
) -> SellerOrder:
    access = lock_seller_access(actor, seller_id, "orders.update")
    seller_order = get_object_or_404(
        SellerOrder.objects.select_for_update().filter(seller=access.seller),
        pk=seller_order_id,
    )

    if seller_order.status != SellerOrder.Status.PENDING:
        raise ValidationError(
            {
                "status": (
                    f"Cannot confirm order in status '{seller_order.status}'. "
                    "Only pending orders can be confirmed."
                )
            }
        )

    old_status = seller_order.status
    seller_order.status = SellerOrder.Status.CONFIRMED
    seller_order.save(update_fields=["status", "updated_at"])

    OrderStatusHistory.objects.create(
        seller_order=seller_order,
        actor_id=actor.id,
        from_status=old_status,
        to_status=SellerOrder.Status.CONFIRMED,
        notes="Order confirmed by seller.",
    )

    record(
        actor=actor,
        seller=access.seller,
        action="order.confirmed",
        target_type="seller_order",
        target_id=seller_order.id,
        changes={"from_status": old_status, "to_status": SellerOrder.Status.CONFIRMED},
    )

    from apps.events.services import publish_outbox_event

    publish_outbox_event(
        topic="orders.seller_order.confirmed",
        event_key=str(seller_order.pk),
        payload={
            "seller_order_id": str(seller_order.pk),
            "seller_id": str(seller_order.seller_id),
            "order_id": str(seller_order.order_id),
            "seller_order_number": seller_order.seller_order_number,
            "status": seller_order.status,
        },
    )

    return seller_order


@transaction.atomic
def begin_processing_seller_order(
    *,
    seller_id: UUID,
    actor: Any,
    seller_order_id: UUID,
) -> SellerOrder:
    access = lock_seller_access(actor, seller_id, "orders.update")
    seller_order = get_object_or_404(
        SellerOrder.objects.select_for_update().filter(seller=access.seller),
        pk=seller_order_id,
    )

    if seller_order.status != SellerOrder.Status.CONFIRMED:
        raise ValidationError(
            {
                "status": (
                    f"Cannot begin processing order in status '{seller_order.status}'. "
                    "Order must be confirmed first."
                )
            }
        )

    old_status = seller_order.status
    seller_order.status = SellerOrder.Status.PROCESSING
    seller_order.save(update_fields=["status", "updated_at"])

    OrderStatusHistory.objects.create(
        seller_order=seller_order,
        actor_id=actor.id,
        from_status=old_status,
        to_status=SellerOrder.Status.PROCESSING,
        notes="Order processing initiated.",
    )

    record(
        actor=actor,
        seller=access.seller,
        action="order.processing",
        target_type="seller_order",
        target_id=seller_order.id,
        changes={"from_status": old_status, "to_status": SellerOrder.Status.PROCESSING},
    )

    return seller_order


@transaction.atomic
def ship_seller_order(
    *,
    seller_id: UUID,
    actor: Any,
    seller_order_id: UUID,
    tracking_number: str = "",
    carrier: str = "",
) -> SellerOrder:
    access = lock_seller_access(actor, seller_id, "orders.update")
    seller_order = get_object_or_404(
        SellerOrder.objects.select_for_update().filter(seller=access.seller),
        pk=seller_order_id,
    )

    if seller_order.status != SellerOrder.Status.PROCESSING:
        raise ValidationError(
            {
                "status": (
                    f"Cannot ship order in status '{seller_order.status}'. "
                    "Order must be in processing."
                )
            }
        )

    # Consume reserved inventory for all items
    for item in seller_order.items.select_related("variant", "warehouse"):
        if item.warehouse and item.variant:
            inventory = get_object_or_404(
                Inventory.objects.select_for_update(),
                warehouse=item.warehouse,
                variant=item.variant,
            )
            consume_order_inventory(
                inventory_id=inventory.pk,
                quantity=item.quantity,
                reference_id=str(seller_order.pk),
                reason=f"Shipped {seller_order.seller_order_number}",
                actor=actor,
            )

    old_status = seller_order.status
    seller_order.status = SellerOrder.Status.SHIPPED
    seller_order.save(update_fields=["status", "updated_at"])

    notes = ""
    if carrier or tracking_number:
        notes = f"Carrier: {carrier.strip()}, Tracking: {tracking_number.strip()}".strip(", ")

    OrderStatusHistory.objects.create(
        seller_order=seller_order,
        actor_id=actor.id,
        from_status=old_status,
        to_status=SellerOrder.Status.SHIPPED,
        notes=notes or "Order shipped.",
    )

    sync_parent_order_fulfillment_status(seller_order.order)

    record(
        actor=actor,
        seller=access.seller,
        action="order.shipped",
        target_type="seller_order",
        target_id=seller_order.id,
        changes={
            "from_status": old_status,
            "to_status": SellerOrder.Status.SHIPPED,
            "carrier": carrier,
            "tracking_number": tracking_number,
        },
    )

    from apps.events.services import publish_outbox_event

    publish_outbox_event(
        topic="orders.seller_order.shipped",
        event_key=str(seller_order.pk),
        payload={
            "seller_order_id": str(seller_order.pk),
            "seller_id": str(seller_order.seller_id),
            "order_id": str(seller_order.order_id),
            "carrier": carrier or "",
            "tracking_number": tracking_number or "",
            "status": seller_order.status,
        },
    )

    return seller_order


@transaction.atomic
def deliver_seller_order(
    *,
    seller_id: UUID,
    actor: Any,
    seller_order_id: UUID,
) -> SellerOrder:
    access = lock_seller_access(actor, seller_id, "orders.update")
    seller_order = get_object_or_404(
        SellerOrder.objects.select_for_update().filter(seller=access.seller),
        pk=seller_order_id,
    )

    if seller_order.status != SellerOrder.Status.SHIPPED:
        raise ValidationError(
            {
                "status": (
                    f"Cannot deliver order in status '{seller_order.status}'. "
                    "Order must be shipped first."
                )
            }
        )

    old_status = seller_order.status
    seller_order.status = SellerOrder.Status.DELIVERED
    seller_order.save(update_fields=["status", "updated_at"])

    OrderStatusHistory.objects.create(
        seller_order=seller_order,
        actor_id=actor.id,
        from_status=old_status,
        to_status=SellerOrder.Status.DELIVERED,
        notes="Order delivered to customer.",
    )

    sync_parent_order_fulfillment_status(seller_order.order)

    record(
        actor=actor,
        seller=access.seller,
        action="order.delivered",
        target_type="seller_order",
        target_id=seller_order.id,
        changes={"from_status": old_status, "to_status": SellerOrder.Status.DELIVERED},
    )

    return seller_order


@transaction.atomic
def cancel_seller_order(
    *,
    seller_id: UUID,
    actor: Any,
    seller_order_id: UUID,
    reason: str,
) -> SellerOrder:
    access = lock_seller_access(actor, seller_id, "orders.cancel")

    cleaned_reason = reason.strip() if reason else ""
    if not cleaned_reason:
        raise ValidationError({"reason": "A cancellation reason is required."})

    seller_order = get_object_or_404(
        SellerOrder.objects.select_for_update().filter(seller=access.seller),
        pk=seller_order_id,
    )

    if seller_order.status not in [SellerOrder.Status.PENDING, SellerOrder.Status.CONFIRMED]:
        raise ValidationError(
            {
                "status": (
                    f"Cannot cancel order in status '{seller_order.status}'. "
                    "Only pending or confirmed orders can be cancelled."
                )
            }
        )

    # Release reserved inventory for all items
    for item in seller_order.items.select_related("variant", "warehouse"):
        if item.warehouse and item.variant:
            inventory = get_object_or_404(
                Inventory.objects.select_for_update(),
                warehouse=item.warehouse,
                variant=item.variant,
            )
            release_order_inventory(
                inventory_id=inventory.pk,
                quantity=item.quantity,
                reference_id=str(seller_order.pk),
                reason=f"Cancelled {seller_order.seller_order_number}: {cleaned_reason}",
                actor=actor,
            )

    old_status = seller_order.status
    seller_order.status = SellerOrder.Status.CANCELLED
    seller_order.save(update_fields=["status", "updated_at"])

    OrderStatusHistory.objects.create(
        seller_order=seller_order,
        actor_id=actor.id,
        from_status=old_status,
        to_status=SellerOrder.Status.CANCELLED,
        notes=cleaned_reason,
    )

    sync_parent_order_fulfillment_status(seller_order.order)

    record(
        actor=actor,
        seller=access.seller,
        action="order.cancelled",
        target_type="seller_order",
        target_id=seller_order.id,
        changes={
            "from_status": old_status,
            "to_status": SellerOrder.Status.CANCELLED,
            "reason": cleaned_reason,
        },
    )

    return seller_order
