import uuid

from django.conf import settings
from django.db import models


class Seller(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending"
        ACTIVE = "active"
        SUSPENDED = "suspended"
        REJECTED = "rejected"
        CLOSED = "closed"

    class VerificationStatus(models.TextChoices):
        PENDING = "pending"
        VERIFIED = "verified"
        REJECTED = "rejected"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    legal_name = models.CharField(max_length=200)
    display_name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=140, unique=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    verification_status = models.CharField(
        max_length=16, choices=VerificationStatus.choices, default=VerificationStatus.PENDING
    )
    email = models.EmailField()
    phone = models.CharField(max_length=32, blank=True)
    default_currency = models.CharField(max_length=3, default="USD")
    timezone = models.CharField(max_length=64, default="UTC")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="approved_sellers",
    )

    class Meta:
        ordering = ["display_name", "id"]
        indexes = [models.Index(fields=["status", "created_at"])]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(
                    status__in=["pending", "active", "suspended", "rejected", "closed"]
                ),
                name="seller_valid_status",
            ),
            models.CheckConstraint(
                condition=models.Q(verification_status__in=["pending", "verified", "rejected"]),
                name="seller_valid_verification_status",
            ),
            models.CheckConstraint(
                condition=models.Q(default_currency__regex=r"^[A-Z]{3}$"),
                name="seller_currency_format",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(approved_at__isnull=True, approved_by__isnull=True)
                    | models.Q(approved_at__isnull=False, approved_by__isnull=False)
                ),
                name="seller_approval_metadata_pair",
            ),
        ]


class SellerPermission(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=100, unique=True)
    description = models.CharField(max_length=255)

    class Meta:
        ordering = ["code"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(code__regex=r"^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$"),
                name="seller_permission_code_format",
            ),
        ]


class SellerRole(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    seller = models.ForeignKey(
        Seller, null=True, blank=True, on_delete=models.CASCADE, related_name="roles"
    )
    name = models.CharField(max_length=50)
    permissions = models.ManyToManyField(SellerPermission, through="SellerRolePermission")
    is_system = models.BooleanField(default=True)
    is_owner = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["is_owner"], condition=models.Q(is_owner=True), name="seller_one_owner_role"
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(seller__isnull=True, is_system=True)
                    | models.Q(seller__isnull=False, is_system=False, is_owner=False)
                ),
                name="seller_role_scope_valid",
            ),
            models.UniqueConstraint(
                fields=["name"],
                condition=models.Q(seller__isnull=True),
                name="seller_global_role_name_unique",
            ),
            models.UniqueConstraint(
                fields=["seller", "name"],
                condition=models.Q(seller__isnull=False),
                name="seller_role_name_unique",
            ),
        ]


class SellerRolePermission(models.Model):
    role = models.ForeignKey(SellerRole, on_delete=models.CASCADE)
    permission = models.ForeignKey(SellerPermission, on_delete=models.CASCADE)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["role", "permission"], name="seller_role_permission_unique"
            )
        ]


class SellerMembership(models.Model):
    class Status(models.TextChoices):
        INVITED = "invited"
        ACTIVE = "active"
        SUSPENDED = "suspended"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    seller = models.ForeignKey(Seller, on_delete=models.PROTECT, related_name="memberships")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="seller_memberships"
    )
    role = models.ForeignKey(SellerRole, on_delete=models.PROTECT, related_name="memberships")
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.INVITED)
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="sent_seller_invitations",
    )
    joined_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["seller", "user"], name="seller_user_membership_unique"
            ),
            models.CheckConstraint(
                condition=models.Q(status__in=["invited", "active", "suspended"]),
                name="seller_membership_status_valid",
            ),
            models.CheckConstraint(
                condition=~models.Q(status="active") | models.Q(joined_at__isnull=False),
                name="seller_active_membership_joined",
            ),
        ]
        indexes = [models.Index(fields=["user", "status", "seller"])]
