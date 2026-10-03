from django.urls import include, path

from apps.accounts.views import CSRFView, LoginView, LogoutView, MeView, PasswordChangeView
from apps.platform_access.views import PlatformAccessView
from apps.sellers.views import PlatformSellerAccessView, SellerAccessView, SellerMembershipListView
from config.health import HealthView, ReadinessView

urlpatterns = [
    path("api/v1/customer/", include("apps.customers.urls")),
    path("api/v1/", include("apps.payments.urls")),
    path("api/v1/", include("apps.checkout.urls")),
    path("api/v1/", include("apps.cart.urls")),
    path("api/v1/", include("apps.storefront.urls")),
    path("api/v1/", include("apps.analytics.urls")),
    path("api/v1/", include("apps.notifications.urls")),
    path("api/v1/", include("apps.reviews.urls")),
    path("api/v1/", include("apps.promotions.urls")),
    path("api/v1/", include("apps.fulfillment.urls")),
    path("api/v1/", include("apps.finance.urls")),
    path("api/v1/", include("apps.orders.urls")),
    path("api/v1/", include("apps.inventory.urls")),
    path("api/v1/", include("apps.catalog.urls")),
    path("api/v1/", include("apps.sellers.urls")),
    path("api/v1/health", HealthView.as_view(), name="health"),
    path("api/v1/health/live", HealthView.as_view(), name="health-live"),
    path("api/v1/health/ready", ReadinessView.as_view(), name="health-ready"),
    path("api/v1/auth/csrf", CSRFView.as_view(), name="csrf"),
    path("api/v1/auth/login", LoginView.as_view(), name="login"),
    path("api/v1/auth/logout", LogoutView.as_view(), name="logout"),
    path("api/v1/auth/me", MeView.as_view(), name="me"),
    path("api/v1/auth/change-password", PasswordChangeView.as_view(), name="change-password"),
    path("api/v1/admin/access", PlatformAccessView.as_view(), name="platform-access"),
    path(
        "api/v1/seller/memberships", SellerMembershipListView.as_view(), name="seller-memberships"
    ),
    path("api/v1/seller/access", SellerAccessView.as_view(), name="seller-access"),
    path(
        "api/v1/admin/sellers/<uuid:seller_id>/access",
        PlatformSellerAccessView.as_view(),
        name="platform-seller-access",
    ),
]
