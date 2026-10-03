from django.urls import re_path

from . import views

urlpatterns = [
    re_path(r"^cart/?$", views.CartView.as_view(), name="cart"),
    re_path(r"^cart/items/?$", views.CartItemAddView.as_view(), name="cart-items-add"),
    re_path(
        r"^cart/items/(?P<item_id>[0-9a-f-]+)/?$",
        views.CartItemDetailView.as_view(),
        name="cart-item-detail",
    ),
    re_path(r"^cart/clear/?$", views.CartClearView.as_view(), name="cart-clear"),
    re_path(r"^cart/validate/?$", views.CartStockValidateView.as_view(), name="cart-validate"),
]
