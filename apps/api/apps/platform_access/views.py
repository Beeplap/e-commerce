from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from apps.accounts.serializers import UserSerializer
from apps.accounts.services import authenticated_user
from apps.accounts.views import BrowserAPIView
from apps.platform_access.permissions import PlatformCapabilityRequired


class PlatformAccessView(BrowserAPIView):
    permission_classes = [PlatformCapabilityRequired]
    platform_capability = "platform.access"

    @extend_schema(responses=UserSerializer, tags=["Platform access"])
    def get(self, request: Request) -> Response:
        return Response(UserSerializer(authenticated_user(request._request)).data)
