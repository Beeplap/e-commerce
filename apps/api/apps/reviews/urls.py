from django.urls import path

from apps.reviews import views

urlpatterns = [
    # Public & Customer reviews
    path("products/<uuid:product_id>/reviews", views.ProductReviewListView.as_view()),
    path("reviews", views.ReviewCreateView.as_view()),
    path("reviews/<uuid:review_id>/report", views.ReviewReportCreateView.as_view()),
    # Seller reviews
    path("seller/reviews", views.SellerReviewListView.as_view()),
    path("seller/reviews/<uuid:review_id>/respond", views.SellerReviewRespondView.as_view()),
    # Admin reviews & moderation
    path("admin/reviews", views.PlatformReviewListView.as_view()),
    path("admin/reviews/<uuid:review_id>/moderate", views.PlatformReviewModerateView.as_view()),
    path("admin/reviews/reports", views.PlatformReviewReportListView.as_view()),
    path(
        "admin/reviews/reports/<uuid:report_id>/resolve",
        views.PlatformReviewReportResolveView.as_view(),
    ),
]
