from typing import TYPE_CHECKING, Protocol, cast

from rest_framework.permissions import BasePermission
from rest_framework.request import Request

from apps.sellers.selectors import SellerAccess, require_seller_access
from apps.sellers.serializers import SellerIdentifierSerializer

if TYPE_CHECKING:
    from rest_framework.views import APIView


class SellerAuthorizedView(Protocol):
    seller_access: SellerAccess


class SellerCapabilityRequired(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        if not request.user.is_authenticated:
            return False
        capability = getattr(view, "seller_capability", None)
        if not isinstance(capability, str):
            return False
        identifier = SellerIdentifierSerializer(
            data={"seller_id": request.headers.get("X-Seller-ID", "")}
        )
        identifier.is_valid(raise_exception=True)
        access = require_seller_access(
            request.user,
            identifier.validated_data["seller_id"],
            capability,
            allow_pending=getattr(view, "allow_pending_seller", False) is True,
        )
        # Request-local result only. Services/queries independently reauthorize each operation.
        cast(SellerAuthorizedView, view).seller_access = access
        return True
