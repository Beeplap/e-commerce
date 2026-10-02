from django.urls import path

from apps.notifications import views

urlpatterns = [
    path("notifications", views.NotificationListView.as_view()),
    path("notifications/unread-count", views.NotificationUnreadCountView.as_view()),
    path("notifications/<uuid:notification_id>/read", views.NotificationMarkReadView.as_view()),
    path("notifications/mark-all-read", views.NotificationMarkAllReadView.as_view()),
    path("admin/notifications/broadcast", views.PlatformNotificationBroadcastView.as_view()),
]
