from typing import Any

from rest_framework import serializers

from apps.notifications.models import Notification, NotificationDelivery


class NotificationDeliverySerializer(serializers.ModelSerializer[NotificationDelivery]):
    class Meta:
        model = NotificationDelivery
        fields = ["id", "channel", "status", "sent_at", "error_message", "created_at"]


class NotificationSerializer(serializers.ModelSerializer[Notification]):
    deliveries = NotificationDeliverySerializer(many=True, read_only=True)

    class Meta:
        model = Notification
        fields = [
            "id",
            "type",
            "title",
            "message",
            "data",
            "read_at",
            "deliveries",
            "created_at",
        ]


class NotificationBroadcastInputSerializer(serializers.Serializer[Any]):
    recipient_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, default=list
    )
    type = serializers.CharField(max_length=40, default="SYSTEM_BROADCAST")
    title = serializers.CharField(max_length=200)
    message = serializers.CharField()


class UnreadCountSerializer(serializers.Serializer[Any]):
    unread_count = serializers.IntegerField()


class BroadcastResponseSerializer(serializers.Serializer[Any]):
    message = serializers.CharField()
    sent_count = serializers.IntegerField()
