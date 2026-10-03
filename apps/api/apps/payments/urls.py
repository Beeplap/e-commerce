from django.urls import re_path

from . import views

urlpatterns = [
    re_path(
        r"^checkout/payment-intent/?$",
        views.PaymentIntentView.as_view(),
        name="checkout-payment-intent",
    ),
    re_path(
        r"^checkout/confirm-payment/?$",
        views.ConfirmPaymentView.as_view(),
        name="checkout-confirm-payment",
    ),
    re_path(r"^webhooks/payment/?$", views.PaymentWebhookView.as_view(), name="payment-webhook"),
]
