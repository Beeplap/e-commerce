from __future__ import annotations

from typing import Any
from uuid import UUID

from django.db.models import QuerySet
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied

from apps.orders.models import Order, SellerOrder
from apps.platform_access.selectors import has_platform_permission
from apps.sellers.selectors import require_seller_access, tenant_queryset


def list_seller_orders(
    *,
    seller_id: UUID,
    actor: Any,
    status: str | None = None,
    search: str | None = None,
) -> QuerySet[SellerOrder]:
    require_seller_access(actor, seller_id, "orders.read")
    qs = (
        tenant_queryset(
            user=actor,
            seller_id=seller_id,
            capability="orders.read",
            model=SellerOrder,
        )
        .select_related("order")
        .prefetch_related("items")
    )

    if status:
        qs = qs.filter(status=status)
    if search:
        qs = qs.filter(seller_order_number__icontains=search.strip())

    return qs


def get_seller_order(
    *,
    seller_id: UUID,
    actor: Any,
    seller_order_id: UUID,
) -> SellerOrder:
    require_seller_access(actor, seller_id, "orders.read")
    return get_object_or_404(
        tenant_queryset(
            user=actor,
            seller_id=seller_id,
            capability="orders.read",
            model=SellerOrder,
        )
        .select_related("order", "seller")
        .prefetch_related(
            "items",
            "items__product",
            "items__variant",
            "items__warehouse",
            "status_history",
        ),
        pk=seller_order_id,
    )


def list_platform_orders(
    *,
    actor: Any,
    payment_status: str | None = None,
    fulfillment_status: str | None = None,
    search: str | None = None,
) -> QuerySet[Order]:
    if not has_platform_permission(actor, "platform.orders.read"):
        raise PermissionDenied("Platform order read capability is required.")

    qs = Order.objects.all().prefetch_related("seller_orders", "seller_orders__seller")

    if payment_status:
        qs = qs.filter(payment_status=payment_status)
    if fulfillment_status:
        qs = qs.filter(fulfillment_status=fulfillment_status)
    if search:
        cleaned_search = search.strip()
        qs = qs.filter(order_number__icontains=cleaned_search) | qs.filter(
            customer_email__icontains=cleaned_search
        )

    return qs


def get_platform_order(
    *,
    actor: Any,
    order_id: UUID,
) -> Order:
    if not has_platform_permission(actor, "platform.orders.read"):
        raise PermissionDenied("Platform order read capability is required.")

    return get_object_or_404(
        Order.objects.prefetch_related(
            "seller_orders",
            "seller_orders__seller",
            "seller_orders__items",
            "seller_orders__status_history",
        ),
        pk=order_id,
    )
