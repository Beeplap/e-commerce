from typing import Any
from uuid import UUID

from django.db.models import Avg, Count, F, Max, Min, Prefetch, Q
from rest_framework.exceptions import NotFound

from apps.catalog.models import (
    Brand,
    Category,
    Product,
    ProductImage,
    ProductVariant,
    VariantAttributeValue,
)
from apps.inventory.models import Inventory
from apps.reviews.models import ProductReview
from apps.sellers.models import Seller, SellerAddress


def list_storefront_categories() -> list[dict[str, Any]]:
    categories = (
        Category.objects.filter(is_active=True)
        .annotate(
            product_count=Count(
                "products",
                filter=Q(
                    products__status=Product.Status.ACTIVE,
                    products__seller__status=Seller.Status.ACTIVE,
                ),
                distinct=True,
            )
        )
        .order_by("sort_order", "name")
    )
    return [
        {
            "id": cat.pk,
            "name": cat.name,
            "slug": cat.slug,
            "description": cat.description,
            "parent_id": cat.parent_id,
            "product_count": cat.product_count,
        }
        for cat in categories
    ]


def list_storefront_brands() -> list[dict[str, Any]]:
    brands = (
        Brand.objects.filter(is_active=True)
        .annotate(
            product_count=Count(
                "products",
                filter=Q(
                    products__status=Product.Status.ACTIVE,
                    products__seller__status=Seller.Status.ACTIVE,
                ),
                distinct=True,
            )
        )
        .order_by("name")
    )
    return [
        {
            "id": brand.pk,
            "name": brand.name,
            "slug": brand.slug,
            "product_count": brand.product_count,
        }
        for brand in brands
    ]


def get_storefront_products_queryset(
    category_id: UUID | None = None,
    brand_id: UUID | None = None,
    seller_id: UUID | None = None,
    sort: str | None = None,
) -> Any:
    qs = (
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

    if category_id:
        qs = qs.filter(Q(category_id=category_id) | Q(category__parent_id=category_id))
    if brand_id:
        qs = qs.filter(brand_id=brand_id)
    if seller_id:
        qs = qs.filter(seller_id=seller_id)

    if sort == "price_asc":
        qs = qs.order_by(F("min_price").asc(nulls_last=True), "-created_at")
    elif sort == "price_desc":
        qs = qs.order_by(F("min_price").desc(nulls_last=True), "-created_at")
    elif sort == "rating":
        qs = qs.order_by(F("average_rating").desc(nulls_last=True), "-review_count", "-created_at")
    else:
        qs = qs.order_by("-created_at", "id")

    return qs


def format_product_card(product: Product) -> dict[str, Any]:
    images = list(product.images.all())
    thumbnail_url = (
        f"/api/v1/storefront/products/{product.pk}/images/{images[0].pk}/" if images else None
    )

    variants = list(product.variants.all())
    active_variants = [v for v in variants if v.status == ProductVariant.Status.ACTIVE]

    starting_price = "0.00"
    compare_at = None
    if active_variants:
        starting_price = f"{active_variants[0].price:.2f}"
        if active_variants[0].compare_at_price:
            compare_at = f"{active_variants[0].compare_at_price:.2f}"

    # Calculate in_stock across active variants
    in_stock = False
    for variant in active_variants:
        available = sum(
            max(0, inv.quantity_on_hand - inv.quantity_reserved)
            for inv in variant.inventories.all()
        )
        if available > 0:
            in_stock = True
            break

    store_name = product.seller.display_name

    avg_rating = getattr(product, "average_rating", None)
    rating_val = round(float(avg_rating), 1) if avg_rating is not None else None
    reviews_count = getattr(product, "review_count", 0)

    return {
        "id": product.pk,
        "title": product.name,
        "slug": product.slug,
        "short_description": product.short_description,
        "category_id": product.category_id,
        "category_name": product.category.name,
        "brand_id": product.brand_id,
        "brand_name": product.brand.name if product.brand else None,
        "starting_price": starting_price,
        "compare_at_price": compare_at,
        "currency": "USD",
        "thumbnail_url": thumbnail_url,
        "in_stock": in_stock,
        "average_rating": rating_val,
        "review_count": reviews_count,
        "seller": {
            "id": product.seller_id,
            "name": product.seller.display_name,
            "store_name": store_name,
            "rating": None,
        },
    }


def _mask_customer_name(email: str) -> str:
    parts = email.split("@")[0].replace(".", " ").replace("_", " ").split()
    if len(parts) >= 2:
        return f"{parts[0].capitalize()} {parts[1][0].upper()}."
    if parts:
        return f"{parts[0].capitalize()} Customer"
    return "Verified Customer"


def get_storefront_product_detail(product_id: UUID) -> dict[str, Any]:
    try:
        product = (
            Product.objects.filter(
                pk=product_id,
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
            .get()
        )
    except Product.DoesNotExist as exc:
        raise NotFound("Product not found.") from exc

    variants = list(product.variants.all())
    variant_ids = [v.pk for v in variants]

    # Fetch variant attribute values in a single query
    vav_map: dict[UUID, dict[str, str]] = {vid: {} for vid in variant_ids}
    for vav in VariantAttributeValue.objects.filter(variant_id__in=variant_ids).select_related(
        "attribute", "option"
    ):
        attr_code = vav.attribute.code
        val = vav.option.label if vav.option else vav.value
        vav_map[vav.variant_id][attr_code] = val

    total_stock = 0
    formatted_variants = []
    for v in variants:
        avail = sum(
            max(0, inv.quantity_on_hand - inv.quantity_reserved) for inv in v.inventories.all()
        )
        total_stock += avail
        formatted_variants.append(
            {
                "id": v.pk,
                "sku": v.sku,
                "price": f"{v.price:.2f}",
                "compare_at_price": f"{v.compare_at_price:.2f}" if v.compare_at_price else None,
                "in_stock": avail > 0,
                "available_quantity": avail,
                "attributes": vav_map.get(v.pk, {}),
            }
        )

    formatted_images = [
        {
            "id": img.pk,
            "url": f"/api/v1/storefront/products/{product.pk}/images/{img.pk}/",
            "alt_text": img.alt_text,
            "sort_order": img.sort_order,
        }
        for img in product.images.all()
    ]

    # Reviews and ratings
    reviews = list(
        ProductReview.objects.filter(product=product, status=ProductReview.Status.APPROVED)
        .select_related("customer", "seller_response")
        .order_by("-created_at")
    )
    total_reviews = len(reviews)
    avg_rating = (
        round(sum(r.rating for r in reviews) / total_reviews, 1) if total_reviews > 0 else None
    )

    rating_breakdown = {"5": 0, "4": 0, "3": 0, "2": 0, "1": 0}
    for r in reviews:
        if 1 <= r.rating <= 5:
            rating_breakdown[str(r.rating)] += 1

    recent_reviews = [
        {
            "id": r.pk,
            "customer_name": _mask_customer_name(r.customer.email),
            "rating": r.rating,
            "title": r.title,
            "body": r.body,
            "verified_purchase": r.verified_purchase,
            "created_at": r.created_at,
            "seller_response": (
                r.seller_response.response if hasattr(r, "seller_response") else None
            ),
            "seller_response_at": (
                r.seller_response.created_at if hasattr(r, "seller_response") else None
            ),
        }
        for r in reviews[:10]
    ]

    starting_price = f"{formatted_variants[0]['price']}" if formatted_variants else "0.00"
    compare_at = formatted_variants[0]["compare_at_price"] if formatted_variants else None

    store_name = product.seller.display_name

    return {
        "id": product.pk,
        "title": product.name,
        "slug": product.slug,
        "description": product.description,
        "short_description": product.short_description,
        "category": {
            "id": product.category.pk,
            "name": product.category.name,
            "slug": product.category.slug,
            "description": product.category.description,
            "parent_id": product.category.parent_id,
            "product_count": 0,
        },
        "brand": (
            {
                "id": product.brand.pk,
                "name": product.brand.name,
                "slug": product.brand.slug,
                "product_count": 0,
            }
            if product.brand
            else None
        ),
        "seller": {
            "id": product.seller_id,
            "name": product.seller.display_name,
            "store_name": store_name,
            "rating": None,
        },
        "starting_price": starting_price,
        "compare_at_price": compare_at,
        "currency": "USD",
        "in_stock": total_stock > 0,
        "total_available_stock": total_stock,
        "average_rating": avg_rating,
        "review_count": total_reviews,
        "rating_breakdown": rating_breakdown,
        "images": formatted_images,
        "variants": formatted_variants,
        "recent_reviews": recent_reviews,
    }


def get_storefront_seller_detail(seller_id: UUID) -> dict[str, Any]:
    try:
        seller = (
            Seller.objects.filter(pk=seller_id, status=Seller.Status.ACTIVE)
            .select_related("profile", "settings")
            .prefetch_related(
                Prefetch(
                    "addresses",
                    queryset=SellerAddress.objects.filter(kind=SellerAddress.Kind.REGISTERED),
                )
            )
            .get()
        )
    except Seller.DoesNotExist as exc:
        raise NotFound("Seller not found.") from exc

    store_name = seller.display_name
    profile = getattr(seller, "profile", None)
    description = profile.description if profile else ""
    settings_obj = getattr(seller, "settings", None)
    contact_email = (
        settings_obj.support_email if settings_obj and settings_obj.support_email else seller.email
    )

    addresses = list(seller.addresses.all())
    addr = addresses[0] if addresses else None

    total_products = Product.objects.filter(seller=seller, status=Product.Status.ACTIVE).count()

    reviews = ProductReview.objects.filter(
        product__seller=seller, status=ProductReview.Status.APPROVED
    )
    avg_rating_agg = reviews.aggregate(avg=Avg("rating"))["avg"]
    avg_rating = round(float(avg_rating_agg), 1) if avg_rating_agg is not None else None

    return {
        "id": seller.pk,
        "name": seller.display_name,
        "store_name": store_name,
        "description": description,
        "contact_email": contact_email,
        "city": addr.city if addr else None,
        "state": addr.region if addr else None,
        "country": addr.country if addr else None,
        "average_rating": avg_rating,
        "total_products": total_products,
    }
