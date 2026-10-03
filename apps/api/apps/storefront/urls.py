from django.urls import path

from apps.storefront import views

urlpatterns = [
    path(
        "storefront/categories",
        views.StorefrontCategoriesView.as_view(),
        name="storefront-categories",
    ),
    path(
        "storefront/brands",
        views.StorefrontBrandsView.as_view(),
        name="storefront-brands",
    ),
    path(
        "storefront/products",
        views.StorefrontProductsView.as_view(),
        name="storefront-products",
    ),
    path(
        "storefront/products/<uuid:product_id>",
        views.StorefrontProductDetailView.as_view(),
        name="storefront-product-detail",
    ),
    path(
        "storefront/products/<uuid:product_id>/images/<uuid:image_id>",
        views.StorefrontImageDownloadView.as_view(),
        name="storefront-image-download",
    ),
    path(
        "storefront/search",
        views.StorefrontSearchView.as_view(),
        name="storefront-search",
    ),
    path(
        "storefront/search/suggest",
        views.StorefrontSuggestView.as_view(),
        name="storefront-search-suggest",
    ),
    path(
        "storefront/sellers/<uuid:seller_id>",
        views.StorefrontSellerDetailView.as_view(),
        name="storefront-seller-detail",
    ),
]
