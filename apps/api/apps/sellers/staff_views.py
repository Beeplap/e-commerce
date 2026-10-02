from typing import cast
from uuid import UUID

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from apps.accounts.models import User
from apps.accounts.views import BrowserAPIView
from apps.sellers.models import SellerMembership, SellerPermission
from apps.sellers.permissions import SellerCapabilityRequired
from apps.sellers.selectors import SellerAccess, assignable_roles
from apps.sellers.staff_serializers import (
    CustomRoleCreateInputSerializer,
    CustomRoleUpdateInputSerializer,
    StaffInviteInputSerializer,
    StaffMembershipSerializer,
    StaffPermissionSerializer,
    StaffRoleSerializer,
    StaffRoleUpdateInputSerializer,
)
from apps.sellers.staff_services import (
    create_custom_role,
    delete_custom_role,
    invite_staff_member,
    revoke_staff_membership,
    update_custom_role,
    update_staff_role,
)
from config.pagination import BoundedPagination


class SellerStaffListView(BrowserAPIView):
    permission_classes = [SellerCapabilityRequired]
    seller_capability = "staff.read"
    seller_access: SellerAccess

    @extend_schema(responses={200: StaffMembershipSerializer(many=True)}, tags=["Seller staff"])
    def get(self, request: Request) -> Response:
        seller = self.seller_access.seller
        members = (
            SellerMembership.objects.filter(seller=seller)
            .select_related("user", "role")
            .prefetch_related("role__permissions")
            .order_by("role__name", "user__email")
        )
        pagination = BoundedPagination()
        page = pagination.paginate_queryset(members, request, self)
        return pagination.get_paginated_response(StaffMembershipSerializer(page, many=True).data)


class SellerStaffInviteView(BrowserAPIView):
    permission_classes = [SellerCapabilityRequired]
    seller_capability = "staff.invite"
    seller_access: SellerAccess

    @extend_schema(
        request=StaffInviteInputSerializer,
        responses={201: StaffMembershipSerializer},
        tags=["Seller staff"],
    )
    def post(self, request: Request) -> Response:
        serializer = StaffInviteInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = cast(User, request.user)
        membership = invite_staff_member(
            actor=user,
            seller_id=self.seller_access.seller.pk,
            email=serializer.validated_data["email"],
            role_id=serializer.validated_data["role_id"],
            remote_ip=getattr(request, "client_ip", None),
        )
        return Response(StaffMembershipSerializer(membership).data, status=status.HTTP_201_CREATED)


class SellerStaffRoleUpdateView(BrowserAPIView):
    permission_classes = [SellerCapabilityRequired]
    seller_capability = "staff.update"
    seller_access: SellerAccess

    @extend_schema(
        request=StaffRoleUpdateInputSerializer,
        responses={200: StaffMembershipSerializer},
        tags=["Seller staff"],
    )
    def patch(self, request: Request, membership_id: UUID) -> Response:
        serializer = StaffRoleUpdateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = cast(User, request.user)
        membership = update_staff_role(
            actor=user,
            seller_id=self.seller_access.seller.pk,
            membership_id=membership_id,
            new_role_id=serializer.validated_data["role_id"],
            remote_ip=getattr(request, "client_ip", None),
        )
        return Response(StaffMembershipSerializer(membership).data)


class SellerStaffRevokeView(BrowserAPIView):
    permission_classes = [SellerCapabilityRequired]
    seller_capability = "staff.remove"
    seller_access: SellerAccess

    @extend_schema(
        responses={200: StaffMembershipSerializer},
        tags=["Seller staff"],
    )
    def delete(self, request: Request, membership_id: UUID) -> Response:
        user = cast(User, request.user)
        membership = revoke_staff_membership(
            actor=user,
            seller_id=self.seller_access.seller.pk,
            membership_id=membership_id,
            remote_ip=getattr(request, "client_ip", None),
        )
        return Response(StaffMembershipSerializer(membership).data)


class SellerRoleListView(BrowserAPIView):
    permission_classes = [SellerCapabilityRequired]
    seller_capability = "staff.read"
    seller_access: SellerAccess

    @extend_schema(responses={200: StaffRoleSerializer(many=True)}, tags=["Seller staff roles"])
    def get(self, request: Request) -> Response:
        seller_id = self.seller_access.seller.pk
        roles = assignable_roles(seller_id).order_by("is_system", "name")
        return Response(StaffRoleSerializer(roles, many=True).data)

    @extend_schema(
        request=CustomRoleCreateInputSerializer,
        responses={201: StaffRoleSerializer},
        tags=["Seller staff roles"],
    )
    def post(self, request: Request) -> Response:
        # Creating custom roles requires staff.update
        if "staff.update" not in self.seller_access.permissions:
            return Response(
                {"detail": "You do not have permission to manage custom roles."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = CustomRoleCreateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = cast(User, request.user)
        role = create_custom_role(
            actor=user,
            seller_id=self.seller_access.seller.pk,
            name=serializer.validated_data["name"],
            permission_codes=serializer.validated_data["permissions"],
            remote_ip=getattr(request, "client_ip", None),
        )
        return Response(StaffRoleSerializer(role).data, status=status.HTTP_201_CREATED)


class SellerRoleDetailView(BrowserAPIView):
    permission_classes = [SellerCapabilityRequired]
    seller_capability = "staff.update"
    seller_access: SellerAccess

    @extend_schema(
        request=CustomRoleUpdateInputSerializer,
        responses={200: StaffRoleSerializer},
        tags=["Seller staff roles"],
    )
    def patch(self, request: Request, role_id: UUID) -> Response:
        serializer = CustomRoleUpdateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = cast(User, request.user)
        role = update_custom_role(
            actor=user,
            seller_id=self.seller_access.seller.pk,
            role_id=role_id,
            name=serializer.validated_data.get("name"),
            permission_codes=serializer.validated_data.get("permissions"),
            remote_ip=getattr(request, "client_ip", None),
        )
        return Response(StaffRoleSerializer(role).data)

    @extend_schema(responses={204: None}, tags=["Seller staff roles"])
    def delete(self, request: Request, role_id: UUID) -> Response:
        user = cast(User, request.user)
        delete_custom_role(
            actor=user,
            seller_id=self.seller_access.seller.pk,
            role_id=role_id,
            remote_ip=getattr(request, "client_ip", None),
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class SellerAssignablePermissionsView(BrowserAPIView):
    permission_classes = [SellerCapabilityRequired]
    seller_capability = "staff.read"
    seller_access: SellerAccess

    @extend_schema(
        responses={200: StaffPermissionSerializer(many=True)}, tags=["Seller staff roles"]
    )
    def get(self, request: Request) -> Response:
        # Return only permissions that current actor actually holds
        actor_perm_codes = self.seller_access.permissions
        perms = SellerPermission.objects.filter(code__in=actor_perm_codes).order_by("code")
        return Response(StaffPermissionSerializer(perms, many=True).data)
