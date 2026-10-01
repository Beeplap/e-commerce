from datetime import date
from typing import Any
from uuid import UUID, uuid4

from django.contrib.auth.models import AnonymousUser
from django.core.files.base import ContentFile, File
from django.core.files.storage import storages
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.text import slugify
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.accounts.models import User
from apps.audit.models import AuditLog
from apps.platform_access.models import PlatformAccess, PlatformRole, PlatformRolePermission
from apps.sellers.lifecycle_selectors import documents, require_platform
from apps.sellers.lifecycle_serializers import (
    AddressInputSerializer,
    SellerCreateSerializer,
    SellerUpdateSerializer,
)
from apps.sellers.models import (
    Seller,
    SellerAddress,
    SellerDocument,
    SellerMembership,
    SellerProfile,
    SellerRole,
    SellerRolePermission,
    SellerSettings,
    SellerStatusHistory,
)
from apps.sellers.selectors import SellerAccess, require_seller_access
from apps.sellers.uploads import ValidatedDocument


def lock_actor(actor: User | AnonymousUser) -> User:
    if not actor.is_authenticated:
        raise PermissionDenied("Authentication required.")
    user = User.objects.select_for_update().filter(pk=actor.pk, is_active=True).first()
    if user is None:
        raise PermissionDenied("Authentication required.")
    return user


def lock_seller_access(actor: User | AnonymousUser, seller_id: UUID) -> SellerAccess:
    """Call in atomic: user -> seller -> membership -> role -> grant rows."""
    actor = lock_actor(actor)
    access = require_seller_access(actor, seller_id, "seller.settings.update", allow_pending=True)
    Seller.objects.select_for_update().get(pk=access.seller.pk)
    membership = SellerMembership.objects.select_for_update().get(pk=access.membership.pk)
    SellerRole.objects.select_for_update().get(pk=membership.role_id)
    list(SellerRolePermission.objects.select_for_update().filter(role_id=membership.role_id))
    return require_seller_access(actor, seller_id, "seller.settings.update", allow_pending=True)


def lock_platform(actor: User | AnonymousUser, capability: str) -> User:
    actor = lock_actor(actor)
    grant = PlatformAccess.objects.select_for_update().filter(user=actor, is_active=True).first()
    if grant is None:
        raise PermissionDenied("Platform access required.")
    PlatformRole.objects.select_for_update().get(pk=grant.role_id)
    list(PlatformRolePermission.objects.select_for_update().filter(role_id=grant.role_id))
    require_platform(actor, capability)
    return actor


def record(
    actor: User,
    seller: Seller,
    action: str,
    *,
    target_type: str = "seller",
    target_id: UUID | None = None,
    changes: dict[str, Any] | None = None,
    remote_ip: str | None = None,
) -> None:
    AuditLog.objects.create(
        actor_id=actor.pk,
        seller_id=seller.pk,
        action=action,
        target_type=target_type,
        target_id=target_id or seller.pk,
        changes=changes or {},
        remote_ip=remote_ip,
    )


@transaction.atomic
def create_seller(
    actor: User | AnonymousUser, data: dict[str, Any], *, remote_ip: str | None = None
) -> Seller:
    actor = lock_actor(actor)
    serializer = SellerCreateSerializer(data=data)
    serializer.is_valid(raise_exception=True)
    # Bound self-service tenant creation without coupling it to future staff workflows.
    if SellerMembership.objects.filter(user=actor, role__is_owner=True).count() >= 10:
        raise ValidationError("This account has reached the limit of ten owned sellers.")
    identity = uuid4()
    slug = slugify(serializer.validated_data["display_name"])[:90] or "seller"
    seller = Seller.objects.create(
        id=identity,
        slug=f"{slug}-{identity.hex}",
        **serializer.validated_data,
    )
    SellerProfile.objects.create(seller=seller)
    SellerSettings.objects.create(seller=seller)
    SellerMembership.objects.create(
        seller=seller,
        user=actor,
        role=SellerRole.objects.get(is_owner=True),
        status=SellerMembership.Status.ACTIVE,
        joined_at=timezone.now(),
    )
    SellerStatusHistory.objects.create(
        seller=seller, actor_id=actor.pk, from_status="", to_status=Seller.Status.PENDING
    )
    record(
        actor,
        seller,
        "seller.created",
        changes={"status": {"before": None, "after": "pending"}},
        remote_ip=remote_ip,
    )
    return seller


@transaction.atomic
def update_settings(
    actor: User | AnonymousUser,
    seller_id: UUID,
    data: Any,
    *,
    remote_ip: str | None = None,
) -> Seller:
    access = lock_seller_access(actor, seller_id)
    serializer = SellerUpdateSerializer(data=data)
    serializer.is_valid(raise_exception=True)
    values = serializer.validated_data
    seller = access.seller
    changed: list[str] = []
    for field in ("display_name", "email", "phone", "timezone"):
        if getattr(seller, field) != values[field]:
            changed.append(field)
            setattr(seller, field, values[field])
    seller.save(update_fields=["display_name", "email", "phone", "timezone", "updated_at"])
    for model, fields in (
        (SellerProfile, ("description", "website")),
        (SellerSettings, ("support_email",)),
    ):
        obj = model.objects.get(seller=seller)
        for field in fields:
            if getattr(obj, field) != values[field]:
                changed.append(field)
                setattr(obj, field, values[field])
        obj.save()
    record(
        access.membership.user,
        seller,
        "seller.settings.updated",
        changes={"changed_fields": sorted(changed)},
        remote_ip=remote_ip,
    )
    return seller


@transaction.atomic
def save_address(
    actor: User | AnonymousUser,
    seller_id: UUID,
    data: Any,
    *,
    address_id: UUID | None = None,
    remote_ip: str | None = None,
) -> SellerAddress:
    access = lock_seller_access(actor, seller_id)
    serializer = AddressInputSerializer(data=data)
    serializer.is_valid(raise_exception=True)
    values = serializer.validated_data
    seller = access.seller
    address = (
        get_object_or_404(SellerAddress.objects.filter(seller=seller), pk=address_id)
        if address_id
        else None
    )
    if address and address.kind != values["kind"]:
        raise ValidationError({"kind": "Address kind cannot change."})
    if values["kind"] == "registered" and (
        seller.status != Seller.Status.PENDING
        or seller.documents.filter(status="verified").exists()
    ):
        raise ValidationError("Registered identity is frozen after document verification.")
    if address is None:
        if seller.addresses.filter(kind=values["kind"]).exists():
            raise ValidationError({"kind": "This address kind already exists. Edit it instead."})
        address = SellerAddress.objects.create(seller=seller, **values)
    else:
        for field, value in values.items():
            setattr(address, field, value)
        address.save()
    record(
        access.membership.user,
        seller,
        "seller.address.saved",
        target_type="seller_address",
        target_id=address.pk,
        changes={"changed_fields": sorted(values)},
        remote_ip=remote_ip,
    )
    return address


def upload_document(
    actor: User | AnonymousUser,
    seller_id: UUID,
    *,
    document: ValidatedDocument,
    document_type: str,
    expires_at: date | None,
    remote_ip: str | None = None,
) -> SellerDocument:
    stored: str | None = None
    storage = storages["verification"]
    try:
        # Must own the commit so an outer rollback cannot orphan the stored file silently.
        with transaction.atomic(durable=True):
            access = lock_seller_access(actor, seller_id)
            seller = access.seller
            if seller.status != Seller.Status.PENDING:
                raise ValidationError("Documents may only be submitted during onboarding.")
            if document_type not in SellerDocument.DocumentType.values:
                raise ValidationError({"document_type": "Invalid document type."})
            if expires_at is not None and expires_at <= timezone.localdate():
                raise ValidationError({"expires_at": "Expiry must be in the future."})
            if seller.documents.filter(document_type=document_type, status="pending").exists():
                raise ValidationError("A document of this type is awaiting review.")
            if seller.documents.count() >= 50:
                raise ValidationError("Document limit reached. Contact platform support.")
            identity = uuid4()
            stored = storage.save(
                f"{seller.pk}/{identity}.{document.extension}", ContentFile(document.content)
            )
            result = SellerDocument.objects.create(
                id=identity,
                seller=seller,
                document_type=document_type,
                storage_key=stored,
                content_type=document.content_type,
                size=len(document.content),
                sha256=document.sha256,
                uploaded_by_id=access.membership.user_id,
                expires_at=expires_at,
            )
            record(
                access.membership.user,
                seller,
                "seller.document.submitted",
                target_type="seller_document",
                target_id=result.pk,
                changes={"status": {"before": None, "after": "pending"}},
                remote_ip=remote_ip,
            )
        return result
    except Exception:
        # Cleanup errors propagate too: do not silently hide failed compensation.
        if stored is not None:
            storage.delete(stored)
        raise


def prevent_self_review(actor: User, seller: Seller) -> None:
    if SellerMembership.objects.filter(user=actor, seller=seller).exists():
        raise PermissionDenied("Seller members cannot perform platform review of their own seller.")


@transaction.atomic
def review_document(
    actor: User | AnonymousUser,
    seller_id: UUID,
    document_id: UUID,
    *,
    approve: bool,
    reason: str = "",
    remote_ip: str | None = None,
) -> SellerDocument:
    actor = lock_platform(actor, "platform.sellers.documents.review")
    seller = get_object_or_404(Seller.objects.select_for_update(), pk=seller_id)
    prevent_self_review(actor, seller)
    document = get_object_or_404(
        SellerDocument.objects.select_for_update().filter(seller=seller), pk=document_id
    )
    if seller.status != "pending" or document.status != "pending":
        raise ValidationError("Only pending documents for pending sellers can be reviewed.")
    if approve and (
        not seller.addresses.filter(kind="registered").exists()
        or (document.expires_at is not None and document.expires_at <= timezone.localdate())
    ):
        raise ValidationError("A registered address and an unexpired document are required.")
    if not approve and not reason.strip():
        raise ValidationError({"reason": "A rejection reason is required."})
    document.status = "verified" if approve else "rejected"
    document.verified_by_id = actor.pk
    document.verified_at = timezone.now()
    document.rejection_reason = "" if approve else reason.strip()
    document.save(update_fields=["status", "verified_by_id", "verified_at", "rejection_reason"])
    record(
        actor,
        seller,
        "seller.document.verified" if approve else "seller.document.rejected",
        target_type="seller_document",
        target_id=document.pk,
        changes={"status": {"before": "pending", "after": document.status}},
        remote_ip=remote_ip,
    )
    return document


@transaction.atomic
def transition_seller(
    actor: User | AnonymousUser,
    seller_id: UUID,
    *,
    action: str,
    reason: str = "",
    remote_ip: str | None = None,
) -> Seller:
    transitions = {
        "approve": ("pending", "active"),
        "reject": ("pending", "rejected"),
        "suspend": ("active", "suspended"),
        "reactivate": ("suspended", "active"),
    }
    if action not in transitions:
        raise ValueError("Unknown seller action.")
    actor = lock_platform(actor, "platform.sellers.manage")
    seller = get_object_or_404(Seller.objects.select_for_update(), pk=seller_id)
    prevent_self_review(actor, seller)
    before, after = transitions[action]
    if seller.status != before:
        raise ValidationError(f"Cannot {action} a seller in its current state.")
    if action in ("reject", "suspend") and not reason.strip():
        raise ValidationError({"reason": "A reason is required."})
    if action in ("approve", "reactivate"):
        valid = (
            seller.documents.filter(document_type="registration", status="verified")
            .filter(Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.localdate()))
            .exists()
        )
        if not valid or not seller.addresses.filter(kind="registered").exists():
            raise ValidationError(
                "An unexpired verified registration document and registered address are required."
            )
    old_verification = seller.verification_status
    seller.status = after
    if action == "approve":
        seller.approved_by = actor
        seller.approved_at = timezone.now()
        seller.verification_status = "verified"
    elif action == "reject":
        seller.verification_status = "rejected"
    seller.save(
        update_fields=["status", "verification_status", "approved_by", "approved_at", "updated_at"]
    )
    SellerStatusHistory.objects.create(
        seller=seller, actor_id=actor.pk, from_status=before, to_status=after, reason=reason.strip()
    )
    record(
        actor,
        seller,
        f"seller.{action}",
        changes={
            "status": {"before": before, "after": after},
            "verification_status": {
                "before": old_verification,
                "after": seller.verification_status,
            },
        },
        remote_ip=remote_ip,
    )
    return seller


@transaction.atomic
def download_document(
    actor: User | AnonymousUser,
    seller_id: UUID,
    document_id: UUID,
    *,
    platform: bool,
    remote_ip: str | None = None,
) -> tuple[SellerDocument, File[Any]]:
    # Both representations have deliberately separate authorization paths.
    document = documents(actor, seller_id, platform=platform).filter(pk=document_id).first()
    if document is None:
        raise NotFound("Document not found.")
    if not isinstance(actor, User):
        raise PermissionDenied("Authentication required.")
    content = storages["verification"].open(document.storage_key, "rb")
    try:
        record(
            actor,
            document.seller,
            "seller.document.downloaded",
            target_type="seller_document",
            target_id=document.pk,
            remote_ip=remote_ip,
        )
    except Exception:
        content.close()
        raise
    return document, content
