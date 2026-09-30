from typing import Any

from rest_framework import serializers

from apps.accounts.serializers import StrictSerializer
from apps.sellers.models import Seller, SellerMembership, SellerRole


class SellerIdentifierSerializer(StrictSerializer):
    seller_id = serializers.UUIDField()


class SellerSummarySerializer(serializers.ModelSerializer[Seller]):
    class Meta:
        model = Seller
        fields = [
            "id",
            "display_name",
            "slug",
            "status",
            "verification_status",
            "default_currency",
            "timezone",
        ]
        read_only_fields = fields


class SellerRoleSummarySerializer(serializers.ModelSerializer[SellerRole]):
    class Meta:
        model = SellerRole
        fields = ["id", "name", "is_owner"]
        read_only_fields = fields


class SellerMembershipSerializer(serializers.ModelSerializer[SellerMembership]):
    seller = SellerSummarySerializer(read_only=True)
    role = SellerRoleSummarySerializer(read_only=True)
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = SellerMembership
        fields = ["id", "seller", "role", "status", "permissions"]
        read_only_fields = fields

    def get_permissions(self, membership: SellerMembership) -> list[str]:
        return sorted(permission.code for permission in membership.role.permissions.all())


class SellerInspectionSerializer(serializers.ModelSerializer[Seller]):
    class Meta:
        model = Seller
        fields = [
            "id",
            "legal_name",
            "display_name",
            "slug",
            "status",
            "verification_status",
            "email",
            "phone",
            "default_currency",
            "timezone",
            "created_at",
            "updated_at",
            "approved_at",
            "approved_by",
        ]
        read_only_fields = fields


class SellerPageSerializer(serializers.Serializer[dict[str, Any]]):
    count = serializers.IntegerField()
    next = serializers.URLField(allow_null=True)
    previous = serializers.URLField(allow_null=True)
    results = SellerMembershipSerializer(many=True)
