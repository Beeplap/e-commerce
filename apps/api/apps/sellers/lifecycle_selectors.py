from typing import Any
from uuid import UUID

from django.contrib.auth.models import AnonymousUser
from django.db.models import Q, QuerySet
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied

from apps.accounts.models import User
from apps.platform_access.selectors import has_platform_permission
from apps.sellers.models import Seller, SellerDocument
from apps.sellers.selectors import require_seller_access, tenant_queryset


def require_platform(actor: User | AnonymousUser, capability: str) -> None:
    if not has_platform_permission(actor, capability):
        raise PermissionDenied("You do not have the required platform permission.")


def seller_detail(
    actor: User | AnonymousUser, seller_id: UUID, *, platform: bool = False
) -> Seller:
    if platform:
        require_platform(actor, "platform.sellers.read")
    else:
        require_seller_access(actor, seller_id, "seller.settings.read", allow_pending=True)
    return get_object_or_404(
        Seller.objects.select_related("profile", "settings").prefetch_related("addresses"),
        pk=seller_id,
    )


def platform_sellers(actor: User | AnonymousUser, filters: dict[str, Any]) -> QuerySet[Seller]:
    require_platform(actor, "platform.sellers.read")
    query = Seller.objects.all()
    if search := filters.get("search"):
        query = query.filter(
            Q(display_name__icontains=search)
            | Q(legal_name__icontains=search)
            | Q(email__icontains=search)
        )
    for field in ("status", "verification_status"):
        if value := filters.get(field):
            query = query.filter(**{field: value})
    return query.order_by("-created_at", "id")


def documents(
    actor: User | AnonymousUser, seller_id: UUID, *, platform: bool = False
) -> QuerySet[SellerDocument]:
    if platform:
        require_platform(actor, "platform.sellers.documents.read")
        get_object_or_404(Seller, pk=seller_id)
        return SellerDocument.objects.filter(seller_id=seller_id)
    return tenant_queryset(
        user=actor,
        seller_id=seller_id,
        capability="seller.settings.read",
        model=SellerDocument,
        allow_pending=True,
    )
