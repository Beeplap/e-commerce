from dataclasses import dataclass
from uuid import UUID

from django.contrib.auth.models import AnonymousUser
from django.core.exceptions import FieldDoesNotExist
from django.db import models
from django.db.models import Q
from rest_framework.exceptions import NotFound, PermissionDenied

from apps.accounts.models import User
from apps.sellers.models import Seller, SellerMembership, SellerRole

ACCESSIBLE_STATUSES = (Seller.Status.PENDING, Seller.Status.ACTIVE)


@dataclass(frozen=True)
class SellerAccess:
    membership: SellerMembership
    permissions: tuple[str, ...]

    @property
    def seller(self) -> Seller:
        return self.membership.seller


def accessible_memberships(user: User | AnonymousUser) -> models.QuerySet[SellerMembership]:
    query = SellerMembership.objects.select_related("seller", "role").prefetch_related(
        "role__permissions"
    )
    if not user.is_authenticated:
        return query.none()
    return query.filter(
        Q(role__seller__isnull=True, role__is_system=True)
        | Q(role__seller_id=models.F("seller_id")),
        user_id=user.pk,
        user__is_active=True,
        status=SellerMembership.Status.ACTIVE,
        seller__status__in=ACCESSIBLE_STATUSES,
    ).order_by("seller__display_name", "seller_id")


def membership_access(membership: SellerMembership) -> SellerAccess:
    return SellerAccess(
        membership=membership,
        permissions=tuple(
            sorted(permission.code for permission in membership.role.permissions.all())
        ),
    )


def require_seller_access(
    user: User | AnonymousUser,
    seller_id: UUID,
    capability: str | None = None,
    *,
    allow_pending: bool = False,
) -> SellerAccess:
    # The identifier selects a tenant; membership and current database state grant access.
    memberships = accessible_memberships(user).filter(seller_id=seller_id)
    if not allow_pending:
        memberships = memberships.filter(seller__status=Seller.Status.ACTIVE)
    membership = memberships.first()
    if membership is None:
        raise NotFound("Seller not found.")
    access = membership_access(membership)
    if capability is not None and capability not in access.permissions:
        raise PermissionDenied("You do not have the required seller permission.")
    return access


def tenant_queryset[TenantModel: models.Model](
    *, user: User | AnonymousUser, seller_id: UUID, capability: str, model: type[TenantModel]
) -> models.QuerySet[TenantModel]:
    """Use for reads, writes and related-object resolution; reauthorize every invocation."""
    require_seller_access(user, seller_id, capability)
    try:
        field = model._meta.get_field("seller")
    except FieldDoesNotExist as error:
        raise TypeError("Tenant querysets require a direct Seller foreign key.") from error
    if not isinstance(field, models.ForeignKey) or field.related_model is not Seller:
        raise TypeError("Tenant querysets require a direct Seller foreign key.")
    return model._default_manager.filter(seller_id=seller_id)


def assignable_roles(seller_id: UUID) -> models.QuerySet[SellerRole]:
    return SellerRole.objects.filter(
        Q(seller__isnull=True, is_system=True) | Q(seller_id=seller_id, is_system=False)
    ).prefetch_related("permissions")
