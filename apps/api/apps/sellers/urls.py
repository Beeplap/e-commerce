from django.urls import path

from apps.sellers import lifecycle_views as views
from apps.sellers import staff_views

urlpatterns = [
    path("seller/onboarding", views.SellerOnboardingView.as_view()),
    path("seller/settings", views.SellerSettingsView.as_view()),
    path("seller/addresses", views.SellerAddressCreateView.as_view()),
    path("seller/addresses/<uuid:address_id>", views.SellerAddressUpdateView.as_view()),
    path("seller/documents", views.SellerDocumentListView.as_view()),
    path("seller/documents/upload", views.SellerDocumentUploadView.as_view()),
    path(
        "seller/documents/<uuid:document_id>/download", views.SellerDocumentDownloadView.as_view()
    ),
    # Seller staff & roles
    path("seller/staff", staff_views.SellerStaffListView.as_view()),
    path("seller/staff/invite", staff_views.SellerStaffInviteView.as_view()),
    path("seller/staff/<uuid:membership_id>/role", staff_views.SellerStaffRoleUpdateView.as_view()),
    path("seller/staff/<uuid:membership_id>", staff_views.SellerStaffRevokeView.as_view()),
    path("seller/staff/roles", staff_views.SellerRoleListView.as_view()),
    path("seller/staff/roles/<uuid:role_id>", staff_views.SellerRoleDetailView.as_view()),
    path("seller/staff/permissions", staff_views.SellerAssignablePermissionsView.as_view()),
    # Admin seller inspection
    path("admin/sellers", views.PlatformSellerListView.as_view()),
    path("admin/sellers/<uuid:seller_id>", views.PlatformSellerDetailView.as_view()),
    path("admin/sellers/<uuid:seller_id>/approve", views.PlatformSellerActionView.as_view()),
    path("admin/sellers/<uuid:seller_id>/reject", views.PlatformSellerRejectView.as_view()),
    path("admin/sellers/<uuid:seller_id>/suspend", views.PlatformSellerSuspendView.as_view()),
    path("admin/sellers/<uuid:seller_id>/reactivate", views.PlatformSellerReactivateView.as_view()),
    path("admin/sellers/<uuid:seller_id>/documents", views.PlatformDocumentListView.as_view()),
    path(
        "admin/sellers/<uuid:seller_id>/documents/<uuid:document_id>/download",
        views.PlatformDocumentDownloadView.as_view(),
    ),
    path(
        "admin/sellers/<uuid:seller_id>/documents/<uuid:document_id>/approve",
        views.PlatformDocumentReviewView.as_view(),
    ),
    path(
        "admin/sellers/<uuid:seller_id>/documents/<uuid:document_id>/reject",
        views.PlatformDocumentRejectView.as_view(),
    ),
    path("admin/sellers/<uuid:seller_id>/history", views.PlatformSellerHistoryView.as_view()),
    path("admin/sellers/<uuid:seller_id>/audit", views.PlatformSellerAuditView.as_view()),
    path("admin/sellers/<uuid:seller_id>/members", views.PlatformSellerMembersView.as_view()),
]
