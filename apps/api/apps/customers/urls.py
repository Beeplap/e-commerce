from django.urls import path

from . import views

app_name = "customers"

urlpatterns = [
    path("profile/", views.CustomerProfileView.as_view(), name="customer-profile"),
    path(
        "addresses/",
        views.CustomerPortalAddressListView.as_view(),
        name="customer-addresses",
    ),
    path(
        "addresses/<uuid:address_id>/",
        views.CustomerPortalAddressDetailView.as_view(),
        name="customer-address-detail",
    ),
    path("orders/", views.CustomerOrdersListView.as_view(), name="customer-orders"),
    path(
        "orders/<uuid:order_id>/",
        views.CustomerOrderDetailView.as_view(),
        name="customer-order-detail",
    ),
    path(
        "orders/<uuid:order_id>/cancel/",
        views.CustomerCancelOrderView.as_view(),
        name="customer-order-cancel",
    ),
    path("reviews/", views.CustomerReviewView.as_view(), name="customer-reviews"),
    path("returns/", views.CustomerReturnView.as_view(), name="customer-returns"),
]
