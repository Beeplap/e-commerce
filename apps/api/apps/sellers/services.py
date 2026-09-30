from uuid import UUID

from django.contrib.auth.models import AnonymousUser
from rest_framework.exceptions import NotFound, PermissionDenied

from apps.accounts.models import User
from apps.sellers.models import SellerRole
from apps.sellers.selectors import assignable_roles, require_seller_access


def authorize_role_assignment(
    *, actor: User | AnonymousUser, seller_id: UUID, role_id: UUID, capability: str
) -> SellerRole:
    """Delegation guard for later staff commands; this does not mutate membership."""
    if capability not in {"staff.invite", "staff.update"}:
        raise ValueError("Role delegation requires an explicit staff capability.")
    access = require_seller_access(actor, seller_id, capability)
    role = assignable_roles(seller_id).filter(pk=role_id).first()
    if role is None:
        raise NotFound("Role not found.")
    delegated = {permission.code for permission in role.permissions.all()}
    if not delegated.issubset(access.permissions):
        raise PermissionDenied("You cannot delegate permissions you do not hold.")
    if role.is_owner and (
        not access.membership.role.is_owner or "seller.ownership.manage" not in access.permissions
    ):
        raise PermissionDenied("Seller ownership permission is required.")
    return role
