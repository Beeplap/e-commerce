from django.urls import path

from apps.catalog import views

urlpatterns = [
    path("admin/catalog/<str:kind>", views.PlatformCatalogView.as_view()),
    path("admin/catalog/<str:kind>/<uuid:identity>", views.PlatformCatalogDetailView.as_view()),
    path("seller/catalog/<str:kind>", views.SellerCatalogView.as_view()),
    path("seller/products", views.SellerProductsView.as_view()),
    path("seller/products/<uuid:product_id>", views.SellerProductView.as_view()),
    path(
        "seller/products/<uuid:product_id>/submit-for-review",
        views.SellerProductActionView.as_view(),
    ),
    path("seller/products/<uuid:product_id>/revise", views.SellerProductReviseView.as_view()),
    path("seller/products/<uuid:product_id>/archive", views.SellerProductArchiveView.as_view()),
    path("seller/products/<uuid:product_id>/variants", views.SellerVariantsView.as_view()),
    path(
        "seller/products/<uuid:product_id>/variants/<uuid:variant_id>",
        views.SellerVariantView.as_view(),
    ),
    path("seller/products/<uuid:product_id>/attributes", views.SellerValuesView.as_view()),
    path(
        "seller/products/<uuid:product_id>/attributes/<uuid:value_id>",
        views.SellerValueRemoveView.as_view(),
    ),
    path(
        "seller/products/<uuid:product_id>/variants/<uuid:variant_id>/attributes",
        views.SellerVariantValuesView.as_view(),
    ),
    path(
        "seller/products/<uuid:product_id>/variants/<uuid:variant_id>/attributes/<uuid:value_id>",
        views.SellerValueRemoveView.as_view(),
    ),
    path("seller/products/<uuid:product_id>/images", views.SellerImagesView.as_view()),
    path("seller/products/<uuid:product_id>/images/upload", views.SellerImageUploadView.as_view()),
    path(
        "seller/products/<uuid:product_id>/images/<uuid:image_id>",
        views.SellerImageRemoveView.as_view(),
    ),
    path(
        "seller/products/<uuid:product_id>/images/<uuid:image_id>/download",
        views.SellerImageDownloadView.as_view(),
    ),
    path("seller/products/<uuid:product_id>/history", views.SellerProductHistoryView.as_view()),
    path("admin/products", views.PlatformProductsView.as_view()),
    path("admin/products/<uuid:product_id>", views.PlatformProductView.as_view()),
    path("admin/products/<uuid:product_id>/approve", views.PlatformProductModerateView.as_view()),
    path("admin/products/<uuid:product_id>/reject", views.PlatformProductRejectView.as_view()),
    path("admin/products/<uuid:product_id>/variants", views.PlatformChildView.as_view()),
    path("admin/products/<uuid:product_id>/images", views.PlatformImagesView.as_view()),
    path("admin/products/<uuid:product_id>/attributes", views.PlatformValuesView.as_view()),
    path("admin/products/<uuid:product_id>/history", views.PlatformHistoryView.as_view()),
    path(
        "admin/products/<uuid:product_id>/variants/<uuid:variant_id>/attributes",
        views.PlatformVariantValuesView.as_view(),
    ),
    path(
        "admin/products/<uuid:product_id>/images/<uuid:image_id>/download",
        views.PlatformImageDownloadView.as_view(),
    ),
]
