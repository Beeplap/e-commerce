from typing import Any
from uuid import UUID

from django.db import transaction
from django.db.models import Q
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.accounts.models import User
from apps.audit.models import AuditLog
from apps.sellers.models import (
    Seller,
    SellerMembership,
    SellerPermission,
    SellerRole,
    SellerRolePermission,
)
from apps.sellers.selectors import require_seller_access
from apps.sellers.services import authorize_role_assignment


def _log_audit(
    *,
    actor: User,
    seller: Seller,
    action: str,
    target_type: str,
    target_id: UUID,
    changes: dict[str, Any] | None = None,
    remote_ip: str | None = None,
) -> None:
    AuditLog.objects.create(
        actor_id=actor.pk,
        seller_id=seller.pk,
        action=action,
        target_type=target_type,
        target_id=target_id,
        changes=changes or {},
        remote_ip=remote_ip,
    )


@transaction.atomic
def invite_staff_member(
    *,
    actor: User,
    seller_id: UUID,
    email: str,
    role_id: UUID,
    remote_ip: str | None = None,
) -> SellerMembership:
    # Mutation lock order: actor -> seller -> roles/memberships
    locked_actor = User.objects.select_for_update().get(pk=actor.pk)
    try:
        seller = Seller.objects.select_for_update().get(pk=seller_id)
    except Seller.DoesNotExist:
        raise NotFound("Seller not found.") from None

    role = authorize_role_assignment(
        actor=locked_actor, seller_id=seller_id, role_id=role_id, capability="staff.invite"
    )

    clean_email = email.strip().lower()
    if not clean_email:
        raise ValidationError({"email": ["Email address is required."]})

    target_user = User.objects.filter(email=clean_email).first()
    if target_user is None:
        target_user = User.objects.create_user(email=clean_email, password=None)
        target_user.set_unusable_password()
        target_user.save(update_fields=["password"])

    existing_membership = SellerMembership.objects.filter(seller=seller, user=target_user).first()
    if existing_membership is not None:
        if existing_membership.status == SellerMembership.Status.ACTIVE:
            raise ValidationError({"email": ["User is already an active member of this seller."]})
        if existing_membership.status == SellerMembership.Status.INVITED:
            raise ValidationError({"email": ["An invitation is already pending for this user."]})
        # Re-invite suspended member
        existing_membership.role = role
        existing_membership.status = SellerMembership.Status.INVITED
        existing_membership.invited_by = locked_actor
        existing_membership.save(update_fields=["role", "status", "invited_by"])
        membership = existing_membership
    else:
        membership = SellerMembership.objects.create(
            seller=seller,
            user=target_user,
            role=role,
            status=SellerMembership.Status.INVITED,
            invited_by=locked_actor,
        )

    _log_audit(
        actor=locked_actor,
        seller=seller,
        action="seller.staff.invite",
        target_type="seller_membership",
        target_id=membership.pk,
        changes={"role": role.name, "invited_email": clean_email},
        remote_ip=remote_ip,
    )
    return membership


@transaction.atomic
def update_staff_role(
    *,
    actor: User,
    seller_id: UUID,
    membership_id: UUID,
    new_role_id: UUID,
    remote_ip: str | None = None,
) -> SellerMembership:
    locked_actor = User.objects.select_for_update().get(pk=actor.pk)
    try:
        seller = Seller.objects.select_for_update().get(pk=seller_id)
    except Seller.DoesNotExist:
        raise NotFound("Seller not found.") from None

    try:
        membership = (
            SellerMembership.objects.select_for_update()
            .select_related("role", "user")
            .get(pk=membership_id, seller=seller)
        )
    except SellerMembership.DoesNotExist:
        raise NotFound("Staff membership not found.") from None

    new_role = authorize_role_assignment(
        actor=locked_actor, seller_id=seller_id, role_id=new_role_id, capability="staff.update"
    )

    if membership.user_id == locked_actor.pk:
        raise PermissionDenied("You cannot modify your own staff role.")

    # Guard against demoting the last active owner
    if membership.role.is_owner and not new_role.is_owner:
        active_owners = (
            SellerMembership.objects.filter(
                seller=seller, role__is_owner=True, status=SellerMembership.Status.ACTIVE
            )
            .exclude(pk=membership.pk)
            .count()
        )
        if active_owners == 0:
            raise ValidationError({"role": ["Cannot demote the last active owner of the seller."]})

    old_role_name = membership.role.name
    membership.role = new_role
    membership.save(update_fields=["role"])

    _log_audit(
        actor=locked_actor,
        seller=seller,
        action="seller.staff.role_change",
        target_type="seller_membership",
        target_id=membership.pk,
        changes={"from_role": old_role_name, "to_role": new_role.name},
        remote_ip=remote_ip,
    )
    return membership


@transaction.atomic
def revoke_staff_membership(
    *,
    actor: User,
    seller_id: UUID,
    membership_id: UUID,
    remote_ip: str | None = None,
) -> SellerMembership:
    locked_actor = User.objects.select_for_update().get(pk=actor.pk)
    try:
        seller = Seller.objects.select_for_update().get(pk=seller_id)
    except Seller.DoesNotExist:
        raise NotFound("Seller not found.") from None

    require_seller_access(locked_actor, seller_id, "staff.remove")

    try:
        membership = (
            SellerMembership.objects.select_for_update()
            .select_related("role", "user")
            .get(pk=membership_id, seller=seller)
        )
    except SellerMembership.DoesNotExist:
        raise NotFound("Staff membership not found.") from None

    if membership.role.is_owner:
        active_owners = (
            SellerMembership.objects.filter(
                seller=seller, role__is_owner=True, status=SellerMembership.Status.ACTIVE
            )
            .exclude(pk=membership.pk)
            .count()
        )
        if active_owners == 0:
            raise ValidationError(
                {"membership": ["Cannot revoke the last active owner of the seller."]}
            )
        actor_access = require_seller_access(locked_actor, seller_id)
        if (
            not actor_access.membership.role.is_owner
            or "seller.ownership.manage" not in actor_access.permissions
        ):
            raise PermissionDenied(
                "Revoking an owner requires owner status and seller.ownership.manage permission."
            )

    membership.status = SellerMembership.Status.SUSPENDED
    membership.save(update_fields=["status"])

    _log_audit(
        actor=locked_actor,
        seller=seller,
        action="seller.staff.revoke",
        target_type="seller_membership",
        target_id=membership.pk,
        changes={"status": SellerMembership.Status.SUSPENDED},
        remote_ip=remote_ip,
    )
    return membership


@transaction.atomic
def create_custom_role(
    *,
    actor: User,
    seller_id: UUID,
    name: str,
    permission_codes: list[str],
    remote_ip: str | None = None,
) -> SellerRole:
    locked_actor = User.objects.select_for_update().get(pk=actor.pk)
    try:
        seller = Seller.objects.select_for_update().get(pk=seller_id)
    except Seller.DoesNotExist:
        raise NotFound("Seller not found.") from None

    access = require_seller_access(locked_actor, seller_id, "staff.update")

    clean_name = name.strip()
    if not clean_name:
        raise ValidationError({"name": ["Role name is required."]})

    if SellerRole.objects.filter(
        Q(seller=seller) | Q(seller__isnull=True), name__iexact=clean_name
    ).exists():
        raise ValidationError({"name": ["A role with this name already exists."]})

    requested = set(permission_codes)
    if not requested:
        raise ValidationError(
            {"permissions": ["At least one permission must be assigned to the role."]}
        )

    # Delegation guard: actor cannot grant permissions they themselves do not possess
    actor_permissions = set(access.permissions)
    if not requested.issubset(actor_permissions):
        raise PermissionDenied("You cannot grant permissions you do not hold.")

    perms = list(SellerPermission.objects.filter(code__in=requested))
    if len(perms) != len(requested):
        raise ValidationError({"permissions": ["One or more invalid permission codes."]})

    role = SellerRole.objects.create(
        seller=seller,
        name=clean_name,
        is_system=False,
        is_owner=False,
    )
    SellerRolePermission.objects.bulk_create(
        [SellerRolePermission(role=role, permission=p) for p in perms]
    )

    _log_audit(
        actor=locked_actor,
        seller=seller,
        action="seller.role.create",
        target_type="seller_role",
        target_id=role.pk,
        changes={"name": clean_name, "permissions": sorted(requested)},
        remote_ip=remote_ip,
    )
    return role


@transaction.atomic
def update_custom_role(
    *,
    actor: User,
    seller_id: UUID,
    role_id: UUID,
    name: str | None = None,
    permission_codes: list[str] | None = None,
    remote_ip: str | None = None,
) -> SellerRole:
    locked_actor = User.objects.select_for_update().get(pk=actor.pk)
    try:
        seller = Seller.objects.select_for_update().get(pk=seller_id)
    except Seller.DoesNotExist:
        raise NotFound("Seller not found.") from None

    access = require_seller_access(locked_actor, seller_id, "staff.update")

    try:
        role = SellerRole.objects.select_for_update().get(pk=role_id, seller=seller)
    except SellerRole.DoesNotExist:
        raise NotFound("Custom role not found.") from None

    if role.is_system:
        raise PermissionDenied("System roles cannot be modified.")

    changes: dict[str, Any] = {}

    if name is not None:
        clean_name = name.strip()
        if not clean_name:
            raise ValidationError({"name": ["Role name cannot be empty."]})
        if (
            SellerRole.objects.filter(
                Q(seller=seller) | Q(seller__isnull=True), name__iexact=clean_name
            )
            .exclude(pk=role.pk)
            .exists()
        ):
            raise ValidationError({"name": ["A role with this name already exists."]})
        changes["name"] = clean_name
        role.name = clean_name
        role.save(update_fields=["name"])

    if permission_codes is not None:
        requested = set(permission_codes)
        if not requested:
            raise ValidationError(
                {"permissions": ["At least one permission must be assigned to the role."]}
            )
        actor_permissions = set(access.permissions)
        if not requested.issubset(actor_permissions):
            raise PermissionDenied("You cannot grant permissions you do not hold.")
        perms = list(SellerPermission.objects.filter(code__in=requested))
        if len(perms) != len(requested):
            raise ValidationError({"permissions": ["One or more invalid permission codes."]})
        SellerRolePermission.objects.filter(role=role).delete()
        SellerRolePermission.objects.bulk_create(
            [SellerRolePermission(role=role, permission=p) for p in perms]
        )
        changes["permissions"] = sorted(requested)

    _log_audit(
        actor=locked_actor,
        seller=seller,
        action="seller.role.update",
        target_type="seller_role",
        target_id=role.pk,
        changes=changes,
        remote_ip=remote_ip,
    )
    return role


@transaction.atomic
def delete_custom_role(
    *,
    actor: User,
    seller_id: UUID,
    role_id: UUID,
    remote_ip: str | None = None,
) -> None:
    locked_actor = User.objects.select_for_update().get(pk=actor.pk)
    try:
        seller = Seller.objects.select_for_update().get(pk=seller_id)
    except Seller.DoesNotExist:
        raise NotFound("Seller not found.") from None

    require_seller_access(locked_actor, seller_id, "staff.update")

    try:
        role = SellerRole.objects.select_for_update().get(pk=role_id, seller=seller)
    except SellerRole.DoesNotExist:
        raise NotFound("Custom role not found.") from None

    if role.is_system:
        raise PermissionDenied("System roles cannot be deleted.")

    if SellerMembership.objects.filter(seller=seller, role=role).exists():
        raise ValidationError({"role": ["Cannot delete role while members are assigned to it."]})

    _log_audit(
        actor=locked_actor,
        seller=seller,
        action="seller.role.delete",
        target_type="seller_role",
        target_id=role.pk,
        changes={"name": role.name},
        remote_ip=remote_ip,
    )
    role.delete()
