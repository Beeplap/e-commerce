from django.contrib.auth.models import AnonymousUser

from apps.accounts.models import User
from apps.platform_access.models import PlatformPermission


def platform_capabilities(user: User | AnonymousUser) -> list[str]:
    if not user.is_authenticated or not user.is_active:
        return []
    return list(
        PlatformPermission.objects.filter(
            platformrole__platformaccess__user_id=user.pk,
            platformrole__platformaccess__is_active=True,
            platformrole__platformaccess__user__is_active=True,
        )
        .order_by("code")
        .values_list("code", flat=True)
    )


def has_platform_permission(user: User | AnonymousUser, capability: str) -> bool:
    return capability in platform_capabilities(user)
