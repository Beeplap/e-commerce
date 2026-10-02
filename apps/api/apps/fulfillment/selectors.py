from __future__ import annotations

from uuid import UUID

from django.db.models import QuerySet
from django.shortcuts import get_object_or_404

from apps.fulfillment.models import (
    Refund,
    ReturnRequest,
    Shipment,
    ShippingMethod,
    ShippingRate,
    ShippingZone,
)

# -------------------------------------------------------------------------
# Seller Selectors
# -------------------------------------------------------------------------


def list_seller_shipments(
    seller_id: UUID,
    *,
    status: str | None = None,
    seller_order_id: UUID | None = None,
) -> QuerySet[Shipment]:
    qs = (
        Shipment.objects.filter(seller_id=seller_id)
        .select_related("seller_order", "shipping_method")
        .prefetch_related("items", "items__order_item", "tracking_events")
    )

    if status:
        qs = qs.filter(status=status)
    if seller_order_id:
        qs = qs.filter(seller_order_id=seller_order_id)
    return qs


def get_seller_shipment(seller_id: UUID, shipment_id: UUID) -> Shipment:
    return get_object_or_404(
        Shipment.objects.filter(seller_id=seller_id)
        .select_related("seller_order", "shipping_method")
        .prefetch_related("items", "items__order_item", "tracking_events"),
        pk=shipment_id,
    )


def list_seller_returns(
    seller_id: UUID,
    *,
    status: str | None = None,
    seller_order_id: UUID | None = None,
) -> QuerySet[ReturnRequest]:
    qs = (
        ReturnRequest.objects.filter(seller_id=seller_id)
        .select_related("seller_order", "customer")
        .prefetch_related("items", "items__order_item", "status_history")
    )

    if status:
        qs = qs.filter(status=status)
    if seller_order_id:
        qs = qs.filter(seller_order_id=seller_order_id)
    return qs


def get_seller_return(seller_id: UUID, return_id: UUID) -> ReturnRequest:
    return get_object_or_404(
        ReturnRequest.objects.filter(seller_id=seller_id)
        .select_related("seller_order", "customer")
        .prefetch_related("items", "items__order_item", "status_history"),
        pk=return_id,
    )


def list_seller_refunds(
    seller_id: UUID,
    *,
    status: str | None = None,
    seller_order_id: UUID | None = None,
) -> QuerySet[Refund]:
    qs = (
        Refund.objects.filter(seller_id=seller_id)
        .select_related("seller_order", "return_request", "created_by")
        .prefetch_related("transactions")
    )

    if status:
        qs = qs.filter(status=status)
    if seller_order_id:
        qs = qs.filter(seller_order_id=seller_order_id)
    return qs


def get_seller_refund(seller_id: UUID, refund_id: UUID) -> Refund:
    return get_object_or_404(
        Refund.objects.filter(seller_id=seller_id)
        .select_related("seller_order", "return_request", "created_by")
        .prefetch_related("transactions"),
        pk=refund_id,
    )


def list_seller_shipping_methods(seller_id: UUID) -> QuerySet[ShippingMethod]:
    return ShippingMethod.objects.filter(seller_id=seller_id, is_active=True)


def list_seller_shipping_zones(seller_id: UUID) -> QuerySet[ShippingZone]:
    return ShippingZone.objects.filter(seller_id=seller_id, is_active=True)


def list_seller_shipping_rates(seller_id: UUID) -> QuerySet[ShippingRate]:
    return ShippingRate.objects.filter(zone__seller_id=seller_id).select_related("zone", "method")


# -------------------------------------------------------------------------
# Platform Selectors
# -------------------------------------------------------------------------


def list_platform_shipments(
    *,
    status: str | None = None,
    seller_id: UUID | None = None,
) -> QuerySet[Shipment]:
    qs = (
        Shipment.objects.all()
        .select_related("seller", "seller_order", "shipping_method")
        .prefetch_related("items", "items__order_item", "tracking_events")
    )

    if status:
        qs = qs.filter(status=status)
    if seller_id:
        qs = qs.filter(seller_id=seller_id)
    return qs


def get_platform_shipment(shipment_id: UUID) -> Shipment:
    return get_object_or_404(
        Shipment.objects.all()
        .select_related("seller", "seller_order", "shipping_method")
        .prefetch_related("items", "items__order_item", "tracking_events"),
        pk=shipment_id,
    )


def list_platform_returns(
    *,
    status: str | None = None,
    seller_id: UUID | None = None,
) -> QuerySet[ReturnRequest]:
    qs = (
        ReturnRequest.objects.all()
        .select_related("seller", "seller_order", "customer")
        .prefetch_related("items", "items__order_item", "status_history")
    )

    if status:
        qs = qs.filter(status=status)
    if seller_id:
        qs = qs.filter(seller_id=seller_id)
    return qs


def get_platform_return(return_id: UUID) -> ReturnRequest:
    return get_object_or_404(
        ReturnRequest.objects.all()
        .select_related("seller", "seller_order", "customer")
        .prefetch_related("items", "items__order_item", "status_history"),
        pk=return_id,
    )


def list_platform_refunds(
    *,
    status: str | None = None,
    seller_id: UUID | None = None,
) -> QuerySet[Refund]:
    qs = (
        Refund.objects.all()
        .select_related("seller", "seller_order", "return_request", "created_by")
        .prefetch_related("transactions")
    )

    if status:
        qs = qs.filter(status=status)
    if seller_id:
        qs = qs.filter(seller_id=seller_id)
    return qs


def get_platform_refund(refund_id: UUID) -> Refund:
    return get_object_or_404(
        Refund.objects.all()
        .select_related("seller", "seller_order", "return_request", "created_by")
        .prefetch_related("transactions"),
        pk=refund_id,
    )
