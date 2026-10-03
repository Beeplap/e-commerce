from django.urls import re_path

from . import views

urlpatterns = [
    re_path(
        r"^checkout/addresses/?$",
        views.CustomerAddressListView.as_view(),
        name="checkout-addresses-list",
    ),
    re_path(
        r"^checkout/addresses/(?P<address_id>[0-9a-f-]+)/?$",
        views.CustomerAddressDetailView.as_view(),
        name="checkout-address-detail",
    ),
    re_path(r"^checkout/quote/?$", views.CheckoutQuoteView.as_view(), name="checkout-quote"),
    re_path(
        r"^checkout/place-order/?$",
        views.PlaceOrderView.as_view(),
        name="checkout-place-order",
    ),
]
