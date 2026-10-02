from __future__ import annotations

from typing import Any

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from apps.accounts.views import BrowserAPIView
from apps.analytics.serializers import (
    PlatformDashboardMetricsSerializer,
    SellerDashboardMetricsSerializer,
)
from apps.analytics.services import (
    get_platform_dashboard_metrics,
    get_seller_dashboard_metrics,
    parse_date_range,
)
from apps.platform_access.permissions import PlatformCapabilityRequired
from apps.sellers.permissions import SellerCapabilityRequired
from apps.sellers.selectors import SellerAccess

HEADER = OpenApiParameter("X-Seller-ID", OpenApiTypes.UUID, OpenApiParameter.HEADER, required=True)
START_PARAM = OpenApiParameter(
    "start_date", OpenApiTypes.DATETIME, OpenApiParameter.QUERY, required=False
)
END_PARAM = OpenApiParameter(
    "end_date", OpenApiTypes.DATETIME, OpenApiParameter.QUERY, required=False
)


class SellerDashboardMetricsView(BrowserAPIView):
    permission_classes = [SellerCapabilityRequired]
    seller_capability = "seller.context.read"
    seller_access: SellerAccess
    allowed_query_parameters = frozenset({"start_date", "end_date"})

    @extend_schema(
        parameters=[HEADER, START_PARAM, END_PARAM],
        responses={200: SellerDashboardMetricsSerializer},
        tags=["Seller analytics"],
        operation_id="seller_dashboard_metrics",
    )
    def get(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        start_str = request.query_params.get("start_date")
        end_str = request.query_params.get("end_date")
        start_date, end_date = parse_date_range(start_str, end_str)

        metrics = get_seller_dashboard_metrics(
            seller=self.seller_access.seller,
            start_date=start_date,
            end_date=end_date,
        )
        return Response(metrics)


class PlatformDashboardMetricsView(BrowserAPIView):
    permission_classes = [PlatformCapabilityRequired]
    platform_capability = "platform.analytics.read"
    allowed_query_parameters = frozenset({"start_date", "end_date"})

    @extend_schema(
        parameters=[START_PARAM, END_PARAM],
        responses={200: PlatformDashboardMetricsSerializer},
        tags=["Platform analytics"],
        operation_id="platform_dashboard_metrics",
    )
    def get(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        start_str = request.query_params.get("start_date")
        end_str = request.query_params.get("end_date")
        start_date, end_date = parse_date_range(start_str, end_str)

        metrics = get_platform_dashboard_metrics(
            start_date=start_date,
            end_date=end_date,
        )
        return Response(metrics)
