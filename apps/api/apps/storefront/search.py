import re
from decimal import Decimal, InvalidOperation
from typing import Any
from uuid import UUID

from django.contrib.postgres.search import SearchQuery, SearchRank, SearchVector
from django.db.models import Avg, Count, F, Max, Min, Prefetch, Q

from apps.catalog.models import (
    Brand,
    Category,
    Product,
    ProductImage,
    ProductVariant,
)
from apps.inventory.models import Inventory
from apps.reviews.models import ProductReview
from apps.sellers.models import Seller
from apps.storefront.selectors import format_product_card


def sanitize_search_query(raw_query: str | None) -> str:
    if not raw_query:
        return ""
    # Strip control characters, keep printable characters
    sanitized = re.sub(r"[\x00-\x1f\x7f-\x9f]", "", raw_query).strip()
    return sanitized[:100]


def get_search_base_queryset() -> Any:
    return (
        Product.objects.filter(
            status=Product.Status.ACTIVE,
            seller__status=Seller.Status.ACTIVE,
        )
        .select_related("seller", "seller__profile", "category", "brand")
        .prefetch_related(
            Prefetch(
                "images",
                queryset=ProductImage.objects.filter(is_active=True).order_by("sort_order"),
            ),
            Prefetch(
                "variants",
                queryset=ProductVariant.objects.filter(
                    status=ProductVariant.Status.ACTIVE
                ).order_by("price"),
            ),
            Prefetch(
                "variants__inventories",
                queryset=Inventory.objects.filter(warehouse__is_active=True),
            ),
        )
        .annotate(
            min_price=Min(
                "variants__price", filter=Q(variants__status=ProductVariant.Status.ACTIVE)
            ),
            max_price=Max(
                "variants__price", filter=Q(variants__status=ProductVariant.Status.ACTIVE)
            ),
            average_rating=Avg(
                "reviews__rating", filter=Q(reviews__status=ProductReview.Status.APPROVED)
            ),
            review_count=Count(
                "reviews", filter=Q(reviews__status=ProductReview.Status.APPROVED), distinct=True
            ),
        )
    )


def execute_storefront_search(
    q: str | None = None,
    category_id: UUID | None = None,
    category_slug: str | None = None,
    brand_id: UUID | None = None,
    brand_slug: str | None = None,
    min_price: str | None = None,
    max_price: str | None = None,
    in_stock_only: bool = False,
    seller_id: UUID | None = None,
    min_rating: float | None = None,
    sort: str | None = None,
    offset: int = 0,
    limit: int = 20,
) -> dict[str, Any]:
    query_str = sanitize_search_query(q)
    base_qs = get_search_base_queryset()

    has_search_term = bool(query_str)
    if has_search_term:
        search_vector = (
            SearchVector("name", weight="A")
            + SearchVector("brand__name", weight="A")
            + SearchVector("category__name", weight="B")
            + SearchVector("description", weight="C")
        )
        search_query = SearchQuery(query_str, search_type="websearch")
        sku_matches = ProductVariant.objects.filter(
            status=ProductVariant.Status.ACTIVE,
            sku__icontains=query_str,
        ).values("product_id")

        text_match = (
            Q(search_vector=search_query)
            | Q(name__icontains=query_str)
            | Q(brand__name__icontains=query_str)
            | Q(category__name__icontains=query_str)
            | Q(description__icontains=query_str)
            | Q(id__in=sku_matches)
        )
        matched_qs = base_qs.annotate(
            search_vector=search_vector,
            rank=SearchRank(search_vector, search_query),
        ).filter(text_match)
    else:
        matched_qs = base_qs

    # Calculate facets on matched_qs (so facets represent the matching domain of the search query)
    facets = compute_search_facets(matched_qs)

    # Now apply specific facet filters
    filtered_qs = matched_qs

    if category_id:
        filtered_qs = filtered_qs.filter(
            Q(category_id=category_id) | Q(category__parent_id=category_id)
        )
    elif category_slug:
        filtered_qs = filtered_qs.filter(
            Q(category__slug=category_slug) | Q(category__parent__slug=category_slug)
        )

    if brand_id:
        filtered_qs = filtered_qs.filter(brand_id=brand_id)
    elif brand_slug:
        filtered_qs = filtered_qs.filter(brand__slug=brand_slug)

    if seller_id:
        filtered_qs = filtered_qs.filter(seller_id=seller_id)

    if min_price:
        try:
            min_dec = Decimal(min_price)
            filtered_qs = filtered_qs.filter(min_price__gte=min_dec)
        except InvalidOperation, ValueError:
            pass

    if max_price:
        try:
            max_dec = Decimal(max_price)
            filtered_qs = filtered_qs.filter(min_price__lte=max_dec)
        except InvalidOperation, ValueError:
            pass

    if min_rating is not None:
        filtered_qs = filtered_qs.filter(average_rating__gte=min_rating)

    if in_stock_only:
        in_stock_product_ids = (
            Inventory.objects.filter(
                warehouse__is_active=True,
                quantity_on_hand__gt=F("quantity_reserved"),
                variant__status=ProductVariant.Status.ACTIVE,
            )
            .values_list("variant__product_id", flat=True)
            .distinct()
        )
        filtered_qs = filtered_qs.filter(id__in=in_stock_product_ids)

    # Apply sorting
    if sort == "price_asc":
        filtered_qs = filtered_qs.order_by(F("min_price").asc(nulls_last=True), "-created_at")
    elif sort == "price_desc":
        filtered_qs = filtered_qs.order_by(F("min_price").desc(nulls_last=True), "-created_at")
    elif sort == "rating":
        filtered_qs = filtered_qs.order_by(
            F("average_rating").desc(nulls_last=True), "-review_count", "-created_at"
        )
    elif sort == "newest":
        filtered_qs = filtered_qs.order_by("-created_at", "id")
    else:
        # Default relevance or newest
        if has_search_term:
            filtered_qs = filtered_qs.order_by(
                F("rank").desc(nulls_last=True),
                "-created_at",
            )
        else:
            filtered_qs = filtered_qs.order_by("-created_at", "id")

    total_count = filtered_qs.count()

    # Bounded pagination
    safe_limit = max(1, min(limit, 50))
    safe_offset = max(0, offset)
    paged_products = list(filtered_qs[safe_offset : safe_offset + safe_limit])

    results = [format_product_card(p) for p in paged_products]

    return {
        "count": total_count,
        "facets": facets,
        "results": results,
    }


def compute_search_facets(qs: Any) -> dict[str, Any]:
    # Category facets
    cat_rows = (
        qs.values("category_id", "category__name", "category__slug")
        .annotate(count=Count("id", distinct=True))
        .order_by("-count", "category__name")[:15]
    )
    categories = [
        {
            "id": row["category_id"],
            "name": row["category__name"],
            "slug": row["category__slug"],
            "count": row["count"],
        }
        for row in cat_rows
        if row["category_id"] is not None
    ]

    # Brand facets
    brand_rows = (
        qs.exclude(brand_id__isnull=True)
        .values("brand_id", "brand__name", "brand__slug")
        .annotate(count=Count("id", distinct=True))
        .order_by("-count", "brand__name")[:15]
    )
    brands = [
        {
            "id": row["brand_id"],
            "name": row["brand__name"],
            "slug": row["brand__slug"],
            "count": row["count"],
        }
        for row in brand_rows
        if row["brand_id"] is not None
    ]

    # In-stock IDs for counting
    in_stock_subquery = (
        Inventory.objects.filter(
            warehouse__is_active=True,
            quantity_on_hand__gt=F("quantity_reserved"),
            variant__status=ProductVariant.Status.ACTIVE,
        )
        .values_list("variant__product_id", flat=True)
        .distinct()
    )

    # Price and rating bracket aggregations
    aggs = qs.aggregate(
        under_50=Count("id", filter=Q(min_price__lt=50)),
        between_50_100=Count("id", filter=Q(min_price__gte=50, min_price__lt=100)),
        between_100_250=Count("id", filter=Q(min_price__gte=100, min_price__lt=250)),
        between_250_500=Count("id", filter=Q(min_price__gte=250, min_price__lt=500)),
        above_500=Count("id", filter=Q(min_price__gte=500)),
        rating_4_plus=Count("id", filter=Q(average_rating__gte=4.0)),
        rating_3_plus=Count("id", filter=Q(average_rating__gte=3.0)),
        rating_2_plus=Count("id", filter=Q(average_rating__gte=2.0)),
        in_stock_count=Count("id", filter=Q(id__in=in_stock_subquery)),
    )

    price_brackets = [
        {"label": "Under $50", "min_price": "0", "max_price": "50", "count": aggs["under_50"] or 0},
        {
            "label": "$50 to $100",
            "min_price": "50",
            "max_price": "100",
            "count": aggs["between_50_100"] or 0,
        },
        {
            "label": "$100 to $250",
            "min_price": "100",
            "max_price": "250",
            "count": aggs["between_100_250"] or 0,
        },
        {
            "label": "$250 to $500",
            "min_price": "250",
            "max_price": "500",
            "count": aggs["between_250_500"] or 0,
        },
        {
            "label": "$500 & Above",
            "min_price": "500",
            "max_price": None,
            "count": aggs["above_500"] or 0,
        },
    ]

    rating_brackets = [
        {"min_rating": 4, "label": "4 stars & above", "count": aggs["rating_4_plus"] or 0},
        {"min_rating": 3, "label": "3 stars & above", "count": aggs["rating_3_plus"] or 0},
        {"min_rating": 2, "label": "2 stars & above", "count": aggs["rating_2_plus"] or 0},
    ]

    return {
        "categories": categories,
        "brands": brands,
        "price_brackets": price_brackets,
        "rating_brackets": rating_brackets,
        "in_stock_count": aggs["in_stock_count"] or 0,
    }


def execute_search_suggestions(query: str | None) -> dict[str, Any]:
    q = sanitize_search_query(query)
    if not q:
        return {
            "query": "",
            "suggestions": [],
            "categories": [],
            "brands": [],
            "products": [],
        }

    # 1. Matching categories
    categories_qs = Category.objects.filter(
        is_active=True,
        name__icontains=q,
    ).order_by("name")[:3]
    categories = [
        {
            "id": c.pk,
            "name": c.name,
            "slug": c.slug,
            "description": c.description,
            "parent_id": c.parent_id,
            "product_count": 0,
        }
        for c in categories_qs
    ]

    # 2. Matching brands
    brands_qs = Brand.objects.filter(
        is_active=True,
        name__icontains=q,
    ).order_by("name")[:3]
    brands = [
        {
            "id": b.pk,
            "name": b.name,
            "slug": b.slug,
            "product_count": 0,
        }
        for b in brands_qs
    ]

    # 3. Matching products
    products_qs = (
        Product.objects.filter(
            status=Product.Status.ACTIVE,
            seller__status=Seller.Status.ACTIVE,
        )
        .filter(Q(name__icontains=q) | Q(brand__name__icontains=q) | Q(category__name__icontains=q))
        .select_related("category")
        .prefetch_related(
            Prefetch(
                "images",
                queryset=ProductImage.objects.filter(is_active=True).order_by("sort_order"),
            ),
            Prefetch(
                "variants",
                queryset=ProductVariant.objects.filter(
                    status=ProductVariant.Status.ACTIVE
                ).order_by("price"),
            ),
        )
        .order_by("-created_at")[:5]
    )

    suggest_products: list[dict[str, Any]] = []
    for prod in products_qs:
        images = list(prod.images.all())
        thumb = f"/api/v1/storefront/products/{prod.pk}/images/{images[0].pk}/" if images else None
        variants = list(prod.variants.all())
        price_str = f"{variants[0].price:.2f}" if variants else "0.00"

        suggest_products.append(
            {
                "id": prod.pk,
                "title": prod.name,
                "slug": prod.slug,
                "starting_price": price_str,
                "currency": "USD",
                "thumbnail_url": thumb,
                "category_name": prod.category.name,
            }
        )

    # Build textual suggestions list
    suggestions: list[str] = []
    for sp in suggest_products:
        sp_title = str(sp["title"])
        if sp_title not in suggestions:
            suggestions.append(sp_title)
    for b in brands:
        b_name = str(b["name"])
        if b_name not in suggestions:
            suggestions.append(b_name)
    for c in categories:
        c_name = str(c["name"])
        if c_name not in suggestions:
            suggestions.append(c_name)

    return {
        "query": q,
        "suggestions": suggestions[:8],
        "categories": categories,
        "brands": brands,
        "products": suggest_products,
    }
