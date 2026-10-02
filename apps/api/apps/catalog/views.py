from typing import Any
from uuid import UUID

from django.core.files.storage import storages
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import (
    OpenApiParameter,
    PolymorphicProxySerializer,
    extend_schema,
    extend_schema_view,
)
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.parsers import MultiPartParser
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import Serializer

from apps.accounts.serializers import EmptySerializer
from apps.accounts.views import BrowserAPIView
from apps.catalog import selectors, services
from apps.catalog import serializers as schemas
from apps.catalog.models import VariantAttributeValue
from apps.platform_access.permissions import PlatformCapabilityRequired
from apps.sellers.lifecycle_serializers import ReasonSerializer
from apps.sellers.permissions import SellerCapabilityRequired
from apps.sellers.selectors import SellerAccess
from apps.sellers.uploads import validate_document
from config.pagination import paginated_response

KINDS = list(selectors.TAXONOMY_MODELS)
OUTPUTS: dict[str, type[Serializer[Any]]] = {
    "categories": schemas.CategoryOutput,
    "brands": schemas.BrandOutput,
    "attributes": schemas.AttributeOutput,
    "options": schemas.OptionOutput,
    "category-attributes": schemas.CategoryAttributeOutput,
}
CATALOG_INPUT = PolymorphicProxySerializer(
    component_name="CatalogInput",
    serializers=[
        schemas.CategoryInput,
        schemas.BrandInput,
        schemas.AttributeInput,
        schemas.OptionInput,
        schemas.CategoryAttributeInput,
    ],
    resource_type_field_name=None,
)
CATALOG_OUTPUT = PolymorphicProxySerializer(
    component_name="CatalogRecord",
    serializers=list(OUTPUTS.values()),
    resource_type_field_name=None,
)
CATALOG_PAGE = PolymorphicProxySerializer(
    component_name="CatalogPage",
    serializers=[
        schemas.CategoryPage,
        schemas.BrandPage,
        schemas.AttributePage,
        schemas.OptionPage,
        schemas.CategoryAttributePage,
    ],
    resource_type_field_name=None,
)
HEADER = OpenApiParameter("X-Seller-ID", OpenApiTypes.UUID, OpenApiParameter.HEADER, required=True)
KIND = OpenApiParameter("kind", OpenApiTypes.STR, OpenApiParameter.PATH, enum=KINDS)
PAGE = OpenApiParameter("page", OpenApiTypes.INT, description="1 to 10000; 25 per page")


def known_kind(kind: str) -> None:
    if kind not in KINDS:
        raise NotFound("Catalog resource not found.")


def catalog_filters(request: Request, kind: str) -> dict[str, Any]:
    allowed = (
        {"page", "search"}
        if kind in ("categories", "brands", "attributes", "options")
        else {"page"}
    )
    if kind in ("attributes", "category-attributes"):
        allowed.add("category_id")
    if kind == "options":
        allowed.add("attribute_id")
    if set(request.query_params) - allowed:
        raise ValidationError("Unsupported catalog filters.")
    serializer = schemas.CatalogFilter(data=request.query_params)
    serializer.is_valid(raise_exception=True)
    return dict(serializer.validated_data)


class PlatformCatalogView(BrowserAPIView):
    permission_classes = [PlatformCapabilityRequired]
    platform_capability = "platform.catalog.read"
    allowed_query_parameters = frozenset({"page", "search", "category_id", "attribute_id"})

    @extend_schema(
        responses=CATALOG_PAGE, parameters=[KIND, schemas.CatalogFilter], tags=["Platform catalog"]
    )
    def get(self, request: Request, kind: str) -> Response:
        known_kind(kind)
        return paginated_response(
            self,
            request,
            selectors.taxonomy(request.user, kind, catalog_filters(request, kind)),
            OUTPUTS[kind],
        )

    @extend_schema(
        request=CATALOG_INPUT,
        responses={201: CATALOG_OUTPUT},
        parameters=[KIND],
        tags=["Platform catalog"],
    )
    def post(self, request: Request, kind: str) -> Response:
        known_kind(kind)
        if request.query_params:
            raise ValidationError("Query parameters are not supported for writes.")
        obj = services.save_taxonomy(request.user, kind, request.data)
        return Response(OUTPUTS[kind](obj).data, status=201)


class PlatformCatalogDetailView(BrowserAPIView):
    permission_classes = [PlatformCapabilityRequired]
    platform_capability = "platform.catalog.manage"

    @extend_schema(
        request=CATALOG_INPUT,
        responses=CATALOG_OUTPUT,
        parameters=[KIND],
        tags=["Platform catalog"],
    )
    def put(self, request: Request, kind: str, identity: UUID) -> Response:
        known_kind(kind)
        obj = services.save_taxonomy(request.user, kind, request.data, identity=identity)
        return Response(OUTPUTS[kind](obj).data)


class SellerCatalogView(BrowserAPIView):
    permission_classes = [SellerCapabilityRequired]
    seller_capability = "catalog.product.read"
    seller_access: SellerAccess
    allowed_query_parameters = PlatformCatalogView.allowed_query_parameters

    @extend_schema(
        responses=CATALOG_PAGE,
        parameters=[HEADER, KIND, schemas.CatalogFilter],
        tags=["Seller catalog"],
    )
    def get(self, request: Request, kind: str) -> Response:
        known_kind(kind)
        return paginated_response(
            self,
            request,
            selectors.taxonomy(
                request.user,
                kind,
                catalog_filters(request, kind),
                seller_id=self.seller_access.seller.pk,
            ),
            OUTPUTS[kind],
        )


class SellerProductBase(BrowserAPIView):
    permission_classes = [SellerCapabilityRequired]
    seller_capability = "catalog.product.read"
    seller_access: SellerAccess


@extend_schema(parameters=[HEADER], tags=["Seller products"])
class SellerProductsView(SellerProductBase):
    allowed_query_parameters = frozenset({"page", "search", "status", "category_id"})

    @extend_schema(
        responses=schemas.ProductPage,
        parameters=[schemas.ProductFilter],
        operation_id="seller_products_list",
    )
    def get(self, request: Request) -> Response:
        serializer = schemas.ProductFilter(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        return paginated_response(
            self,
            request,
            selectors.products(
                request.user, serializer.validated_data, seller_id=self.seller_access.seller.pk
            ),
            schemas.ProductOutput,
        )

    @extend_schema(request=schemas.ProductInput, responses={201: schemas.ProductOutput})
    def post(self, request: Request) -> Response:
        if request.query_params:
            raise ValidationError("Query parameters are not supported for writes.")
        product = services.create_product(request.user, self.seller_access.seller.pk, request.data)
        return Response(schemas.ProductOutput(product).data, status=201)


@extend_schema(parameters=[HEADER], tags=["Seller products"])
class SellerProductView(SellerProductBase):
    @extend_schema(responses=schemas.ProductOutput)
    def get(self, request: Request, product_id: UUID) -> Response:
        return Response(
            schemas.ProductOutput(
                selectors.product(request.user, product_id, seller_id=self.seller_access.seller.pk)
            ).data
        )

    @extend_schema(request=schemas.ProductInput, responses=schemas.ProductOutput)
    def put(self, request: Request, product_id: UUID) -> Response:
        return Response(
            schemas.ProductOutput(
                services.update_product(
                    request.user, self.seller_access.seller.pk, product_id, request.data
                )
            ).data
        )


@extend_schema(parameters=[HEADER], tags=["Seller products"])
class SellerProductActionView(SellerProductBase):
    action = "submit-for-review"
    seller_capability = "catalog.product.update"

    @extend_schema(request=EmptySerializer, responses=schemas.ProductOutput)
    def post(self, request: Request, product_id: UUID) -> Response:
        serializer = EmptySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = services.seller_action(
            request.user, self.seller_access.seller.pk, product_id, self.action
        )
        return Response(schemas.ProductOutput(product).data)


class SellerProductReviseView(SellerProductActionView):
    action = "revise"


class SellerProductArchiveView(SellerProductActionView):
    action = "archive"
    seller_capability = "catalog.product.archive"


class PlatformProductsView(BrowserAPIView):
    permission_classes = [PlatformCapabilityRequired]
    platform_capability = "platform.products.read"
    allowed_query_parameters = SellerProductsView.allowed_query_parameters

    @extend_schema(
        responses=schemas.ProductPage,
        parameters=[schemas.ProductFilter],
        tags=["Platform products"],
        operation_id="admin_products_list",
    )
    def get(self, request: Request) -> Response:
        serializer = schemas.ProductFilter(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        return paginated_response(
            self,
            request,
            selectors.products(request.user, serializer.validated_data),
            schemas.ProductOutput,
        )


class PlatformProductView(BrowserAPIView):
    permission_classes = [PlatformCapabilityRequired]
    platform_capability = "platform.products.read"

    @extend_schema(responses=schemas.ProductOutput, tags=["Platform products"])
    def get(self, request: Request, product_id: UUID) -> Response:
        return Response(schemas.ProductOutput(selectors.product(request.user, product_id)).data)


class PlatformProductModerateView(BrowserAPIView):
    permission_classes = [PlatformCapabilityRequired]
    platform_capability = "platform.products.moderate"
    approve = True

    @extend_schema(
        request=EmptySerializer, responses=schemas.ProductOutput, tags=["Platform products"]
    )
    def post(self, request: Request, product_id: UUID) -> Response:
        serializer = (EmptySerializer if self.approve else ReasonSerializer)(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = services.moderate_product(
            request.user,
            product_id,
            approve=self.approve,
            reason=serializer.validated_data.get("reason", ""),
        )
        return Response(schemas.ProductOutput(result).data)


@extend_schema_view(post=extend_schema(request=ReasonSerializer))
class PlatformProductRejectView(PlatformProductModerateView):
    approve = False


@extend_schema(parameters=[HEADER], tags=["Seller products"])
class SellerVariantsView(SellerProductBase):
    allowed_query_parameters = frozenset({"page"})

    @extend_schema(responses=schemas.VariantPage, parameters=[PAGE])
    def get(self, request: Request, product_id: UUID) -> Response:
        return paginated_response(
            self,
            request,
            selectors.child_rows(
                request.user, product_id, "variants", seller_id=self.seller_access.seller.pk
            ),
            schemas.VariantOutput,
        )

    @extend_schema(request=schemas.VariantInput, responses={201: schemas.VariantOutput})
    def post(self, request: Request, product_id: UUID) -> Response:
        if request.query_params:
            raise ValidationError("Query parameters are not supported for writes.")
        variant = services.save_variant(
            request.user, self.seller_access.seller.pk, product_id, request.data
        )
        return Response(schemas.VariantOutput(variant).data, status=201)


@extend_schema(parameters=[HEADER], tags=["Seller products"])
class SellerVariantView(SellerProductBase):
    @extend_schema(request=schemas.VariantInput, responses=schemas.VariantOutput)
    def put(self, request: Request, product_id: UUID, variant_id: UUID) -> Response:
        result = services.save_variant(
            request.user,
            self.seller_access.seller.pk,
            product_id,
            request.data,
            variant_id=variant_id,
        )
        return Response(schemas.VariantOutput(result).data)


@extend_schema(parameters=[HEADER], tags=["Seller products"])
class SellerValuesView(SellerProductBase):
    allowed_query_parameters = frozenset({"page"})
    variant_scope = False

    @extend_schema(responses=schemas.ProductValuePage, parameters=[PAGE])
    def get(self, request: Request, product_id: UUID, variant_id: UUID | None = None) -> Response:
        query = selectors.child_rows(
            request.user,
            product_id,
            "variant-attributes" if self.variant_scope else "attributes",
            seller_id=self.seller_access.seller.pk,
            variant_id=variant_id,
        )
        return paginated_response(
            self,
            request,
            query,
            schemas.VariantValueOutput if self.variant_scope else schemas.ProductValueOutput,
        )

    @extend_schema(request=schemas.AttributeValueInput, responses=schemas.ProductValueOutput)
    def put(self, request: Request, product_id: UUID, variant_id: UUID | None = None) -> Response:
        if request.query_params:
            raise ValidationError("Query parameters are not supported for writes.")
        result = services.save_attribute_value(
            request.user,
            self.seller_access.seller.pk,
            product_id,
            request.data,
            variant_id=variant_id,
        )
        if isinstance(result, VariantAttributeValue):
            return Response(schemas.VariantValueOutput(result).data)
        return Response(schemas.ProductValueOutput(result).data)


@extend_schema_view(
    get=extend_schema(responses=schemas.VariantValuePage),
    put=extend_schema(responses=schemas.VariantValueOutput),
)
class SellerVariantValuesView(SellerValuesView):
    variant_scope = True


@extend_schema(parameters=[HEADER], tags=["Seller products"])
class SellerValueRemoveView(SellerProductBase):
    @extend_schema(responses={204: None})
    def delete(
        self, request: Request, product_id: UUID, value_id: UUID, variant_id: UUID | None = None
    ) -> Response:
        serializer = EmptySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.remove_attribute_value(
            request.user, self.seller_access.seller.pk, product_id, value_id, variant_id=variant_id
        )
        return Response(status=204)


@extend_schema(parameters=[HEADER], tags=["Seller products"])
class SellerImagesView(SellerProductBase):
    allowed_query_parameters = frozenset({"page"})

    @extend_schema(responses=schemas.ImagePage, parameters=[PAGE])
    def get(self, request: Request, product_id: UUID) -> Response:
        return paginated_response(
            self,
            request,
            selectors.child_rows(
                request.user, product_id, "images", seller_id=self.seller_access.seller.pk
            ),
            schemas.ImageOutput,
        )


@extend_schema(parameters=[HEADER], tags=["Seller products"])
class SellerImageUploadView(SellerProductBase):
    parser_classes = [MultiPartParser]
    seller_capability = "catalog.product.update"

    @extend_schema(request=schemas.ImageInput, responses={201: schemas.ImageOutput})
    def post(self, request: Request, product_id: UUID) -> Response:
        serializer = schemas.ImageInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        result = services.upload_image(
            request.user,
            self.seller_access.seller.pk,
            product_id,
            image=validate_document(values["file"]),
            alt_text=values["alt_text"],
            sort_order=values["sort_order"],
        )
        return Response(schemas.ImageOutput(result).data, status=201)


@extend_schema(parameters=[HEADER], tags=["Seller products"])
class SellerImageRemoveView(SellerProductBase):
    @extend_schema(responses={204: None})
    def delete(self, request: Request, product_id: UUID, image_id: UUID) -> Response:
        serializer = EmptySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.remove_image(request.user, self.seller_access.seller.pk, product_id, image_id)
        return Response(status=204)


@extend_schema(parameters=[HEADER], tags=["Seller products"])
class SellerImageDownloadView(SellerProductBase):
    @extend_schema(responses={(200, "application/octet-stream"): OpenApiTypes.BINARY})
    def get(self, request: Request, product_id: UUID, image_id: UUID) -> FileResponse:
        image = get_object_or_404(
            selectors.child_rows(
                request.user, product_id, "images", seller_id=self.seller_access.seller.pk
            ),
            pk=image_id,
        )
        return FileResponse(
            storages["catalog"].open(image.storage_key, "rb"),
            as_attachment=True,
            filename=f"product-image-{image.pk}.{image.content_type.split('/')[1]}",
            content_type="application/octet-stream",
        )


@extend_schema(parameters=[HEADER], tags=["Seller products"])
class SellerProductHistoryView(SellerProductBase):
    allowed_query_parameters = frozenset({"page"})

    @extend_schema(responses=schemas.ProductHistoryPage, parameters=[PAGE])
    def get(self, request: Request, product_id: UUID) -> Response:
        return paginated_response(
            self,
            request,
            selectors.child_rows(
                request.user, product_id, "history", seller_id=self.seller_access.seller.pk
            ),
            schemas.ProductHistoryOutput,
        )


class PlatformChildView(BrowserAPIView):
    permission_classes = [PlatformCapabilityRequired]
    platform_capability = "platform.products.read"
    allowed_query_parameters = frozenset({"page"})
    kind = "variants"
    output: type[Serializer[Any]] = schemas.VariantOutput

    @extend_schema(responses=schemas.VariantPage, parameters=[PAGE], tags=["Platform products"])
    def get(self, request: Request, product_id: UUID) -> Response:
        return paginated_response(
            self, request, selectors.child_rows(request.user, product_id, self.kind), self.output
        )


@extend_schema_view(get=extend_schema(responses=schemas.ImagePage))
class PlatformImagesView(PlatformChildView):
    kind = "images"
    output = schemas.ImageOutput


@extend_schema_view(get=extend_schema(responses=schemas.ProductValuePage))
class PlatformValuesView(PlatformChildView):
    kind = "attributes"
    output = schemas.ProductValueOutput


@extend_schema_view(get=extend_schema(responses=schemas.ProductHistoryPage))
class PlatformHistoryView(PlatformChildView):
    kind = "history"
    output = schemas.ProductHistoryOutput


class PlatformVariantValuesView(BrowserAPIView):
    permission_classes = [PlatformCapabilityRequired]
    platform_capability = "platform.products.read"
    allowed_query_parameters = frozenset({"page"})

    @extend_schema(
        responses=schemas.VariantValuePage, parameters=[PAGE], tags=["Platform products"]
    )
    def get(self, request: Request, product_id: UUID, variant_id: UUID) -> Response:
        return paginated_response(
            self,
            request,
            selectors.child_rows(
                request.user, product_id, "variant-attributes", variant_id=variant_id
            ),
            schemas.VariantValueOutput,
        )


class PlatformImageDownloadView(BrowserAPIView):
    permission_classes = [PlatformCapabilityRequired]
    platform_capability = "platform.products.read"

    @extend_schema(
        responses={(200, "application/octet-stream"): OpenApiTypes.BINARY},
        tags=["Platform products"],
    )
    def get(self, request: Request, product_id: UUID, image_id: UUID) -> FileResponse:
        image = get_object_or_404(
            selectors.child_rows(request.user, product_id, "images"), pk=image_id
        )
        return FileResponse(
            storages["catalog"].open(image.storage_key, "rb"),
            as_attachment=True,
            filename=f"product-image-{image.pk}.{image.content_type.split('/')[1]}",
            content_type="application/octet-stream",
        )
