from collections.abc import Mapping
from typing import Any, cast

from rest_framework import serializers

from apps.accounts.models import User, UserManager
from apps.platform_access.selectors import platform_capabilities


class StrictSerializer(serializers.Serializer[dict[str, Any]]):
    def to_internal_value(self, data: Any) -> dict[str, Any]:
        if isinstance(data, Mapping) and set(data) - set(self.fields):
            raise serializers.ValidationError({"detail": "Unexpected fields."})
        return cast(dict[str, Any], super().to_internal_value(data))


class LoginSerializer(StrictSerializer):
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=1024)

    def validate_email(self, value: str) -> str:
        return UserManager.normalize_email(value)


class PasswordChangeSerializer(StrictSerializer):
    old_password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=1024)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=1024)


class EmptySerializer(StrictSerializer):
    pass


class UserSerializer(serializers.ModelSerializer[User]):
    platform_permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "is_email_verified",
            "platform_permissions",
        ]
        read_only_fields = fields

    def get_platform_permissions(self, user: User) -> list[str]:
        return platform_capabilities(user)


class CSRFSerializer(serializers.Serializer[dict[str, str]]):
    csrf_token = serializers.CharField()


class DetailSerializer(serializers.Serializer[dict[str, str]]):
    detail = serializers.CharField()
