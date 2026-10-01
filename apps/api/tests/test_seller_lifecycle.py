from collections.abc import Iterable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import timedelta
from io import BytesIO
from threading import Barrier
from typing import Any, cast
from unittest.mock import patch
from uuid import uuid4

import pytest
from django.core.files.storage import storages
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import DatabaseError, IntegrityError, close_old_connections, transaction
from django.http import StreamingHttpResponse
from django.utils import timezone
from PIL import Image
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.audit.models import AuditLog
from apps.platform_access.models import PlatformAccess, PlatformRole
from apps.sellers import lifecycle_services as services
from apps.sellers.models import (
    Seller,
    SellerAddress,
    SellerDocument,
    SellerMembership,
    SellerRole,
    SellerStatusHistory,
)
from apps.sellers.uploads import validate_document

pytestmark = pytest.mark.django_db
CREATE = {
    "legal_name": "Acme Legal",
    "display_name": "Acme",
    "email": "seller@example.com",
    "default_currency": "NPR",
    "timezone": "Asia/Kathmandu",
}
ADDRESS = {"kind": "registered", "line1": "1 Market Road", "city": "Kathmandu", "country": "NP"}
UPDATE = {
    "display_name": "Updated store",
    "email": "updated@example.com",
    "phone": "123",
    "timezone": "UTC",
    "description": "Independent store",
    "website": "https://example.com",
    "support_email": "support@example.com",
}


def client(user: User) -> APIClient:
    browser = APIClient(enforce_csrf_checks=True)
    browser.force_login(user, backend="django.contrib.auth.backends.ModelBackend")
    token = browser.get("/api/v1/auth/csrf").json()["csrf_token"]
    browser.credentials(HTTP_X_CSRFTOKEN=token)
    return browser


def image_file() -> SimpleUploadedFile:
    output = BytesIO()
    Image.new("RGB", (12, 12), "white").save(output, "PNG")
    return SimpleUploadedFile("private-original.png", output.getvalue(), content_type="image/png")


@dataclass
class Setup:
    owner: User
    other: User
    admin: User
    seller: Seller
    foreign: Seller
    browser: APIClient
    platform: APIClient


@pytest.fixture
def setup(settings: Any) -> Setup:
    settings.STORAGES = {
        **settings.STORAGES,
        "verification": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
    }
    owner = User.objects.create_user("owner@example.com")
    other = User.objects.create_user("other@example.com")
    admin = User.objects.create_user("admin@example.com")
    PlatformAccess.objects.create(user=admin, role=PlatformRole.objects.get(name="SUPER_ADMIN"))
    seller = services.create_seller(owner, CREATE)
    foreign = services.create_seller(other, {**CREATE, "display_name": "Foreign"})
    return Setup(owner, other, admin, seller, foreign, client(owner), client(admin))


def upload(setup: Setup, **extra: Any) -> Any:
    return setup.browser.post(
        "/api/v1/seller/documents/upload",
        {"file": image_file(), "document_type": "registration", **extra},
        format="multipart",
        HTTP_X_SELLER_ID=str(setup.seller.pk),
    )


def ready_for_approval(setup: Setup) -> SellerDocument:
    services.save_address(setup.owner, setup.seller.pk, ADDRESS)
    response = upload(setup)
    assert response.status_code == 201, response.data
    document = SellerDocument.objects.get(pk=response.data["id"])
    services.review_document(setup.admin, setup.seller.pk, document.pk, approve=True)
    return document


def test_onboarding_assigns_only_pending_owned_tenant(setup: Setup) -> None:
    response = setup.browser.post("/api/v1/seller/onboarding", CREATE, format="json")
    assert response.status_code == 201
    seller = Seller.objects.get(pk=response.data["id"])
    assert seller.status == "pending" and seller.verification_status == "pending"
    assert seller.memberships.get().user == setup.owner
    assert seller.memberships.get().role.is_owner
    assert seller.profile and seller.settings
    assert AuditLog.objects.filter(seller_id=seller.pk, action="seller.created").exists()
    assert seller.status_history.get().to_status == "pending"


@pytest.mark.parametrize(
    "field",
    ["status", "verification_status", "approved_by", "seller", "user", "role", "commission"],
)
def test_onboarding_rejects_system_fields(setup: Setup, field: str) -> None:
    assert (
        setup.browser.post(
            "/api/v1/seller/onboarding", {**CREATE, field: str(setup.admin.pk)}, format="json"
        ).status_code
        == 400
    )


def test_settings_update_is_explicit_and_audited_without_private_values(setup: Setup) -> None:
    response = setup.browser.put(
        "/api/v1/seller/settings", UPDATE, format="json", HTTP_X_SELLER_ID=str(setup.seller.pk)
    )
    assert response.status_code == 200, response.data
    assert response.data["profile"]["description"] == UPDATE["description"]
    assert response.data["settings"]["support_email"] == UPDATE["support_email"]
    log = AuditLog.objects.get(seller_id=setup.seller.pk, action="seller.settings.updated")
    assert "support_email" in log.changes["changed_fields"]
    assert UPDATE["email"] not in str(log.changes)
    assert log.actor_id == setup.owner.pk


@pytest.mark.parametrize(
    "field",
    [
        "id",
        "status",
        "verification_status",
        "approved_by",
        "default_currency",
        "legal_name",
        "seller",
        "commission",
    ],
)
def test_settings_protected_fields_rejected(setup: Setup, field: str) -> None:
    response = setup.browser.put(
        "/api/v1/seller/settings",
        {**UPDATE, field: "tampered"},
        format="json",
        HTTP_X_SELLER_ID=str(setup.seller.pk),
    )
    assert response.status_code == 400
    setup.seller.refresh_from_db()
    assert setup.seller.status == "pending"


def test_foreign_context_read_write_enumeration_and_fk_attacks(setup: Setup) -> None:
    address = services.save_address(setup.other, setup.foreign.pk, ADDRESS)
    for seller_id in (setup.foreign.pk, uuid4()):
        headers: dict[str, Any] = {"HTTP_X_SELLER_ID": str(seller_id)}
        for route in ("settings", "documents"):
            assert setup.browser.get(f"/api/v1/seller/{route}", **headers).status_code == 404
        assert (
            setup.browser.put(
                "/api/v1/seller/settings", UPDATE, format="json", **headers
            ).status_code
            == 404
        )
    response = setup.browser.put(
        f"/api/v1/seller/addresses/{address.pk}",
        ADDRESS,
        format="json",
        HTTP_X_SELLER_ID=str(setup.seller.pk),
    )
    assert response.status_code == 404
    assert (
        setup.browser.delete(
            f"/api/v1/seller/addresses/{address.pk}", HTTP_X_SELLER_ID=str(setup.seller.pk)
        ).status_code
        == 405
    )
    assert upload(setup, seller=str(setup.foreign.pk)).status_code == 400
    assert setup.browser.get("/api/v1/admin/sellers").status_code == 403


def test_csrf_and_content_types_on_new_mutations(setup: Setup) -> None:
    setup.browser.credentials()
    assert setup.browser.post("/api/v1/seller/onboarding", CREATE, format="json").status_code == 403
    setup.platform.credentials()
    assert (
        setup.platform.post(
            f"/api/v1/admin/sellers/{setup.seller.pk}/approve", {}, format="json"
        ).status_code
        == 403
    )
    browser = client(setup.owner)
    assert (
        browser.post("/api/v1/seller/onboarding", "raw", content_type="text/plain").status_code
        == 415
    )
    assert (
        browser.post(
            "/api/v1/seller/documents/upload",
            {},
            format="json",
            HTTP_X_SELLER_ID=str(setup.seller.pk),
        ).status_code
        == 415
    )


def test_lifecycle_approval_suspension_reactivation_and_history(setup: Setup) -> None:
    base = f"/api/v1/admin/sellers/{setup.seller.pk}"
    assert setup.platform.post(f"{base}/approve", {}, format="json").status_code == 400
    ready_for_approval(setup)
    assert setup.platform.post(f"{base}/approve", {}, format="json").status_code == 200
    assert setup.platform.post(f"{base}/approve", {}, format="json").status_code == 400
    assert setup.platform.post(f"{base}/suspend", {}, format="json").status_code == 400
    assert (
        setup.platform.post(
            f"{base}/suspend", {"reason": "Compliance review"}, format="json"
        ).status_code
        == 200
    )
    assert (
        setup.browser.get(
            "/api/v1/seller/access", HTTP_X_SELLER_ID=str(setup.seller.pk)
        ).status_code
        == 404
    )
    assert (
        setup.browser.put(
            "/api/v1/seller/settings", UPDATE, format="json", HTTP_X_SELLER_ID=str(setup.seller.pk)
        ).status_code
        == 404
    )
    assert setup.platform.post(f"{base}/reactivate", {}, format="json").status_code == 200
    setup.seller.refresh_from_db()
    assert setup.seller.approved_by == setup.admin
    assert setup.seller.verification_status == "verified"
    assert setup.seller.status_history.count() == 4
    assert AuditLog.objects.filter(seller_id=setup.seller.pk, action="seller.suspend").count() == 1
    assert setup.platform.get(f"{base}/history").data["count"] == 4
    assert setup.platform.get(f"{base}/audit").status_code == 200
    assert setup.platform.get(f"{base}/members").data["results"][0]["email"] == setup.owner.email


def test_no_self_review_even_with_platform_capabilities(setup: Setup) -> None:
    document = ready_for_approval(setup)
    PlatformAccess.objects.create(
        user=setup.owner, role=PlatformRole.objects.get(name="SUPER_ADMIN")
    )
    assert (
        setup.browser.post(
            f"/api/v1/admin/sellers/{setup.seller.pk}/approve", {}, format="json"
        ).status_code
        == 403
    )
    assert (
        setup.browser.post(
            f"/api/v1/admin/sellers/{setup.seller.pk}/documents/{document.pk}/approve",
            {},
            format="json",
        ).status_code
        == 403
    )


def test_platform_permissions_are_independent_and_no_seller_override(setup: Setup) -> None:
    role = PlatformRole.objects.create(name="Inspector")
    role.permissions.add(
        PlatformRole.objects.get(name="SUPER_ADMIN").permissions.get(code="platform.sellers.read")
    )
    PlatformAccess.objects.filter(user=setup.admin).update(role=role)
    base = f"/api/v1/admin/sellers/{setup.seller.pk}"
    assert setup.platform.get(base).status_code == 200
    for route in ("documents", "audit"):
        assert setup.platform.get(f"{base}/{route}").status_code == 403
    assert setup.platform.post(f"{base}/approve", {}, format="json").status_code == 403
    assert (
        setup.platform.get(
            "/api/v1/seller/settings", HTTP_X_SELLER_ID=str(setup.seller.pk)
        ).status_code
        == 404
    )


def test_upload_private_names_download_scope_and_audit(setup: Setup) -> None:
    response = upload(setup)
    assert response.status_code == 201, response.data
    document = SellerDocument.objects.get(pk=response.data["id"])
    assert "private-original" not in document.storage_key
    assert "storage_key" not in response.data and "sha256" not in response.data
    url = f"/api/v1/seller/documents/{document.pk}/download"
    download = setup.browser.get(url, HTTP_X_SELLER_ID=str(setup.seller.pk))
    assert download.status_code == 200
    assert download["Content-Disposition"].startswith("attachment;")
    assert download["Cache-Control"] == "no-store"
    assert download["X-Content-Type-Options"] == "nosniff"
    assert b"".join(cast(Iterable[bytes], cast(StreamingHttpResponse, download).streaming_content))
    assert client(setup.other).get(url, HTTP_X_SELLER_ID=str(setup.foreign.pk)).status_code == 404
    assert APIClient().get(url, HTTP_X_SELLER_ID=str(setup.seller.pk)).status_code == 403
    assert (
        setup.platform.get(
            f"/api/v1/admin/sellers/{setup.foreign.pk}/documents/{document.pk}/download"
        ).status_code
        == 404
    )
    assert (
        AuditLog.objects.filter(target_id=document.pk, action="seller.document.downloaded").count()
        == 1
    )
    assert upload(setup).status_code == 400


@pytest.mark.parametrize(
    "filename,mime,content",
    [
        ("evil.svg", "image/svg+xml", b"<svg/>"),
        ("evil.png", "image/png", b"not an image"),
        ("scan.pdf", "application/pdf", b"%PDF-1.7"),
        ("huge.png", "image/png", b"x" * (5 * 1024 * 1024 + 1)),
    ],
    ids=["svg", "malformed", "pdf", "oversized"],
)
def test_invalid_uploads_rejected(setup: Setup, filename: str, mime: str, content: bytes) -> None:
    response = upload(setup, file=SimpleUploadedFile(filename, content, content_type=mime))
    assert response.status_code == 400
    assert not setup.seller.documents.exists()


def test_reencoding_removes_trailing_content() -> None:
    source = image_file()
    source.file = BytesIO(source.read() + b"private metadata and appended script")
    result = validate_document(source)
    assert b"private metadata" not in result.content


def test_document_rejection_resubmission_and_expiry(setup: Setup) -> None:
    assert upload(setup, expires_at=timezone.localdate().isoformat()).status_code == 400
    response = upload(setup)
    document_id = response.data["id"]
    url = f"/api/v1/admin/sellers/{setup.seller.pk}/documents/{document_id}/reject"
    assert setup.platform.post(url, {}, format="json").status_code == 400
    assert setup.platform.post(url, {"reason": "Illegible scan"}, format="json").status_code == 200
    assert (
        upload(
            setup, expires_at=(timezone.localdate() + timedelta(days=30)).isoformat()
        ).status_code
        == 201
    )


def test_review_freezes_registered_identity(setup: Setup) -> None:
    ready_for_approval(setup)
    address = setup.seller.addresses.get()
    response = setup.browser.put(
        f"/api/v1/seller/addresses/{address.pk}",
        {**ADDRESS, "line1": "Changed after review"},
        format="json",
        HTTP_X_SELLER_ID=str(setup.seller.pk),
    )
    assert response.status_code == 400


def test_audit_and_history_database_immutability(setup: Setup) -> None:
    for query in (
        AuditLog.objects.filter(seller_id=setup.seller.pk),
        SellerStatusHistory.objects.filter(seller=setup.seller),
    ):
        with pytest.raises(DatabaseError), transaction.atomic():
            query.delete()
        with pytest.raises(DatabaseError), transaction.atomic():
            query.update(actor_id=uuid4())


def test_database_prevents_address_tenant_reassignment(setup: Setup) -> None:
    address = services.save_address(setup.owner, setup.seller.pk, ADDRESS)
    with pytest.raises(IntegrityError), transaction.atomic():
        SellerAddress.objects.filter(pk=address.pk).update(seller=setup.foreign)


def test_document_evidence_and_review_immutable(setup: Setup) -> None:
    document = ready_for_approval(setup)
    with pytest.raises(DatabaseError), transaction.atomic():
        SellerDocument.objects.filter(pk=document.pk).update(storage_key="replaced")
    with pytest.raises(DatabaseError), transaction.atomic():
        SellerDocument.objects.filter(pk=document.pk).update(status="pending")


def test_failed_audit_rolls_back_transition(setup: Setup) -> None:
    ready_for_approval(setup)
    with (
        patch.object(services, "record", side_effect=RuntimeError("audit unavailable")),
        pytest.raises(RuntimeError),
    ):
        services.transition_seller(setup.admin, setup.seller.pk, action="approve")
    setup.seller.refresh_from_db()
    assert setup.seller.status == "pending"
    assert setup.seller.status_history.count() == 1


def test_failed_upload_audit_compensates_storage(setup: Setup) -> None:
    storage = storages["verification"]
    with (
        patch.object(storage, "delete", wraps=storage.delete) as delete,
        patch.object(services, "record", side_effect=RuntimeError("audit unavailable")),
        pytest.raises(RuntimeError),
    ):
        services.upload_document(
            setup.owner,
            setup.seller.pk,
            document=validate_document(image_file()),
            document_type="registration",
            expires_at=None,
        )
    delete.assert_called_once()
    assert not setup.seller.documents.exists()
    assert not storage.exists(delete.call_args.args[0])


@pytest.mark.parametrize(
    "query",
    [
        "page=0",
        "page=10001",
        "page=1&page=2",
        "ordering=password",
        "status=invalid",
        "verification_status=invalid",
    ],
)
def test_admin_list_rejects_unbounded_or_unknown_filters(setup: Setup, query: str) -> None:
    assert setup.platform.get(f"/api/v1/admin/sellers?{query}").status_code == 400


def test_admin_list_search_filters_and_safe_fields(setup: Setup) -> None:
    result = setup.platform.get(
        "/api/v1/admin/sellers?search=Foreign&status=pending&verification_status=pending"
    )
    assert result.status_code == 200
    assert [row["id"] for row in result.data["results"]] == [str(setup.foreign.pk)]
    assert "documents" not in result.data["results"][0]


def test_role_and_user_revocation_checked_by_service(setup: Setup) -> None:
    SellerMembership.objects.filter(seller=setup.seller).update(
        role=SellerRole.objects.get(name="SUPPORT_AGENT")
    )
    assert (
        setup.browser.put(
            "/api/v1/seller/settings", UPDATE, format="json", HTTP_X_SELLER_ID=str(setup.seller.pk)
        ).status_code
        == 403
    )
    User.objects.filter(pk=setup.admin.pk).update(is_active=False)
    from rest_framework.exceptions import PermissionDenied

    with pytest.raises(PermissionDenied):
        services.transition_seller(setup.admin, setup.seller.pk, action="reject", reason="Review")


@pytest.mark.django_db(transaction=True, serialized_rollback=True)
def test_concurrent_approval_commits_once(setup: Setup) -> None:
    ready_for_approval(setup)
    barrier = Barrier(2)

    def approve() -> str:
        close_old_connections()
        try:
            barrier.wait(timeout=10)
            try:
                services.transition_seller(setup.admin, setup.seller.pk, action="approve")
                return "approved"
            except ValidationError:
                return "refused"
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as workers:
        outcomes = list(workers.map(lambda _: approve(), range(2)))
    assert sorted(outcomes) == ["approved", "refused"]
    assert AuditLog.objects.filter(seller_id=setup.seller.pk, action="seller.approve").count() == 1
    assert setup.seller.status_history.filter(to_status="active").count() == 1
