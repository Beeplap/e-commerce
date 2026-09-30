from uuid import UUID

from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from apps.accounts.serializers import DetailSerializer
from apps.accounts.views import BrowserAPIView
from apps.platform_access.permissions import PlatformCapabilityRequired
from apps.sellers.models import Seller
from apps.sellers.permissions import SellerCapabilityRequired
from apps.sellers.selectors import SellerAccess, accessible_memberships
from apps.sellers.serializers import (
    SellerInspectionSerializer,
    SellerMembershipSerializer,
    SellerPageSerializer,
)
from config.pagination import BoundedPagination


class SellerMembershipListView(BrowserAPIView):
    permission_classes = [IsAuthenticated]
    allowed_query_parameters = frozenset({"page"})

    @extend_schema(
        responses=SellerPageSerializer,
        parameters=[
            OpenApiParameter("page", OpenApiTypes.INT, description="1 to 10000; 25 per page")
        ],
        tags=["Seller access"],
    )
    def get(self, request: Request) -> Response:
        pagination = BoundedPagination()
        page = pagination.paginate_queryset(accessible_memberships(request.user), request, self)
        return pagination.get_paginated_response(SellerMembershipSerializer(page, many=True).data)


class SellerAccessView(BrowserAPIView):
    permission_classes = [SellerCapabilityRequired]
    seller_capability = "seller.context.read"
    allow_pending_seller = True
    seller_access: SellerAccess

    @extend_schema(
        parameters=[
            OpenApiParameter(
                "X-Seller-ID", OpenApiTypes.UUID, OpenApiParameter.HEADER, required=True
            )
        ],
        responses={
            200: SellerMembershipSerializer,
            400: DetailSerializer,
            403: DetailSerializer,
            404: DetailSerializer,
        },
        tags=["Seller access"],
    )
    def get(self, request: Request) -> Response:
        return Response(SellerMembershipSerializer(self.seller_access.membership).data)


class PlatformSellerAccessView(BrowserAPIView):
    permission_classes = [PlatformCapabilityRequired]
    platform_capability = "platform.sellers.read"

    @extend_schema(responses=SellerInspectionSerializer, tags=["Platform seller inspection"])
    def get(self, request: Request, seller_id: UUID) -> Response:
        # Explicit admin boundary: platform inspection never grants seller-route authority.
        seller = get_object_or_404(Seller, pk=seller_id)
        return Response(SellerInspectionSerializer(seller).data)
