from typing import Any
from uuid import UUID

from django.core.files.storage import storages
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.models import ProductImage
from apps.storefront import selectors
from apps.storefront import serializers as schemas
from config.pagination import BoundedPagination

PAGE_PARAM = OpenApiParameter(
    name="page",
    type=int,
    location=OpenApiParameter.QUERY,
    description="Page number (1-10000).",
    required=False,
)
CATEGORY_PARAM = OpenApiParameter(
    name="category",
    type=OpenApiTypes.UUID,
    location=OpenApiParameter.QUERY,
    description="Filter by category UUID.",
    required=False,
)
BRAND_PARAM = OpenApiParameter(
    name="brand",
    type=OpenApiTypes.UUID,
    location=OpenApiParameter.QUERY,
    description="Filter by brand UUID.",
    required=False,
)
SELLER_PARAM = OpenApiParameter(
    name="seller",
    type=OpenApiTypes.UUID,
    location=OpenApiParameter.QUERY,
    description="Filter by seller UUID.",
    required=False,
)
SORT_PARAM = OpenApiParameter(
    name="sort",
    type=str,
    location=OpenApiParameter.QUERY,
    description="Sort order (newest, price_asc, price_desc, rating).",
    required=False,
)


class PublicStorefrontAPIView(APIView):
    permission_classes = [AllowAny]
    allowed_query_parameters: frozenset[str] = frozenset()

    def initial(self, request: Request, *args: Any, **kwargs: Any) -> None:
        if set(request.query_params) - self.allowed_query_parameters:
            raise ValidationError({"detail": "Query parameters are not supported here."})
        if any(len(request.query_params.getlist(key)) != 1 for key in request.query_params):
            raise ValidationError({"detail": "Repeated query parameters are not supported."})
        super().initial(request, *args, **kwargs)

    def finalize_response(self, request: Request, response: Any, *args: Any, **kwargs: Any) -> Any:
        response = super().finalize_response(request, response, *args, **kwargs)
        if (
            request.method in ("GET", "HEAD")
            and getattr(response, "status_code", None) == 200
            and "Cache-Control" not in response
        ):
            response["Cache-Control"] = "public, max-age=60, s-maxage=300"
        return response


class StorefrontCategoriesView(PublicStorefrontAPIView):
    @extend_schema(
        operation_id="storefront_categories_list",
        responses=schemas.StorefrontCategorySerializer(many=True),
        tags=["Storefront"],
        description="List active product categories with active product counts.",
    )
    def get(self, request: Request) -> Response:
        categories = selectors.list_storefront_categories()
        return Response(schemas.StorefrontCategorySerializer(categories, many=True).data)


class StorefrontBrandsView(PublicStorefrontAPIView):
    @extend_schema(
        operation_id="storefront_brands_list",
        responses=schemas.StorefrontBrandSerializer(many=True),
        tags=["Storefront"],
        description="List active brands with active product counts.",
    )
    def get(self, request: Request) -> Response:
        brands = selectors.list_storefront_brands()
        return Response(schemas.StorefrontBrandSerializer(brands, many=True).data)


class StorefrontProductsView(PublicStorefrontAPIView):
    allowed_query_parameters = frozenset({"page", "category", "brand", "seller", "sort"})

    @extend_schema(
        operation_id="storefront_products_list",
        responses=schemas.StorefrontProductPageSerializer,
        parameters=[PAGE_PARAM, CATEGORY_PARAM, BRAND_PARAM, SELLER_PARAM, SORT_PARAM],
        tags=["Storefront"],
        description="Paginated list of active products from verified active sellers.",
    )
    def get(self, request: Request) -> Response:
        category_id = None
        if "category" in request.query_params:
            try:
                category_id = UUID(request.query_params["category"])
            except ValueError as err:
                raise ValidationError({"category": "Must be a valid UUID."}) from err

        brand_id = None
        if "brand" in request.query_params:
            try:
                brand_id = UUID(request.query_params["brand"])
            except ValueError as err:
                raise ValidationError({"brand": "Must be a valid UUID."}) from err

        seller_id = None
        if "seller" in request.query_params:
            try:
                seller_id = UUID(request.query_params["seller"])
            except ValueError as err:
                raise ValidationError({"seller": "Must be a valid UUID."}) from err

        sort = request.query_params.get("sort")
        if sort and sort not in ("newest", "price_asc", "price_desc", "rating"):
            raise ValidationError(
                {"sort": "Sort must be one of: newest, price_asc, price_desc, rating."}
            )

        qs = selectors.get_storefront_products_queryset(
            category_id=category_id,
            brand_id=brand_id,
            seller_id=seller_id,
            sort=sort,
        )

        pagination = BoundedPagination()
        page: list[Any] | None = pagination.paginate_queryset(qs, request, self)
        page_items = page if page is not None else []
        cards = [selectors.format_product_card(product) for product in page_items]
        return pagination.get_paginated_response(cards)


class StorefrontProductDetailView(PublicStorefrontAPIView):
    @extend_schema(
        operation_id="storefront_product_detail",
        responses=schemas.StorefrontProductDetailSerializer,
        tags=["Storefront"],
        description="Comprehensive product detail with variants, attributes, images, and reviews.",
    )
    def get(self, request: Request, product_id: UUID) -> Response:
        product_detail = selectors.get_storefront_product_detail(product_id)
        return Response(schemas.StorefrontProductDetailSerializer(product_detail).data)


class StorefrontSellerDetailView(PublicStorefrontAPIView):
    @extend_schema(
        operation_id="storefront_seller_detail",
        responses=schemas.StorefrontSellerDetailSerializer,
        tags=["Storefront"],
        description="Public seller store page with profile, ratings, and catalog metadata.",
    )
    def get(self, request: Request, seller_id: UUID) -> Response:
        seller_detail = selectors.get_storefront_seller_detail(seller_id)
        return Response(schemas.StorefrontSellerDetailSerializer(seller_detail).data)


class StorefrontImageDownloadView(PublicStorefrontAPIView):
    @extend_schema(
        operation_id="storefront_product_image_retrieve",
        responses={(200, "image/*"): OpenApiTypes.BINARY},
        tags=["Storefront"],
        description="Public product image viewer.",
    )
    def get(self, request: Request, product_id: UUID, image_id: UUID) -> FileResponse:
        image = get_object_or_404(
            ProductImage.objects.filter(
                product_id=product_id,
                product__status="active",
                product__seller__status="active",
                is_active=True,
            ),
            pk=image_id,
        )
        response = FileResponse(
            storages["catalog"].open(image.storage_key, "rb"),
            as_attachment=False,
            content_type=image.content_type,
        )
        response["Cache-Control"] = "public, max-age=86400, immutable"
        return response
