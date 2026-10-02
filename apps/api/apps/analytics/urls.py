from django.urls import path

from apps.analytics.views import (
    PlatformDashboardMetricsView,
    SellerDashboardMetricsView,
)

urlpatterns = [
    path(
        "seller/analytics/dashboard",
        SellerDashboardMetricsView.as_view(),
        name="seller_dashboard_metrics",
    ),
    path(
        "admin/analytics/dashboard",
        PlatformDashboardMetricsView.as_view(),
        name="platform_dashboard_metrics",
    ),
]
