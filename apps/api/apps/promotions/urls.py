from django.urls import path

from apps.promotions import views

urlpatterns = [
    # Seller promotions
    path("seller/promotions", views.SellerPromotionListCreateView.as_view()),
    path("seller/promotions/<uuid:promotion_id>", views.SellerPromotionDetailView.as_view()),
    path("seller/promotions/<uuid:promotion_id>/coupons", views.SellerCouponCreateView.as_view()),
    path("seller/coupons", views.SellerCouponListView.as_view()),
    # Admin promotions
    path("admin/promotions", views.PlatformPromotionListCreateView.as_view()),
    path("admin/promotions/<uuid:promotion_id>", views.PlatformPromotionDetailView.as_view()),
    path("admin/promotions/<uuid:promotion_id>/coupons", views.PlatformCouponCreateView.as_view()),
    # Public validation
    path("promotions/validate", views.CouponValidateView.as_view()),
]
