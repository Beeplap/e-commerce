from typing import cast
from uuid import UUID

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from apps.accounts.models import User
from apps.accounts.views import BrowserAPIView
from apps.notifications.models import Notification
from apps.notifications.serializers import (
    BroadcastResponseSerializer,
    NotificationBroadcastInputSerializer,
    NotificationSerializer,
    UnreadCountSerializer,
)
from apps.notifications.services import (
    mark_all_notifications_read,
    mark_notification_read,
    send_notification,
)
from apps.platform_access.permissions import PlatformCapabilityRequired
from config.pagination import BoundedPagination


class NotificationListView(BrowserAPIView):
    permission_classes = [IsAuthenticated]
    allowed_query_parameters = frozenset({"unread", "page"})

    @extend_schema(
        parameters=[
            OpenApiParameter(
                "unread", OpenApiTypes.BOOL, description="Filter for unread notifications only"
            ),
            OpenApiParameter("page", OpenApiTypes.INT, description="1 to 10000; 25 per page"),
        ],
        responses={200: NotificationSerializer(many=True)},
        tags=["Notifications"],
    )
    def get(self, request: Request) -> Response:
        user = cast(User, request.user)
        queryset = (
            Notification.objects.filter(recipient=user)
            .prefetch_related("deliveries")
            .order_by("-created_at")
        )
        if request.query_params.get("unread", "").lower() in ("true", "1"):
            queryset = queryset.filter(read_at__isnull=True)

        pagination = BoundedPagination()
        page = pagination.paginate_queryset(queryset, request, self)
        return pagination.get_paginated_response(NotificationSerializer(page, many=True).data)


class NotificationUnreadCountView(BrowserAPIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: UnreadCountSerializer}, tags=["Notifications"])
    def get(self, request: Request) -> Response:
        user = cast(User, request.user)
        count = Notification.objects.filter(recipient=user, read_at__isnull=True).count()
        return Response({"unread_count": count})


class NotificationMarkReadView(BrowserAPIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses={200: NotificationSerializer}, tags=["Notifications"])
    def post(self, request: Request, notification_id: UUID) -> Response:
        user = cast(User, request.user)
        notif = mark_notification_read(notification_id=notification_id, user=user)
        if notif is None:
            return Response({"detail": "Notification not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(NotificationSerializer(notif).data)


class NotificationMarkAllReadView(BrowserAPIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses={200: UnreadCountSerializer}, tags=["Notifications"])
    def post(self, request: Request) -> Response:
        user = cast(User, request.user)
        updated = mark_all_notifications_read(user=user)
        return Response({"unread_count": 0, "marked_count": updated})


class PlatformNotificationBroadcastView(BrowserAPIView):
    permission_classes = [PlatformCapabilityRequired]
    platform_capability = "platform.notifications.send"

    @extend_schema(
        request=NotificationBroadcastInputSerializer,
        responses={201: BroadcastResponseSerializer},
        tags=["Platform notifications"],
    )
    def post(self, request: Request) -> Response:
        serializer = NotificationBroadcastInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        recipient_ids = serializer.validated_data.get("recipient_ids", [])
        if recipient_ids:
            recipients = list(User.objects.filter(id__in=recipient_ids, is_active=True))
        else:
            recipients = list(User.objects.filter(is_active=True)[:100])

        for recipient in recipients:
            send_notification(
                recipient=recipient,
                type=serializer.validated_data["type"],
                title=serializer.validated_data["title"],
                message=serializer.validated_data["message"],
                channels=("in_app", "email"),
            )

        return Response(
            {"message": "Broadcast sent.", "sent_count": len(recipients)},
            status=status.HTTP_201_CREATED,
        )
