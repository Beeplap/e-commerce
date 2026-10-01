from datetime import date
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.utils import timezone
from rest_framework import serializers

from apps.accounts.serializers import StrictSerializer
from apps.audit.models import AuditLog
from apps.sellers.models import (
    Seller,
    SellerAddress,
    SellerDocument,
    SellerMembership,
    SellerProfile,
    SellerSettings,
    SellerStatusHistory,
)
from apps.sellers.serializers import SellerInspectionSerializer


class SellerContactSerializer(StrictSerializer):
    display_name = serializers.CharField(max_length=120)
    email = serializers.EmailField(max_length=254)
    phone = serializers.CharField(max_length=32, allow_blank=True, default="")
    timezone = serializers.CharField(max_length=64, default="UTC")

    def validate_timezone(self, value: str) -> str:
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError) as error:
            raise serializers.ValidationError("Use a valid IANA timezone.") from error
        return value

    def validate_email(self, value: str) -> str:
        return value.strip().lower()


class SellerCreateSerializer(SellerContactSerializer):
    legal_name = serializers.CharField(max_length=200)
    default_currency = serializers.ChoiceField(choices=["USD", "NPR", "INR", "EUR", "GBP"])


class SellerUpdateSerializer(SellerContactSerializer):
    description = serializers.CharField(max_length=2000, allow_blank=True)
    website = serializers.URLField(max_length=200, allow_blank=True)
    support_email = serializers.EmailField(max_length=254, allow_blank=True)

    def validate_website(self, value: str) -> str:
        if value and not value.startswith("https://"):
            raise serializers.ValidationError("Use an HTTPS website URL.")
        return value


class AddressInputSerializer(StrictSerializer):
    kind = serializers.ChoiceField(choices=SellerAddress.Kind.choices)
    line1 = serializers.CharField(max_length=200)
    line2 = serializers.CharField(max_length=200, allow_blank=True, default="")
    city = serializers.CharField(max_length=100)
    region = serializers.CharField(max_length=100, allow_blank=True, default="")
    postal_code = serializers.CharField(max_length=20, allow_blank=True, default="")
    country = serializers.RegexField(r"^[A-Z]{2}$", max_length=2)


class ProfileSerializer(serializers.ModelSerializer[SellerProfile]):
    class Meta:
        model = SellerProfile
        fields = ["description", "website"]


class SettingsSerializer(serializers.ModelSerializer[SellerSettings]):
    class Meta:
        model = SellerSettings
        fields = ["support_email"]


class AddressSerializer(serializers.ModelSerializer[SellerAddress]):
    class Meta:
        model = SellerAddress
        fields = ["id", "kind", "line1", "line2", "city", "region", "postal_code", "country"]


class SellerDetailSerializer(SellerInspectionSerializer):
    profile = ProfileSerializer(read_only=True)
    settings = SettingsSerializer(read_only=True)
    addresses = AddressSerializer(many=True, read_only=True)

    class Meta(SellerInspectionSerializer.Meta):
        fields = [*SellerInspectionSerializer.Meta.fields, "profile", "settings", "addresses"]
        read_only_fields = fields


class DocumentInputSerializer(StrictSerializer):
    document_type = serializers.ChoiceField(choices=SellerDocument.DocumentType.choices)
    file = serializers.FileField(max_length=255, write_only=True)
    expires_at = serializers.DateField(required=False, allow_null=True, default=None)

    def validate_expires_at(self, value: date | None) -> date | None:
        if value is not None and value <= timezone.localdate():
            raise serializers.ValidationError("Expiry must be in the future.")
        return value


class DocumentSerializer(serializers.ModelSerializer[SellerDocument]):
    class Meta:
        model = SellerDocument
        fields = [
            "id",
            "document_type",
            "content_type",
            "size",
            "status",
            "verified_by_id",
            "verified_at",
            "rejection_reason",
            "expires_at",
            "created_at",
        ]
        read_only_fields = fields


class ReasonSerializer(StrictSerializer):
    reason = serializers.CharField(max_length=500)


class SellerFilterSerializer(StrictSerializer):
    page = serializers.IntegerField(min_value=1, max_value=10000, required=False)
    search = serializers.CharField(max_length=100, required=False, allow_blank=True)
    status = serializers.ChoiceField(choices=Seller.Status.choices, required=False)
    verification_status = serializers.ChoiceField(
        choices=Seller.VerificationStatus.choices, required=False
    )


class HistorySerializer(serializers.ModelSerializer[SellerStatusHistory]):
    class Meta:
        model = SellerStatusHistory
        fields = ["id", "actor_id", "from_status", "to_status", "reason", "created_at"]


class AuditSerializer(serializers.ModelSerializer[AuditLog]):
    class Meta:
        model = AuditLog
        fields = ["id", "actor_id", "action", "target_type", "target_id", "changes", "created_at"]


class MemberOverviewSerializer(serializers.ModelSerializer[SellerMembership]):
    email = serializers.EmailField(source="user.email", read_only=True)
    role_name = serializers.CharField(source="role.name", read_only=True)

    class Meta:
        model = SellerMembership
        fields = ["id", "email", "role_name", "status", "joined_at"]


class PageSerializer(serializers.Serializer[dict[str, Any]]):
    count = serializers.IntegerField()
    next = serializers.URLField(allow_null=True)
    previous = serializers.URLField(allow_null=True)


class SellerListPageSerializer(PageSerializer):
    results = SellerInspectionSerializer(many=True)


class DocumentPageSerializer(PageSerializer):
    results = DocumentSerializer(many=True)


class HistoryPageSerializer(PageSerializer):
    results = HistorySerializer(many=True)


class AuditPageSerializer(PageSerializer):
    results = AuditSerializer(many=True)


class MemberOverviewPageSerializer(PageSerializer):
    results = MemberOverviewSerializer(many=True)
