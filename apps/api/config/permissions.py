from typing import TYPE_CHECKING

from rest_framework.permissions import BasePermission
from rest_framework.request import Request

if TYPE_CHECKING:
    from rest_framework.views import APIView


class DenyAll(BasePermission):
    """Every endpoint must deliberately choose its authorization policy."""

    def has_permission(self, request: Request, view: APIView) -> bool:
        return False
