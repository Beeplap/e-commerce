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


class SellerProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    seller = models.OneToOneField(Seller, on_delete=models.PROTECT, related_name="profile")
    description = models.TextField(blank=True, max_length=2000)
    website = models.URLField(blank=True)


class SellerSettings(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    seller = models.OneToOneField(Seller, on_delete=models.PROTECT, related_name="settings")
    support_email = models.EmailField(blank=True)


class SellerAddress(models.Model):
    class Kind(models.TextChoices):
        REGISTERED = "registered"
        RETURNS = "returns"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    seller = models.ForeignKey(Seller, on_delete=models.PROTECT, related_name="addresses")
    kind = models.CharField(max_length=12, choices=Kind.choices)
    line1 = models.CharField(max_length=200)
    line2 = models.CharField(max_length=200, blank=True)
    city = models.CharField(max_length=100)
    region = models.CharField(max_length=100, blank=True)
    postal_code = models.CharField(max_length=20, blank=True)
    country = models.CharField(max_length=2)

    class Meta:
        ordering = ["kind", "id"]
        constraints = [
            models.UniqueConstraint(fields=["seller", "kind"], name="seller_address_kind_unique"),
            models.CheckConstraint(
                condition=models.Q(kind__in=["registered", "returns"]),
                name="seller_address_kind_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(country__regex=r"^[A-Z]{2}$"),
                name="seller_address_country_format",
            ),
        ]


class SellerDocument(models.Model):
    class DocumentType(models.TextChoices):
        REGISTRATION = "registration", "Business registration"
        TAX = "tax", "Tax registration"

    class Status(models.TextChoices):
        PENDING = "pending"
        VERIFIED = "verified"
        REJECTED = "rejected"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    seller = models.ForeignKey(Seller, on_delete=models.PROTECT, related_name="documents")
    document_type = models.CharField(max_length=16, choices=DocumentType.choices)
    # Private storage key only, never a public URL or original filename.
    storage_key = models.CharField(max_length=200, unique=True)
    content_type = models.CharField(max_length=32)
    size = models.PositiveIntegerField()
    sha256 = models.CharField(max_length=64)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    uploaded_by_id = models.UUIDField()
    verified_by_id = models.UUIDField(null=True)
    verified_at = models.DateTimeField(null=True)
    rejection_reason = models.CharField(max_length=500, blank=True)
    expires_at = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(document_type__in=["registration", "tax"]),
                name="seller_document_type_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(content_type__in=["image/png", "image/jpeg"]),
                name="seller_document_content_type",
            ),
            models.CheckConstraint(
                condition=models.Q(size__gt=0, size__lte=5 * 1024 * 1024),
                name="seller_document_size_bounded",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(
                        status="pending",
                        verified_by_id__isnull=True,
                        verified_at__isnull=True,
                        rejection_reason="",
                    )
                    | models.Q(
                        status="verified",
                        verified_by_id__isnull=False,
                        verified_at__isnull=False,
                        rejection_reason="",
                    )
                    | (
                        models.Q(
                            status="rejected",
                            verified_by_id__isnull=False,
                            verified_at__isnull=False,
                        )
                        & ~models.Q(rejection_reason="")
                    )
                ),
                name="seller_document_review_valid",
            ),
            models.UniqueConstraint(
                fields=["seller", "document_type"],
                condition=models.Q(status="pending"),
                name="seller_one_pending_document_type",
            ),
        ]


class SellerStatusHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    seller = models.ForeignKey(Seller, on_delete=models.PROTECT, related_name="status_history")
    actor_id = models.UUIDField()
    from_status = models.CharField(max_length=16, blank=True)
    to_status = models.CharField(max_length=16, choices=Seller.Status.choices)
    reason = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(
                    to_status__in=Seller.Status.values, from_status__in=["", *Seller.Status.values]
                ),
                name="seller_history_status_valid",
            )
        ]
