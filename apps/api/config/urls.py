from django.urls import path

from apps.accounts.views import CSRFView, LoginView, LogoutView, MeView, PasswordChangeView
from apps.platform_access.views import PlatformAccessView
from config.health import HealthView

urlpatterns = [
    path("api/v1/health", HealthView.as_view(), name="health"),
    path("api/v1/auth/csrf", CSRFView.as_view(), name="csrf"),
    path("api/v1/auth/login", LoginView.as_view(), name="login"),
    path("api/v1/auth/logout", LogoutView.as_view(), name="logout"),
    path("api/v1/auth/me", MeView.as_view(), name="me"),
    path("api/v1/auth/change-password", PasswordChangeView.as_view(), name="change-password"),
    path("api/v1/admin/access", PlatformAccessView.as_view(), name="platform-access"),
]
