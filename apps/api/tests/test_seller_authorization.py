from dataclasses import dataclass
from typing import Any
from uuid import uuid4

import pytest
from django.contrib.auth.models import AnonymousUser
from django.db import IntegrityError, connection, transaction
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.platform_access.models import PlatformAccess, PlatformPermission, PlatformRole
from apps.sellers.models import Seller, SellerMembership, SellerPermission, SellerRole
from apps.sellers.selectors import require_seller_access, tenant_queryset
from apps.sellers.services import authorize_role_assignment

pytestmark = pytest.mark.django_db


@dataclass
class Tenants:
    user: User
    other_user: User
    seller: Seller
    other_seller: Seller
    membership: SellerMembership
    other_membership: SellerMembership


def create_seller(slug: str, status: str = Seller.Status.ACTIVE) -> Seller:
    return Seller.objects.create(
        legal_name=f"Legal {slug}",
        display_name=slug,
        slug=slug,
        email=f"{slug}@example.com",
        status=status,
    )


def join(user: User, seller: Seller, role: str = "OWNER") -> SellerMembership:
    return SellerMembership.objects.create(
        user=user,
        seller=seller,
        role=SellerRole.objects.get(name=role, seller=None),
        status=SellerMembership.Status.ACTIVE,
        joined_at=timezone.now(),
    )


@pytest.fixture
def tenants() -> Tenants:
    user = User.objects.create_user("seller-a@example.com")
    other = User.objects.create_user("seller-b@example.com")
    seller = create_seller("seller-a")
    other_seller = create_seller("seller-b")
    return Tenants(user, other, seller, other_seller, join(user, seller), join(other, other_seller))


@pytest.fixture
def browser(tenants: Tenants) -> APIClient:
    client = APIClient(enforce_csrf_checks=True)
    client.force_login(tenants.user, backend="django.contrib.auth.backends.ModelBackend")
    assert client.get("/api/v1/auth/csrf").status_code == 200
    return client


def test_seeded_roles_have_explicit_bounded_permissions() -> None:
    roles = {
        role.name: set(role.permissions.values_list("code", flat=True))
        for role in SellerRole.objects.all()
    }
    assert set(roles) == {
        "OWNER",
        "ADMIN",
        "CATALOG_MANAGER",
        "ORDER_MANAGER",
        "WAREHOUSE_MANAGER",
        "FINANCE_MANAGER",
        "SUPPORT_AGENT",
    }
    assert roles["OWNER"] == set(SellerPermission.objects.values_list("code", flat=True))
    assert roles["ADMIN"] == roles["OWNER"] - {"seller.ownership.manage"}
    assert roles["SUPPORT_AGENT"] == {"seller.context.read", "orders.read"}
    assert roles["FINANCE_MANAGER"] == {"seller.context.read", "finance.read", "payouts.read"}
    assert "inventory.adjust" in roles["WAREHOUSE_MANAGER"]
    assert "orders.cancel" not in roles["WAREHOUSE_MANAGER"]
    assert "staff.update" not in roles["CATALOG_MANAGER"]
    assert SellerRole.objects.get(is_owner=True).name == "OWNER"


def test_seller_access_is_explicit_safe_and_not_cached(
    browser: APIClient, tenants: Tenants
) -> None:
    response = browser.get("/api/v1/seller/access", HTTP_X_SELLER_ID=str(tenants.seller.pk))
    assert response.status_code == 200
    assert response["Cache-Control"] == "no-store"
    assert set(response.data) == {"id", "seller", "role", "status", "permissions"}
    assert response.data["seller"]["id"] == str(tenants.seller.pk)
    assert set(response.data["seller"]) == {
        "id",
        "display_name",
        "slug",
        "status",
        "verification_status",
        "default_currency",
        "timezone",
    }
    assert response.data["role"]["is_owner"] is True
    assert "seller.context.read" in response.data["permissions"]
    assert tenants.other_user.email not in response.content.decode()
    assert tenants.user.password not in response.content.decode()
    assert "approved_by" not in response.data["seller"]


def test_missing_and_foreign_seller_have_identical_404(
    browser: APIClient, tenants: Tenants
) -> None:
    foreign = browser.get("/api/v1/seller/access", HTTP_X_SELLER_ID=str(tenants.other_seller.pk))
    missing = browser.get("/api/v1/seller/access", HTTP_X_SELLER_ID=str(uuid4()))
    assert foreign.status_code == missing.status_code == 404
    assert foreign.data == missing.data == {"detail": "Seller not found."}


@pytest.mark.parametrize("header", [None, "", "invalid", "1", str(uuid4()) + "," + str(uuid4())])
def test_seller_header_must_be_one_uuid(browser: APIClient, header: str | None) -> None:
    if header is None:
        response = browser.get("/api/v1/seller/access")
    else:
        response = browser.get("/api/v1/seller/access", HTTP_X_SELLER_ID=header)
    assert response.status_code == 400


def test_multiple_seller_contexts_are_authorized_independently(
    browser: APIClient, tenants: Tenants
) -> None:
    join(tenants.user, tenants.other_seller, "FINANCE_MANAGER")
    first = browser.get("/api/v1/seller/access", HTTP_X_SELLER_ID=str(tenants.seller.pk))
    second = browser.get("/api/v1/seller/access", HTTP_X_SELLER_ID=str(tenants.other_seller.pk))
    assert first.status_code == second.status_code == 200
    assert first.data["role"]["name"] == "OWNER"
    assert second.data["role"]["name"] == "FINANCE_MANAGER"
    assert "staff.update" not in second.data["permissions"]
    assert "current_seller_id" not in browser.session
    third = browser.get("/api/v1/seller/access", HTTP_X_SELLER_ID=str(tenants.seller.pk))
    assert third.data == first.data


@pytest.mark.parametrize("change", ["membership", "user", "seller", "role", "permission"])
def test_access_revocation_takes_effect_on_next_request(
    browser: APIClient, tenants: Tenants, change: str
) -> None:
    assert (
        browser.get("/api/v1/seller/access", HTTP_X_SELLER_ID=str(tenants.seller.pk)).status_code
        == 200
    )
    if change == "membership":
        SellerMembership.objects.filter(pk=tenants.membership.pk).update(status="suspended")
    elif change == "user":
        User.objects.filter(pk=tenants.user.pk).update(is_active=False)
    elif change == "seller":
        Seller.objects.filter(pk=tenants.seller.pk).update(status="suspended")
    elif change == "role":
        restricted = SellerRole.objects.create(
            seller=tenants.seller, name="No access", is_system=False
        )
        SellerMembership.objects.filter(pk=tenants.membership.pk).update(role=restricted)
    else:
        tenants.membership.role.permissions.remove(
            SellerPermission.objects.get(code="seller.context.read")
        )
    expected = 403 if change in {"user", "role", "permission"} else 404
    assert (
        browser.get("/api/v1/seller/access", HTTP_X_SELLER_ID=str(tenants.seller.pk)).status_code
        == expected
    )


@pytest.mark.parametrize("status", ["invited", "suspended"])
def test_inactive_membership_is_invisible(
    browser: APIClient, tenants: Tenants, status: str
) -> None:
    SellerMembership.objects.filter(pk=tenants.membership.pk).update(status=status)
    assert (
        browser.get("/api/v1/seller/access", HTTP_X_SELLER_ID=str(tenants.seller.pk)).status_code
        == 404
    )
    assert browser.get("/api/v1/seller/memberships").data["results"] == []


@pytest.mark.parametrize("status", ["suspended", "rejected", "closed"])
def test_unavailable_seller_is_invisible(browser: APIClient, tenants: Tenants, status: str) -> None:
    Seller.objects.filter(pk=tenants.seller.pk).update(status=status)
    assert (
        browser.get("/api/v1/seller/access", HTTP_X_SELLER_ID=str(tenants.seller.pk)).status_code
        == 404
    )
    assert browser.get("/api/v1/seller/memberships").data["results"] == []


def test_pending_seller_context_is_available_for_later_onboarding(
    browser: APIClient, tenants: Tenants
) -> None:
    Seller.objects.filter(pk=tenants.seller.pk).update(status="pending")
    response = browser.get("/api/v1/seller/access", HTTP_X_SELLER_ID=str(tenants.seller.pk))
    assert response.status_code == 200
    assert response.data["seller"]["status"] == "pending"


def test_pending_seller_cannot_use_operational_service_guards(tenants: Tenants) -> None:
    Seller.objects.filter(pk=tenants.seller.pk).update(status="pending")
    with pytest.raises(NotFound):
        tenant_queryset(
            user=tenants.user,
            seller_id=tenants.seller.pk,
            capability="staff.read",
            model=SellerMembership,
        )
    with pytest.raises(NotFound):
        authorize_role_assignment(
            actor=tenants.user,
            seller_id=tenants.seller.pk,
            role_id=tenants.membership.role.pk,
            capability="staff.update",
        )


def test_seller_membership_list_cannot_enumerate_other_tenants(
    browser: APIClient, tenants: Tenants
) -> None:
    response = browser.get("/api/v1/seller/memberships")
    assert response.status_code == 200
    assert response.data["count"] == 1
    assert [item["seller"]["id"] for item in response.data["results"]] == [str(tenants.seller.pk)]
    assert str(tenants.other_seller.pk) not in response.content.decode()
    assert tenants.other_user.email not in response.content.decode()


def test_membership_pagination_is_bounded_and_avoids_n_plus_one(
    browser: APIClient, tenants: Tenants
) -> None:
    for index in range(26):
        join(tenants.user, create_seller(f"more-{index:02d}"))
    with CaptureQueriesContext(connection) as queries:
        first = browser.get("/api/v1/seller/memberships")
    assert first.status_code == 200
    assert first.data["count"] == 27
    assert len(first.data["results"]) == 25
    assert len(queries) <= 7
    second = browser.get("/api/v1/seller/memberships?page=2")
    assert second.status_code == 200
    assert len(second.data["results"]) == 2
    assert first.data["next"] is not None and second.data["next"] is None


@pytest.mark.parametrize(
    "query",
    [
        "seller_id=anything",
        "user_id=anything",
        "ordering=email",
        "page_size=10000",
        "page=0",
        "page=-1",
        "page=10001",
        "page=999999999999999999999999",
        "page=last",
        "page=1&page=2",
        "page=1.5",
    ],
)
def test_memberships_reject_unallowlisted_or_abusive_queries(
    browser: APIClient, query: str
) -> None:
    assert browser.get(f"/api/v1/seller/memberships?{query}").status_code == 400


@pytest.mark.parametrize("path", ["/api/v1/seller/access", "/api/v1/seller/memberships"])
def test_seller_endpoints_require_authentication(path: str, tenants: Tenants) -> None:
    client = APIClient()
    assert client.get(path, HTTP_X_SELLER_ID=str(tenants.seller.pk)).status_code == 403


@pytest.mark.parametrize("method", ["post", "patch", "put", "delete"])
def test_no_membership_self_assignment_or_mass_assignment_endpoint(
    browser: APIClient, tenants: Tenants, method: str
) -> None:
    path = "/api/v1/seller/memberships"
    payload = {
        "seller_id": str(tenants.other_seller.pk),
        "user_id": str(tenants.user.pk),
        "role": "OWNER",
    }
    send = getattr(browser, method)
    assert send(path, payload, format="json").status_code == 403
    assert (
        send(
            path, payload, format="json", HTTP_X_CSRFTOKEN=browser.cookies["csrftoken"].value
        ).status_code
        == 405
    )
    assert not SellerMembership.objects.filter(
        user=tenants.user, seller=tenants.other_seller
    ).exists()


def test_tenant_queryset_blocks_foreign_read_enumeration_update_delete(tenants: Tenants) -> None:
    scoped = tenant_queryset(
        user=tenants.user,
        seller_id=tenants.seller.pk,
        capability="staff.read",
        model=SellerMembership,
    )
    assert set(scoped.values_list("pk", flat=True)) == {tenants.membership.pk}
    assert not scoped.filter(pk=tenants.other_membership.pk).exists()
    assert scoped.filter(pk=tenants.other_membership.pk).update(status="suspended") == 0
    assert scoped.filter(pk=tenants.other_membership.pk).delete()[0] == 0
    tenants.other_membership.refresh_from_db()
    assert tenants.other_membership.status == "active"
    assert scoped.filter(pk=tenants.membership.pk).exists()


@pytest.mark.parametrize("operation", ["read", "update", "delete"])
def test_tenant_queryset_rejects_unauthorized_context(tenants: Tenants, operation: str) -> None:
    with pytest.raises(NotFound):
        query = tenant_queryset(
            user=tenants.user,
            seller_id=tenants.other_seller.pk,
            capability="staff.read",
            model=SellerMembership,
        )
        if operation == "read":
            list(query)
        elif operation == "update":
            query.update(status="suspended")
        else:
            query.delete()
    assert SellerMembership.objects.filter(pk=tenants.other_membership.pk, status="active").exists()


def test_service_guards_recheck_stale_user_and_membership(tenants: Tenants) -> None:
    require_seller_access(tenants.user, tenants.seller.pk, "staff.read")
    User.objects.filter(pk=tenants.user.pk).update(is_active=False)
    assert tenants.user.is_active
    with pytest.raises(NotFound):
        require_seller_access(tenants.user, tenants.seller.pk, "staff.read")
    with pytest.raises(NotFound):
        require_seller_access(AnonymousUser(), tenants.seller.pk, "staff.read")


def test_scoping_guard_rejects_models_without_seller_fk(tenants: Tenants) -> None:
    with pytest.raises(TypeError, match="direct Seller foreign key"):
        tenant_queryset(
            user=tenants.user, seller_id=tenants.seller.pk, capability="staff.read", model=User
        )


def test_custom_role_is_seller_scoped_and_can_be_delegated_by_owner(tenants: Tenants) -> None:
    custom = SellerRole.objects.create(
        seller=tenants.seller, name="Catalog reader", is_system=False
    )
    custom.permissions.add(SellerPermission.objects.get(code="catalog.product.read"))
    assert (
        authorize_role_assignment(
            actor=tenants.user,
            seller_id=tenants.seller.pk,
            role_id=custom.pk,
            capability="staff.update",
        ).pk
        == custom.pk
    )
    with pytest.raises(NotFound):
        authorize_role_assignment(
            actor=tenants.other_user,
            seller_id=tenants.other_seller.pk,
            role_id=custom.pk,
            capability="staff.update",
        )


def test_staff_cannot_delegate_permissions_they_do_not_hold(tenants: Tenants) -> None:
    restricted = SellerRole.objects.create(seller=tenants.seller, name="Inviter", is_system=False)
    restricted.permissions.add(SellerPermission.objects.get(code="staff.invite"))
    SellerMembership.objects.filter(pk=tenants.membership.pk).update(role=restricted)
    with pytest.raises(PermissionDenied, match="cannot delegate"):
        authorize_role_assignment(
            actor=tenants.user,
            seller_id=tenants.seller.pk,
            role_id=SellerRole.objects.get(name="ADMIN", seller=None).pk,
            capability="staff.invite",
        )


def test_admin_cannot_assign_owner_or_escalate_self_to_owner(tenants: Tenants) -> None:
    SellerMembership.objects.filter(pk=tenants.membership.pk).update(
        role=SellerRole.objects.get(name="ADMIN", seller=None)
    )
    with pytest.raises(PermissionDenied):
        authorize_role_assignment(
            actor=tenants.user,
            seller_id=tenants.seller.pk,
            role_id=SellerRole.objects.get(is_owner=True).pk,
            capability="staff.update",
        )


def test_ownership_capability_without_owner_identity_cannot_delegate_owner(
    tenants: Tenants,
) -> None:
    custom = SellerRole.objects.create(
        seller=tenants.seller, name="All capabilities", is_system=False
    )
    custom.permissions.set(SellerPermission.objects.all())
    SellerMembership.objects.filter(pk=tenants.membership.pk).update(role=custom)
    with pytest.raises(PermissionDenied, match="ownership permission"):
        authorize_role_assignment(
            actor=tenants.user,
            seller_id=tenants.seller.pk,
            role_id=SellerRole.objects.get(is_owner=True).pk,
            capability="staff.update",
        )


def test_no_capability_is_implied_by_seller_role_name(tenants: Tenants) -> None:
    empty_role = SellerRole.objects.create(seller=tenants.seller, name="ADMIN", is_system=False)
    SellerMembership.objects.filter(pk=tenants.membership.pk).update(role=empty_role)
    with pytest.raises(PermissionDenied):
        require_seller_access(tenants.user, tenants.seller.pk, "staff.update")
    with pytest.raises(PermissionDenied):
        authorize_role_assignment(
            actor=tenants.user,
            seller_id=tenants.seller.pk,
            role_id=SellerRole.objects.get(name="SUPPORT_AGENT", seller=None).pk,
            capability="staff.invite",
        )


def test_role_delegation_requires_explicit_staff_capability(tenants: Tenants) -> None:
    with pytest.raises(ValueError, match="explicit staff capability"):
        authorize_role_assignment(
            actor=tenants.user,
            seller_id=tenants.seller.pk,
            role_id=tenants.membership.role.pk,
            capability="seller.context.read",
        )


def test_membership_unique_and_cross_seller_role_fk_rejected(tenants: Tenants) -> None:
    with pytest.raises(IntegrityError), transaction.atomic():
        join(tenants.user, tenants.seller)
    foreign_role = SellerRole.objects.create(
        seller=tenants.other_seller, name="Foreign", is_system=False
    )
    with pytest.raises(IntegrityError, match="another seller"), transaction.atomic():
        SellerMembership.objects.filter(pk=tenants.membership.pk).update(role=foreign_role)
    unjoined = User.objects.create_user("unjoined@example.com")
    with pytest.raises(IntegrityError, match="another seller"), transaction.atomic():
        SellerMembership.objects.create(user=unjoined, seller=tenants.seller, role=foreign_role)
    tenants.membership.refresh_from_db()
    assert tenants.membership.role.is_owner


@pytest.mark.parametrize("field", ["seller_id", "user_id"])
def test_membership_identity_cannot_be_reassigned(tenants: Tenants, field: str) -> None:
    replacement = tenants.other_seller.pk if field == "seller_id" else tenants.other_user.pk
    with pytest.raises(IntegrityError, match="identity is immutable"), transaction.atomic():
        SellerMembership.objects.filter(pk=tenants.membership.pk).update(**{field: replacement})


def test_role_cannot_be_moved_between_sellers_after_assignment(tenants: Tenants) -> None:
    custom = SellerRole.objects.create(seller=tenants.seller, name="Custom", is_system=False)
    with pytest.raises(IntegrityError, match="identity is immutable"), transaction.atomic():
        SellerRole.objects.filter(pk=custom.pk).update(seller=tenants.other_seller)
    with pytest.raises(IntegrityError, match="identity is immutable"), transaction.atomic():
        SellerRole.objects.filter(pk=custom.pk).update(is_owner=True)


@pytest.mark.parametrize(
    "fields",
    [
        {"status": "typo"},
        {"verification_status": "typo"},
        {"default_currency": "usd"},
        {"default_currency": "US"},
        {"approved_at": timezone.now()},
    ],
)
def test_seller_database_constraints(tenants: Tenants, fields: dict[str, object]) -> None:
    with pytest.raises(IntegrityError), transaction.atomic():
        Seller.objects.filter(pk=tenants.seller.pk).update(**fields)


def test_active_membership_requires_joined_at_and_valid_status(tenants: Tenants) -> None:
    invalid_updates: list[dict[str, object]] = [{"joined_at": None}, {"status": "typo"}]
    for fields in invalid_updates:
        with pytest.raises(IntegrityError), transaction.atomic():
            SellerMembership.objects.filter(pk=tenants.membership.pk).update(**fields)


def test_roles_cannot_be_system_and_seller_owned_or_fake_owner(tenants: Tenants) -> None:
    invalid_roles: list[dict[str, Any]] = [
        {"name": "bad-global", "is_system": False},
        {"name": "bad-local", "seller": tenants.seller},
        {"name": "bad-owner", "seller": tenants.seller, "is_system": False, "is_owner": True},
    ]
    for fields in invalid_roles:
        with pytest.raises(IntegrityError), transaction.atomic():
            SellerRole.objects.create(**fields)


def test_platform_inspection_is_explicit_and_has_no_seller_override(
    browser: APIClient, tenants: Tenants
) -> None:
    PlatformAccess.objects.create(
        user=tenants.user, role=PlatformRole.objects.get(name="SUPER_ADMIN")
    )
    path = f"/api/v1/admin/sellers/{tenants.other_seller.pk}/access"
    response = browser.get(path)
    assert response.status_code == 200
    assert response.data["id"] == str(tenants.other_seller.pk)
    assert response.data["legal_name"] == tenants.other_seller.legal_name
    assert response["Cache-Control"] == "no-store"
    assert (
        browser.get(
            "/api/v1/seller/access", HTTP_X_SELLER_ID=str(tenants.other_seller.pk)
        ).status_code
        == 404
    )
    assert browser.get("/api/v1/seller/memberships").data["count"] == 1
    PlatformAccess.objects.filter(user=tenants.user).update(is_active=False)
    assert browser.get(path).status_code == 403


def test_infrastructure_superuser_does_not_override_either_boundary(
    browser: APIClient, tenants: Tenants
) -> None:
    User.objects.filter(pk=tenants.user.pk).update(is_superuser=True, is_staff=True)
    assert browser.get(f"/api/v1/admin/sellers/{tenants.other_seller.pk}/access").status_code == 403
    assert (
        browser.get(
            "/api/v1/seller/access", HTTP_X_SELLER_ID=str(tenants.other_seller.pk)
        ).status_code
        == 404
    )


def test_platform_access_only_is_insufficient_to_inspect_sellers(
    browser: APIClient, tenants: Tenants
) -> None:
    role = PlatformRole.objects.create(name="Access only")
    role.permissions.add(PlatformPermission.objects.get(code="platform.access"))
    PlatformAccess.objects.create(user=tenants.user, role=role)
    assert browser.get("/api/v1/admin/access").status_code == 200
    assert browser.get(f"/api/v1/admin/sellers/{tenants.other_seller.pk}/access").status_code == 403


def test_foreign_update_delete_requests_do_not_mutate_sellers(
    browser: APIClient, tenants: Tenants
) -> None:
    for method in ["patch", "delete"]:
        response = getattr(browser, method)(
            "/api/v1/seller/access",
            {"status": "active", "role": "OWNER"},
            format="json",
            HTTP_X_SELLER_ID=str(tenants.other_seller.pk),
            HTTP_X_CSRFTOKEN=browser.cookies["csrftoken"].value,
        )
        assert response.status_code == 404
    tenants.other_seller.refresh_from_db()
    tenants.other_membership.refresh_from_db()
    assert tenants.other_seller.status == "active"
    assert tenants.other_membership.role.is_owner
