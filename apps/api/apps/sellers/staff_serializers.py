from typing import Any

from rest_framework import serializers

from apps.accounts.models import User
from apps.sellers.models import SellerMembership, SellerPermission, SellerRole


class StaffUserSerializer(serializers.ModelSerializer[User]):
    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name"]


class StaffPermissionSerializer(serializers.ModelSerializer[SellerPermission]):
    class Meta:
        model = SellerPermission
        fields = ["id", "code", "description"]


class StaffRoleSerializer(serializers.ModelSerializer[SellerRole]):
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = SellerRole
        fields = ["id", "name", "is_system", "is_owner", "permissions", "created_at"]

    def get_permissions(self, obj: SellerRole) -> list[str]:
        return sorted([p.code for p in obj.permissions.all()])


class StaffMembershipSerializer(serializers.ModelSerializer[SellerMembership]):
    user = StaffUserSerializer(read_only=True)
    role = StaffRoleSerializer(read_only=True)

    class Meta:
        model = SellerMembership
        fields = ["id", "user", "role", "status", "joined_at", "created_at"]


class StaffInviteInputSerializer(serializers.Serializer[Any]):
    email = serializers.EmailField()
    role_id = serializers.UUIDField()


class StaffRoleUpdateInputSerializer(serializers.Serializer[Any]):
    role_id = serializers.UUIDField()


class CustomRoleCreateInputSerializer(serializers.Serializer[Any]):
    name = serializers.CharField(max_length=50)
    permissions = serializers.ListField(child=serializers.CharField(max_length=100))


class CustomRoleUpdateInputSerializer(serializers.Serializer[Any]):
    name = serializers.CharField(max_length=50, required=False)
    permissions = serializers.ListField(child=serializers.CharField(max_length=100), required=False)
