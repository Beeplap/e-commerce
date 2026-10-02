from django.urls import path

from apps.orders import views

urlpatterns = [
    path("seller/orders/", views.SellerOrdersView.as_view(), name="seller-orders-list"),
    path(
        "seller/orders/<uuid:id>/",
        views.SellerOrderDetailView.as_view(),
        name="seller-orders-detail",
    ),
    path(
        "seller/orders/<uuid:id>/confirm/",
        views.SellerOrderConfirmView.as_view(),
        name="seller-orders-confirm",
    ),
    path(
        "seller/orders/<uuid:id>/begin-processing/",
        views.SellerOrderBeginProcessingView.as_view(),
        name="seller-orders-begin-processing",
    ),
    path(
        "seller/orders/<uuid:id>/ship/",
        views.SellerOrderShipView.as_view(),
        name="seller-orders-ship",
    ),
    path(
        "seller/orders/<uuid:id>/deliver/",
        views.SellerOrderDeliverView.as_view(),
        name="seller-orders-deliver",
    ),
    path(
        "seller/orders/<uuid:id>/cancel/",
        views.SellerOrderCancelView.as_view(),
        name="seller-orders-cancel",
    ),
    path("admin/orders/", views.PlatformOrdersView.as_view(), name="platform-orders-list"),
    path(
        "admin/orders/<uuid:id>/",
        views.PlatformOrderDetailView.as_view(),
        name="platform-orders-detail",
    ),
]
