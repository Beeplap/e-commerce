from typing import TYPE_CHECKING

from rest_framework.permissions import BasePermission
from rest_framework.request import Request

from apps.platform_access.selectors import has_platform_permission

if TYPE_CHECKING:
    from rest_framework.views import APIView


class PlatformCapabilityRequired(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        capability = getattr(view, "platform_capability", None)
        return isinstance(capability, str) and has_platform_permission(request.user, capability)
