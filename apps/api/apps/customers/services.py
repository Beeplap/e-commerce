from __future__ import annotations

from typing import Any
from uuid import UUID

from django.contrib.auth import get_user_model
from django.core.validators import validate_email
from django.db import transaction
from django.db.models import QuerySet
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError

from apps.accounts.models import UserManager
from apps.customers.models import CustomerProfile
from apps.fulfillment.models import ReturnRequest
from apps.fulfillment.services import create_return_request
from apps.inventory.models import Inventory
from apps.inventory.services import release_order_inventory
from apps.orders.models import Order, OrderItem, OrderStatusHistory, SellerOrder
from apps.reviews.models import ProductReview
from apps.reviews.services import submit_product_review

User = get_user_model()


def get_customer_profile(user: Any) -> dict[str, Any]:
    profile, _ = CustomerProfile.objects.get_or_create(user=user)
    return {
        "id": str(user.id),
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "phone": profile.phone,
        "is_email_verified": user.is_email_verified,
        "created_at": user.created_at,
    }


@transaction.atomic
def update_customer_profile(user: Any, data: dict[str, Any]) -> dict[str, Any]:
    update_fields: list[str] = ["updated_at"]

    if "first_name" in data:
        user.first_name = data["first_name"].strip()
        update_fields.append("first_name")

    if "last_name" in data:
        user.last_name = data["last_name"].strip()
        update_fields.append("last_name")

    if "email" in data:
        new_email = UserManager.normalize_email(data["email"])
        validate_email(new_email)
        if User.objects.exclude(pk=user.pk).filter(email=new_email).exists():
            raise ValidationError({"email": ["This email is already in use."]})
        user.email = new_email
        update_fields.append("email")

    user.save(update_fields=update_fields)

    profile, _ = CustomerProfile.objects.get_or_create(user=user)
    if "phone" in data:
        profile.phone = data["phone"].strip()
        profile.save(update_fields=["phone", "updated_at"])

    return get_customer_profile(user)


def list_customer_orders(user: Any) -> QuerySet[Order]:
    return (
        Order.objects.filter(customer=user)
        .prefetch_related(
            "seller_orders__items__variant__product",
            "seller_orders__seller",
        )
        .order_by("-created_at")
    )


def get_customer_order(user: Any, order_id: UUID) -> Order:
    return get_object_or_404(
        Order.objects.filter(customer=user).prefetch_related(
            "seller_orders__items__variant__product",
            "seller_orders__shipments__tracking_events",
            "seller_orders__seller",
        ),
        pk=order_id,
    )


@transaction.atomic
def cancel_customer_order(user: Any, order_id: UUID, reason: str = "") -> Order:
    order = get_object_or_404(
        Order.objects.select_for_update(),
        pk=order_id,
        customer=user,
    )

    if order.fulfillment_status == Order.FulfillmentStatus.CANCELLED:
        raise ValidationError({"detail": "This order is already cancelled."})

    if order.payment_status != Order.PaymentStatus.PENDING:
        raise ValidationError(
            {"detail": "Only pending, unpaid orders can be cancelled by the customer."}
        )

    seller_orders = list(order.seller_orders.select_for_update())
    for seller_order in seller_orders:
        if seller_order.inventory_committed or seller_order.status != SellerOrder.Status.PENDING:
            raise ValidationError(
                {"detail": "Order cannot be cancelled as it is already being processed."}
            )

    order.fulfillment_status = Order.FulfillmentStatus.CANCELLED
    order.save(update_fields=["fulfillment_status", "updated_at"])

    clean_reason = reason.strip() or "Customer cancelled order."

    for seller_order in seller_orders:
        old_status = seller_order.status
        seller_order.status = SellerOrder.Status.CANCELLED
        seller_order.save(update_fields=["status", "updated_at"])

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
                    reason=f"Customer cancelled {seller_order.seller_order_number}: {clean_reason}",
                    actor=user,
                )

        OrderStatusHistory.objects.create(
            seller_order=seller_order,
            actor_id=user.id,
            from_status=old_status,
            to_status=SellerOrder.Status.CANCELLED,
            notes=clean_reason,
        )

    # Publish cancellation outbox event
    from apps.events.services import publish_outbox_event

    publish_outbox_event(
        topic="orders.order.cancelled",
        event_key=str(order.pk),
        payload={
            "order_id": str(order.pk),
            "customer_id": str(user.pk),
            "reason": clean_reason,
        },
    )

    return order


def submit_customer_review(
    *,
    customer: Any,
    order_item_id: UUID,
    rating: int,
    title: str,
    body: str,
) -> ProductReview:
    order_item = get_object_or_404(
        OrderItem.objects.select_related("seller_order__order"),
        pk=order_item_id,
        seller_order__order__customer=customer,
    )

    if order_item.seller_order.status != SellerOrder.Status.DELIVERED:
        raise ValidationError(
            {"detail": "Reviews can only be submitted for delivered order items."}
        )

    if order_item.product_id is None:
        raise ValidationError({"detail": "This item is no longer linked to a product."})

    return submit_product_review(
        customer=customer,
        product_id=order_item.product_id,
        rating=rating,
        title=title,
        body=body,
        order_item_id=order_item.id,
    )


def submit_customer_return(
    *,
    customer: Any,
    order_item_id: UUID,
    quantity: int,
    reason: str,
    customer_notes: str = "",
) -> ReturnRequest:
    order_item = get_object_or_404(
        OrderItem.objects.select_related("seller_order__order", "seller_order__seller"),
        pk=order_item_id,
        seller_order__order__customer=customer,
    )

    if order_item.seller_order.status not in (
        SellerOrder.Status.SHIPPED,
        SellerOrder.Status.DELIVERED,
    ):
        raise ValidationError(
            {"detail": "Returns can only be requested for shipped or delivered items."}
        )

    return create_return_request(
        actor=customer,
        seller_order_id=order_item.seller_order_id,
        reason=reason,
        customer_notes=customer_notes,
        items_data=[
            {
                "order_item_id": order_item.id,
                "quantity": quantity,
                "reason": reason,
            }
        ],
    )
