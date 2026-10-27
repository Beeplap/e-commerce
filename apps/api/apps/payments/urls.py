from django.urls import path, re_path

from . import views

urlpatterns = [
    path(
        "checkout/orders/<uuid:order_id>/payment-state/",
        views.OrderPaymentStateView.as_view(),
        name="checkout-order-payment-state",
    ),
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
