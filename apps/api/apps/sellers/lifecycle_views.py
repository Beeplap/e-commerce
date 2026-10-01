from typing import Any
from uuid import UUID

from django.db.models import Model, QuerySet
from django.http import FileResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from apps.accounts.security import client_ip
from apps.accounts.serializers import EmptySerializer
from apps.accounts.views import BrowserAPIView
from apps.audit.models import AuditLog
from apps.platform_access.permissions import PlatformCapabilityRequired
from apps.sellers import lifecycle_selectors as selectors
from apps.sellers import lifecycle_serializers as schemas
from apps.sellers import lifecycle_services as services
from apps.sellers.models import SellerMembership, SellerStatusHistory
from apps.sellers.permissions import SellerCapabilityRequired
from apps.sellers.selectors import SellerAccess
from apps.sellers.serializers import SellerInspectionSerializer
from apps.sellers.uploads import validate_document
from config.pagination import BoundedPagination

SELLER_HEADER = OpenApiParameter(
    "X-Seller-ID", OpenApiTypes.UUID, OpenApiParameter.HEADER, required=True
)
PAGE = OpenApiParameter("page", OpenApiTypes.INT, description="1 to 10000; 25 per page")


def paginated(
    view: BrowserAPIView, request: Request, query: QuerySet[Model], serializer: Any
) -> Response:
    pagination = BoundedPagination()
    page = pagination.paginate_queryset(query, request, view)
    return pagination.get_paginated_response(serializer(page, many=True).data)


class SellerOnboardingView(BrowserAPIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=schemas.SellerCreateSerializer,
        responses={201: SellerInspectionSerializer},
        tags=["Seller onboarding"],
    )
    def post(self, request: Request) -> Response:
        serializer = schemas.SellerCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        seller = services.create_seller(
            request.user, serializer.validated_data, remote_ip=client_ip(request._request)
        )
        return Response(SellerInspectionSerializer(seller).data, status=201)


@extend_schema(parameters=[SELLER_HEADER], tags=["Seller settings"])
class SellerSettingsBaseView(BrowserAPIView):
    permission_classes = [SellerCapabilityRequired]
    seller_capability = "seller.settings.read"
    allow_pending_seller = True
    seller_access: SellerAccess


class SellerSettingsView(SellerSettingsBaseView):
    @extend_schema(responses=schemas.SellerDetailSerializer)
    def get(self, request: Request) -> Response:
        return Response(
            schemas.SellerDetailSerializer(
                selectors.seller_detail(request.user, self.seller_access.seller.pk)
            ).data
        )

    @extend_schema(request=schemas.SellerUpdateSerializer, responses=schemas.SellerDetailSerializer)
    def put(self, request: Request) -> Response:
        services.update_settings(
            request.user,
            self.seller_access.seller.pk,
            request.data,
            remote_ip=client_ip(request._request),
        )
        return self.get(request)


@extend_schema(parameters=[SELLER_HEADER], tags=["Seller settings"])
class SellerAddressView(SellerSettingsBaseView):
    http_method_names = ["post", "put", "options"]

    @extend_schema(
        request=schemas.AddressInputSerializer, responses={201: schemas.AddressSerializer}
    )
    def post(self, request: Request) -> Response:
        result = services.save_address(
            request.user,
            self.seller_access.seller.pk,
            request.data,
            remote_ip=client_ip(request._request),
        )
        return Response(schemas.AddressSerializer(result).data, status=201)

    @extend_schema(request=schemas.AddressInputSerializer, responses=schemas.AddressSerializer)
    def put(self, request: Request, address_id: UUID | None = None) -> Response:
        result = services.save_address(
            request.user,
            self.seller_access.seller.pk,
            request.data,
            address_id=address_id,
            remote_ip=client_ip(request._request),
        )
        return Response(schemas.AddressSerializer(result).data)


class SellerAddressCreateView(SellerAddressView):
    http_method_names = ["post", "options"]


class SellerAddressUpdateView(SellerAddressView):
    http_method_names = ["put", "options"]


@extend_schema(parameters=[SELLER_HEADER], tags=["Seller documents"])
class SellerDocumentListView(SellerSettingsBaseView):
    http_method_names = ["get", "options"]
    allowed_query_parameters = frozenset({"page"})

    @extend_schema(responses=schemas.DocumentPageSerializer, parameters=[PAGE])
    def get(self, request: Request) -> Response:
        return paginated(
            self,
            request,
            selectors.documents(request.user, self.seller_access.seller.pk),
            schemas.DocumentSerializer,
        )


@extend_schema(parameters=[SELLER_HEADER], tags=["Seller documents"])
class SellerDocumentUploadView(SellerSettingsBaseView):
    http_method_names = ["post", "options"]
    parser_classes = [MultiPartParser]
    seller_capability = "seller.settings.update"

    @extend_schema(
        request=schemas.DocumentInputSerializer, responses={201: schemas.DocumentSerializer}
    )
    def post(self, request: Request) -> Response:
        serializer = schemas.DocumentInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        document = validate_document(values["file"])
        result = services.upload_document(
            request.user,
            self.seller_access.seller.pk,
            document=document,
            document_type=values["document_type"],
            expires_at=values["expires_at"],
            remote_ip=client_ip(request._request),
        )
        return Response(schemas.DocumentSerializer(result).data, status=201)


@extend_schema(parameters=[SELLER_HEADER], tags=["Seller documents"])
class SellerDocumentDownloadView(SellerSettingsBaseView):
    http_method_names = ["get", "options"]

    @extend_schema(responses={(200, "application/octet-stream"): OpenApiTypes.BINARY})
    def get(self, request: Request, document_id: UUID | None = None) -> FileResponse:
        assert document_id is not None
        document, content = services.download_document(
            request.user,
            self.seller_access.seller.pk,
            document_id,
            platform=False,
            remote_ip=client_ip(request._request),
        )
        return FileResponse(
            content,
            as_attachment=True,
            filename=f"verification-{document.pk}.{document.content_type.split('/')[1]}",
            content_type="application/octet-stream",
        )


class PlatformSellerListView(BrowserAPIView):
    permission_classes = [PlatformCapabilityRequired]
    platform_capability = "platform.sellers.read"
    allowed_query_parameters = frozenset({"page", "search", "status", "verification_status"})

    @extend_schema(
        responses=schemas.SellerListPageSerializer,
        operation_id="admin_sellers_list",
        parameters=[schemas.SellerFilterSerializer],
        tags=["Platform sellers"],
    )
    def get(self, request: Request) -> Response:
        serializer = schemas.SellerFilterSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        return paginated(
            self,
            request,
            selectors.platform_sellers(request.user, serializer.validated_data),
            SellerInspectionSerializer,
        )


class PlatformSellerDetailView(BrowserAPIView):
    permission_classes = [PlatformCapabilityRequired]
    platform_capability = "platform.sellers.read"

    @extend_schema(responses=schemas.SellerDetailSerializer, tags=["Platform sellers"])
    def get(self, request: Request, seller_id: UUID) -> Response:
        return Response(
            schemas.SellerDetailSerializer(
                selectors.seller_detail(request.user, seller_id, platform=True)
            ).data
        )


class PlatformSellerActionView(BrowserAPIView):
    permission_classes = [PlatformCapabilityRequired]
    platform_capability = "platform.sellers.manage"
    action = "approve"

    @extend_schema(
        request=EmptySerializer, responses=SellerInspectionSerializer, tags=["Platform sellers"]
    )
    def post(self, request: Request, seller_id: UUID) -> Response:
        serializer = (
            schemas.ReasonSerializer if self.action in ("reject", "suspend") else EmptySerializer
        )(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = services.transition_seller(
            request.user,
            seller_id,
            action=self.action,
            reason=serializer.validated_data.get("reason", ""),
            remote_ip=client_ip(request._request),
        )
        return Response(SellerInspectionSerializer(result).data)


@extend_schema_view(post=extend_schema(request=schemas.ReasonSerializer))
class PlatformSellerRejectView(PlatformSellerActionView):
    action = "reject"


@extend_schema_view(post=extend_schema(request=schemas.ReasonSerializer))
class PlatformSellerSuspendView(PlatformSellerActionView):
    action = "suspend"


class PlatformSellerReactivateView(PlatformSellerActionView):
    action = "reactivate"


class PlatformDocumentListView(PlatformSellerDetailView):
    platform_capability = "platform.sellers.documents.read"
    allowed_query_parameters = frozenset({"page"})

    @extend_schema(
        responses=schemas.DocumentPageSerializer,
        parameters=[PAGE],
        tags=["Platform seller documents"],
    )
    def get(self, request: Request, seller_id: UUID) -> Response:
        return paginated(
            self,
            request,
            selectors.documents(request.user, seller_id, platform=True),
            schemas.DocumentSerializer,
        )


class PlatformDocumentDownloadView(BrowserAPIView):
    permission_classes = [PlatformCapabilityRequired]
    platform_capability = "platform.sellers.documents.read"

    @extend_schema(
        responses={(200, "application/octet-stream"): OpenApiTypes.BINARY},
        tags=["Platform seller documents"],
    )
    def get(self, request: Request, seller_id: UUID, document_id: UUID) -> FileResponse:
        document, content = services.download_document(
            request.user,
            seller_id,
            document_id,
            platform=True,
            remote_ip=client_ip(request._request),
        )
        return FileResponse(
            content,
            as_attachment=True,
            filename=f"verification-{document.pk}.{document.content_type.split('/')[1]}",
            content_type="application/octet-stream",
        )


class PlatformDocumentReviewView(BrowserAPIView):
    permission_classes = [PlatformCapabilityRequired]
    platform_capability = "platform.sellers.documents.review"
    approve = True

    @extend_schema(
        request=EmptySerializer,
        responses=schemas.DocumentSerializer,
        tags=["Platform seller documents"],
    )
    def post(self, request: Request, seller_id: UUID, document_id: UUID) -> Response:
        serializer = (EmptySerializer if self.approve else schemas.ReasonSerializer)(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)
        document = services.review_document(
            request.user,
            seller_id,
            document_id,
            approve=self.approve,
            reason=serializer.validated_data.get("reason", ""),
            remote_ip=client_ip(request._request),
        )
        return Response(schemas.DocumentSerializer(document).data)


@extend_schema_view(post=extend_schema(request=schemas.ReasonSerializer))
class PlatformDocumentRejectView(PlatformDocumentReviewView):
    approve = False


class PlatformSellerHistoryView(PlatformSellerDetailView):
    allowed_query_parameters = frozenset({"page"})

    @extend_schema(
        responses=schemas.HistoryPageSerializer, parameters=[PAGE], tags=["Platform sellers"]
    )
    def get(self, request: Request, seller_id: UUID) -> Response:
        selectors.seller_detail(request.user, seller_id, platform=True)
        return paginated(
            self,
            request,
            SellerStatusHistory.objects.filter(seller_id=seller_id),
            schemas.HistorySerializer,
        )


class PlatformSellerAuditView(PlatformSellerDetailView):
    platform_capability = "platform.sellers.audit.read"
    allowed_query_parameters = frozenset({"page"})

    @extend_schema(
        responses=schemas.AuditPageSerializer, parameters=[PAGE], tags=["Platform sellers"]
    )
    def get(self, request: Request, seller_id: UUID) -> Response:
        selectors.seller_detail(request.user, seller_id, platform=True)
        return paginated(
            self, request, AuditLog.objects.filter(seller_id=seller_id), schemas.AuditSerializer
        )


class PlatformSellerMembersView(PlatformSellerDetailView):
    allowed_query_parameters = frozenset({"page"})

    @extend_schema(
        responses=schemas.MemberOverviewPageSerializer, parameters=[PAGE], tags=["Platform sellers"]
    )
    def get(self, request: Request, seller_id: UUID) -> Response:
        selectors.seller_detail(request.user, seller_id, platform=True)
        query = (
            SellerMembership.objects.filter(seller_id=seller_id)
            .select_related("user", "role")
            .order_by("created_at", "id")
        )
        return paginated(self, request, query, schemas.MemberOverviewSerializer)
