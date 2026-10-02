from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal
from typing import Any
from unittest.mock import patch
from uuid import uuid4

import pytest
from django.db import DatabaseError, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.catalog.models import Category, Product, ProductVariant
from apps.notifications import services as notif_services
from apps.notifications.models import NotificationDelivery
from apps.orders.models import Order, OrderItem, SellerOrder
from apps.platform_access.models import PlatformAccess, PlatformRole
from apps.promotions import services as promo_services
from apps.promotions.models import Coupon, CouponUsage, Promotion, PromotionProduct
from apps.reviews import services as review_services
from apps.reviews.models import (
    ProductReview,
    ReviewModeration,
    SellerReviewResponse,
)
from apps.sellers.models import (
    Seller,
    SellerMembership,
    SellerRole,
)

pytestmark = pytest.mark.django_db


class JsonClient(APIClient):
    def post(  # type: ignore[override]
        self,
        path: str,
        data: Any = None,
        format: str = "json",
        content_type: str | None = None,
        follow: bool = False,
        **extra: Any,
    ) -> Any:
        return super().post(
            path, data=data, format=format, content_type=content_type, follow=follow, **extra
        )

    def patch(  # type: ignore[override]
        self,
        path: str,
        data: Any = None,
        format: str = "json",
        content_type: str | None = None,
        follow: bool = False,
        **extra: Any,
    ) -> Any:
        return super().patch(
            path, data=data, format=format, content_type=content_type, follow=follow, **extra
        )


def client(user: User) -> APIClient:
    browser = JsonClient(enforce_csrf_checks=True)
    browser.force_login(user, backend="django.contrib.auth.backends.ModelBackend")
    browser.credentials(HTTP_X_CSRFTOKEN=browser.get("/api/v1/auth/csrf").json()["csrf_token"])
    return browser


@dataclass
class Phase10Setup:
    owner_a: User
    staff_a: User
    owner_b: User
    customer: User
    platform_admin: User
    seller_a: Seller
    seller_b: Seller
    membership_a: SellerMembership
    staff_membership_a: SellerMembership
    category: Category
    product_a: Product
    product_b: Product
    variant_a: ProductVariant
    role_owner: SellerRole
    role_catalog: SellerRole
    role_admin: SellerRole


@pytest.fixture
def setup() -> Phase10Setup:
    owner_a = User.objects.create_user(email="owner.a@example.com", password="Password123!")
    staff_a = User.objects.create_user(email="staff.a@example.com", password="Password123!")
    owner_b = User.objects.create_user(email="owner.b@example.com", password="Password123!")
    customer = User.objects.create_user(email="customer@example.com", password="Password123!")
    platform_admin = User.objects.create_user(email="admin@example.com", password="Password123!")

    # Super admin role grant
    super_admin_role = PlatformRole.objects.get(name="SUPER_ADMIN")
    PlatformAccess.objects.create(user=platform_admin, role=super_admin_role, is_active=True)

    role_owner = SellerRole.objects.get(name="OWNER", seller__isnull=True)
    role_admin = SellerRole.objects.get(name="ADMIN", seller__isnull=True)
    role_catalog = SellerRole.objects.get(name="CATALOG_MANAGER", seller__isnull=True)

    seller_a = Seller.objects.create(
        legal_name="Alpha Corp",
        display_name="Alpha Store",
        slug="alpha-store",
        email="contact@alpha.com",
        status=Seller.Status.ACTIVE,
        verification_status=Seller.VerificationStatus.VERIFIED,
    )
    seller_b = Seller.objects.create(
        legal_name="Beta Corp",
        display_name="Beta Store",
        slug="beta-store",
        email="contact@beta.com",
        status=Seller.Status.ACTIVE,
        verification_status=Seller.VerificationStatus.VERIFIED,
    )

    mem_a = SellerMembership.objects.create(
        seller=seller_a,
        user=owner_a,
        role=role_owner,
        status=SellerMembership.Status.ACTIVE,
        joined_at=timezone.now(),
    )
    staff_mem_a = SellerMembership.objects.create(
        seller=seller_a,
        user=staff_a,
        role=role_catalog,
        status=SellerMembership.Status.ACTIVE,
        joined_at=timezone.now(),
    )
    SellerMembership.objects.create(
        seller=seller_b,
        user=owner_b,
        role=role_owner,
        status=SellerMembership.Status.ACTIVE,
        joined_at=timezone.now(),
    )

    category = Category.objects.create(name="Electronics", slug="electronics", is_active=True)

    product_a = Product.objects.create(
        seller=seller_a,
        category=category,
        name="Phone A",
        slug="phone-a",
        created_by=owner_a,
        status=Product.Status.ACTIVE,
    )
    variant_a = ProductVariant.objects.create(
        seller=seller_a,
        product=product_a,
        sku="SKU-A1",
        price=Decimal("500.00"),
        status=ProductVariant.Status.ACTIVE,
    )

    product_b = Product.objects.create(
        seller=seller_b,
        category=category,
        name="Phone B",
        slug="phone-b",
        created_by=owner_b,
        status=Product.Status.ACTIVE,
    )

    return Phase10Setup(
        owner_a=owner_a,
        staff_a=staff_a,
        owner_b=owner_b,
        customer=customer,
        platform_admin=platform_admin,
        seller_a=seller_a,
        seller_b=seller_b,
        membership_a=mem_a,
        staff_membership_a=staff_mem_a,
        category=category,
        product_a=product_a,
        product_b=product_b,
        variant_a=variant_a,
        role_owner=role_owner,
        role_catalog=role_catalog,
        role_admin=role_admin,
    )


# ==============================================================================
# 1. SELLER STAFF & RBAC TESTS
# ==============================================================================


def test_invite_staff_member_success(setup: Phase10Setup) -> None:
    c = client(setup.owner_a)
    response = c.post(
        "/api/v1/seller/staff/invite",
        {"email": "newbie@example.com", "role_id": str(setup.role_admin.pk)},
        HTTP_X_SELLER_ID=str(setup.seller_a.pk),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["user"]["email"] == "newbie@example.com"
    assert data["status"] == "invited"
    assert data["role"]["name"] == "ADMIN"


def test_invite_staff_member_delegation_guard(setup: Phase10Setup) -> None:
    # staff_a has role CATALOG_MANAGER (lacks staff.invite)
    c = client(setup.staff_a)
    response = c.post(
        "/api/v1/seller/staff/invite",
        {"email": "someone@example.com", "role_id": str(setup.role_admin.pk)},
        HTTP_X_SELLER_ID=str(setup.seller_a.pk),
    )
    assert response.status_code == 403


def test_update_staff_role_and_self_modification_forbidden(setup: Phase10Setup) -> None:
    c = client(setup.owner_a)
    # Cannot modify own role
    res_self = c.patch(
        f"/api/v1/seller/staff/{setup.membership_a.pk}/role",
        {"role_id": str(setup.role_admin.pk)},
        HTTP_X_SELLER_ID=str(setup.seller_a.pk),
    )
    assert res_self.status_code == 403

    # Can modify staff_a's role
    res_staff = c.patch(
        f"/api/v1/seller/staff/{setup.staff_membership_a.pk}/role",
        {"role_id": str(setup.role_admin.pk)},
        HTTP_X_SELLER_ID=str(setup.seller_a.pk),
    )
    assert res_staff.status_code == 200
    assert res_staff.json()["role"]["name"] == "ADMIN"


def test_demote_or_revoke_last_owner_forbidden(setup: Phase10Setup) -> None:
    c = client(setup.owner_a)
    # Revoking last owner is forbidden
    res = c.delete(
        f"/api/v1/seller/staff/{setup.membership_a.pk}",
        HTTP_X_SELLER_ID=str(setup.seller_a.pk),
    )
    assert res.status_code in (400, 403)


def test_revoke_staff_membership_success(setup: Phase10Setup) -> None:
    c = client(setup.owner_a)
    res = c.delete(
        f"/api/v1/seller/staff/{setup.staff_membership_a.pk}",
        HTTP_X_SELLER_ID=str(setup.seller_a.pk),
    )
    assert res.status_code == 200
    setup.staff_membership_a.refresh_from_db()
    assert setup.staff_membership_a.status == SellerMembership.Status.SUSPENDED


def test_custom_role_create_and_delegation_guard(setup: Phase10Setup) -> None:
    c = client(setup.owner_a)
    # Owner can create a custom role with a subset of permissions
    res = c.post(
        "/api/v1/seller/staff/roles",
        {
            "name": "Custom Marketing",
            "permissions": ["promotions.read", "promotions.manage", "catalog.product.read"],
        },
        HTTP_X_SELLER_ID=str(setup.seller_a.pk),
    )
    assert res.status_code == 201
    role_id = res.json()["id"]

    # Assigning this custom role to a new member
    res_invite = c.post(
        "/api/v1/seller/staff/invite",
        {"email": "marketer@example.com", "role_id": role_id},
        HTTP_X_SELLER_ID=str(setup.seller_a.pk),
    )
    assert res_invite.status_code == 201


def test_cross_tenant_role_rejected_by_db_trigger(setup: Phase10Setup) -> None:
    # Create custom role belonging to seller A
    custom_role = SellerRole.objects.create(
        seller=setup.seller_a,
        name="Tenant A Custom",
        is_system=False,
    )
    # Assigning custom role of seller A to seller B membership must fail at DB trigger
    with pytest.raises(DatabaseError) as exc_info, transaction.atomic():
        SellerMembership.objects.create(
            seller=setup.seller_b,
            user=setup.staff_a,
            role=custom_role,
            status=SellerMembership.Status.ACTIVE,
            joined_at=timezone.now(),
        )
    assert "Membership role belongs to another seller" in str(exc_info.value)


# ==============================================================================
# 2. PROMOTIONS & COUPONS TESTS
# ==============================================================================


def test_seller_promotion_and_coupon_flow(setup: Phase10Setup) -> None:
    c = client(setup.owner_a)
    now = timezone.now()
    # Create promotion
    res_promo = c.post(
        "/api/v1/seller/promotions",
        {
            "name": "Summer Sale 20%",
            "discount_type": "percentage",
            "discount_value": "20.0000",
            "start_date": (now - timedelta(days=1)).isoformat(),
            "end_date": (now + timedelta(days=10)).isoformat(),
            "min_order_amount": "50.0000",
            "max_discount_amount": "100.0000",
        },
        HTTP_X_SELLER_ID=str(setup.seller_a.pk),
    )
    assert res_promo.status_code == 201
    promo_id = res_promo.json()["id"]

    # Create coupon
    res_coupon = c.post(
        f"/api/v1/seller/promotions/{promo_id}/coupons",
        {
            "code": "SUMMER20",
            "usage_limit": 5,
            "usage_limit_per_customer": 1,
        },
        HTTP_X_SELLER_ID=str(setup.seller_a.pk),
    )
    assert res_coupon.status_code == 201

    # Validate coupon for subtotal 200 -> 20% is 40.0000
    res_val = c.post(
        "/api/v1/promotions/validate",
        {
            "code": "SUMMER20",
            "seller_id": str(setup.seller_a.pk),
            "order_subtotal": "200.0000",
        },
    )
    assert res_val.status_code == 200
    data = res_val.json()
    assert data["valid"] is True
    assert Decimal(data["discount_amount"]) == Decimal("40.0000")


def test_cross_seller_coupon_rejection(setup: Phase10Setup) -> None:
    now = timezone.now()
    promo = promo_services.create_seller_promotion(
        actor=setup.owner_a,
        seller_id=setup.seller_a.pk,
        name="Alpha Discount",
        discount_type="fixed_amount",
        discount_value=Decimal("15.0000"),
        start_date=now - timedelta(days=1),
        end_date=now + timedelta(days=5),
    )
    promo_services.create_coupon(
        actor=setup.owner_a,
        promotion_id=promo.pk,
        code="ALPHA15",
        seller_id=setup.seller_a.pk,
    )

    # Trying to apply ALPHA15 to Seller B must be rejected
    eval_result = promo_services.evaluate_coupon_discount(
        code="ALPHA15",
        seller_id=setup.seller_b.pk,
        order_subtotal=Decimal("100.0000"),
    )
    assert eval_result.is_valid is False
    assert (
        eval_result.error_message is not None
        and "does not apply to this seller" in eval_result.error_message
    )


def test_coupon_usage_immutable_trigger(setup: Phase10Setup) -> None:
    now = timezone.now()
    promo = Promotion.objects.create(
        seller=setup.seller_a,
        scope=Promotion.Scope.SELLER,
        name="Direct Promo",
        discount_type="fixed_amount",
        discount_value=Decimal("10.0000"),
        start_date=now,
        end_date=now + timedelta(days=1),
    )
    coupon = Coupon.objects.create(promotion=promo, code="DIRECT10")
    usage = CouponUsage.objects.create(
        coupon=coupon,
        customer=setup.customer,
        order_id=uuid4(),
        discount_amount=Decimal("10.0000"),
    )

    with pytest.raises(DatabaseError) as exc_info, transaction.atomic():
        usage.discount_amount = Decimal("20.0000")
        usage.save()
    assert "Coupon usage records are append-only" in str(exc_info.value)


def test_targeted_product_cross_seller_rejected_by_trigger(setup: Phase10Setup) -> None:
    now = timezone.now()
    promo_a = Promotion.objects.create(
        seller=setup.seller_a,
        scope=Promotion.Scope.SELLER,
        name="Targeted Promo A",
        discount_type="fixed_amount",
        discount_value=Decimal("10.0000"),
        start_date=now,
        end_date=now + timedelta(days=1),
    )
    # Attempting to target Seller B's product in Seller A's promotion must fail at DB trigger
    with pytest.raises(DatabaseError) as exc_info, transaction.atomic():
        PromotionProduct.objects.create(promotion=promo_a, product=setup.product_b)
    assert "Targeted product must belong to the promotion seller" in str(exc_info.value)


# ==============================================================================
# 3. PRODUCT REVIEWS & MODERATION TESTS
# ==============================================================================


def test_submit_review_and_verified_purchase(setup: Phase10Setup) -> None:
    # Create order item for customer
    order = Order.objects.create(
        customer=setup.customer,
        customer_email=setup.customer.email,
        currency="USD",
        order_number="ORD-REV-1",
        subtotal=Decimal("500.00"),
        grand_total=Decimal("500.00"),
        payment_status=Order.PaymentStatus.PAID,
    )
    seller_order = SellerOrder.objects.create(
        order=order,
        seller=setup.seller_a,
        seller_order_number="SO-REV-1",
        subtotal=Decimal("500.00"),
        seller_net_total=Decimal("450.00"),
    )
    order_item = OrderItem.objects.create(
        seller_order=seller_order,
        product=setup.product_a,
        variant=setup.variant_a,
        product_name_snapshot="Phone A",
        sku_snapshot="SKU-A1",
        quantity=1,
        unit_price=Decimal("500.00"),
        total=Decimal("500.00"),
        seller_net_amount=Decimal("450.00"),
    )

    c = client(setup.customer)
    res = c.post(
        "/api/v1/reviews",
        {
            "product_id": str(setup.product_a.pk),
            "order_item_id": str(order_item.pk),
            "rating": 5,
            "title": "Superb phone!",
            "body": "Really enjoyed using this device, battery life is amazing.",
        },
    )
    assert res.status_code == 201
    review_data = res.json()
    assert review_data["rating"] == 5
    assert review_data["verified_purchase"] is True


def test_duplicate_review_prevented(setup: Phase10Setup) -> None:
    review_services.submit_product_review(
        customer=setup.customer,
        product_id=setup.product_a.pk,
        rating=4,
        title="Initial review",
        body="Good stuff.",
    )
    with pytest.raises(ValidationError) as exc_info:
        review_services.submit_product_review(
            customer=setup.customer,
            product_id=setup.product_a.pk,
            rating=5,
            title="Second review",
            body="Another attempt.",
        )
    assert "already reviewed" in str(exc_info.value)


def test_seller_respond_to_review(setup: Phase10Setup) -> None:
    review = review_services.submit_product_review(
        customer=setup.customer,
        product_id=setup.product_a.pk,
        rating=4,
        title="Good phone",
        body="Works as advertised.",
    )
    c = client(setup.owner_a)
    res = c.post(
        f"/api/v1/seller/reviews/{review.pk}/respond",
        {"response": "Thank you for your feedback! We appreciate your business."},
        HTTP_X_SELLER_ID=str(setup.seller_a.pk),
    )
    assert res.status_code == 200
    assert "Thank you" in res.json()["response"]


def test_cross_seller_review_response_rejected_by_trigger(setup: Phase10Setup) -> None:
    review_b = review_services.submit_product_review(
        customer=setup.customer,
        product_id=setup.product_b.pk,
        rating=3,
        title="Phone B review",
        body="Decent.",
    )
    # Attempting to respond to Seller B's review as Seller A must fail at DB trigger
    with pytest.raises(DatabaseError) as exc_info, transaction.atomic():
        SellerReviewResponse.objects.create(
            review=review_b,
            seller=setup.seller_a,
            responder=setup.owner_a,
            response="Sneaky response",
        )
    assert "Seller response must belong to the product seller" in str(exc_info.value)


def test_platform_moderate_review_and_immutability(setup: Phase10Setup) -> None:
    review = review_services.submit_product_review(
        customer=setup.customer,
        product_id=setup.product_a.pk,
        rating=1,
        title="Spam title",
        body="Spam content.",
    )
    c = client(setup.platform_admin)
    res = c.post(
        f"/api/v1/admin/reviews/{review.pk}/moderate",
        {"action": "hide", "reason": "Violates review policy on advertising."},
    )
    assert res.status_code == 200
    review.refresh_from_db()
    assert review.status == ProductReview.Status.HIDDEN

    # DB trigger immutability for ReviewModeration
    moderation = ReviewModeration.objects.get(review=review)
    with pytest.raises(DatabaseError) as exc_info, transaction.atomic():
        moderation.reason = "Changed reason"
        moderation.save()
    assert "Review moderation records are append-only" in str(exc_info.value)


# ==============================================================================
# 4. NOTIFICATION INFRASTRUCTURE TESTS
# ==============================================================================


def test_send_notification_and_channel_isolation(setup: Phase10Setup) -> None:
    notif = notif_services.send_notification(
        recipient=setup.customer,
        type="ORDER_DISPATCHED",
        title="Your order is on the way!",
        message="Package tracked via DHL.",
        channels=("in_app", "email"),
    )
    assert notif.pk is not None
    assert NotificationDelivery.objects.filter(notification=notif).count() >= 1


def test_notification_delivery_failure_does_not_rollback_transaction(setup: Phase10Setup) -> None:
    # Mock send_mail to raise an exception
    with (
        patch(
            "apps.notifications.services.send_mail",
            side_effect=RuntimeError("SMTP connection dropped"),
        ),
        transaction.atomic(),
    ):
        notif = notif_services.send_notification(
            recipient=setup.customer,
            type="ALERT",
            title="Critical update",
            message="Message body",
            channels=("in_app", "email"),
        )
        # Even with email failure, notif was created and enclosing transaction committed
        assert notif.pk is not None

    email_delivery = NotificationDelivery.objects.filter(
        notification=notif, channel=NotificationDelivery.Channel.EMAIL
    ).first()
    assert email_delivery is not None
    assert email_delivery.status == NotificationDelivery.Status.FAILED
    assert "SMTP connection dropped" in email_delivery.error_message


def test_mark_notification_read_flow(setup: Phase10Setup) -> None:
    notif = notif_services.send_notification(
        recipient=setup.customer,
        type="WELCOME",
        title="Welcome",
        message="Welcome to Quick Commerce",
        channels=("in_app",),
    )
    c = client(setup.customer)

    # Check unread count is 1
    res_count = c.get("/api/v1/notifications/unread-count")
    assert res_count.status_code == 200
    assert res_count.json()["unread_count"] == 1

    # Mark as read
    res_read = c.post(f"/api/v1/notifications/{notif.pk}/read")
    assert res_read.status_code == 200
    assert res_read.json()["read_at"] is not None

    # Count is now 0
    res_count2 = c.get("/api/v1/notifications/unread-count")
    assert res_count2.json()["unread_count"] == 0
