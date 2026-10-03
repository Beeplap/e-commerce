from typing import Any

from rest_framework import serializers

from apps.sellers.lifecycle_serializers import PageSerializer


class StorefrontCategorySerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    name = serializers.CharField()
    slug = serializers.SlugField()
    description = serializers.CharField(allow_blank=True, default="")
    parent_id = serializers.UUIDField(allow_null=True)
    product_count = serializers.IntegerField(default=0)


class StorefrontBrandSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    name = serializers.CharField()
    slug = serializers.SlugField()
    product_count = serializers.IntegerField(default=0)


class StorefrontSellerBadgeSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    name = serializers.CharField()
    store_name = serializers.CharField()
    rating = serializers.FloatField(allow_null=True)


class StorefrontProductCardSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    title = serializers.CharField()
    slug = serializers.SlugField()
    short_description = serializers.CharField(allow_blank=True, default="")
    category_id = serializers.UUIDField()
    category_name = serializers.CharField()
    brand_id = serializers.UUIDField(allow_null=True)
    brand_name = serializers.CharField(allow_null=True)
    starting_price = serializers.CharField()
    compare_at_price = serializers.CharField(allow_null=True)
    currency = serializers.CharField(default="USD")
    thumbnail_url = serializers.CharField(allow_null=True)
    in_stock = serializers.BooleanField(default=True)
    average_rating = serializers.FloatField(allow_null=True)
    review_count = serializers.IntegerField(default=0)
    seller = StorefrontSellerBadgeSerializer()


class StorefrontProductPageSerializer(PageSerializer):
    results = StorefrontProductCardSerializer(many=True)


class StorefrontVariantSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    sku = serializers.CharField()
    price = serializers.CharField()
    compare_at_price = serializers.CharField(allow_null=True)
    in_stock = serializers.BooleanField(default=True)
    available_quantity = serializers.IntegerField(default=0)
    attributes = serializers.DictField(child=serializers.CharField(), default=dict)


class StorefrontImageSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    url = serializers.CharField()
    alt_text = serializers.CharField(allow_blank=True, default="")
    sort_order = serializers.IntegerField(default=0)


class StorefrontReviewItemSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    customer_name = serializers.CharField()
    rating = serializers.IntegerField()
    title = serializers.CharField()
    body = serializers.CharField()
    verified_purchase = serializers.BooleanField()
    created_at = serializers.DateTimeField()
    seller_response = serializers.CharField(allow_null=True)
    seller_response_at = serializers.DateTimeField(allow_null=True)


class StorefrontProductDetailSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    title = serializers.CharField()
    slug = serializers.SlugField()
    description = serializers.CharField(allow_blank=True, default="")
    short_description = serializers.CharField(allow_blank=True, default="")
    category = StorefrontCategorySerializer()
    brand = StorefrontBrandSerializer(allow_null=True)
    seller = StorefrontSellerBadgeSerializer()
    starting_price = serializers.CharField()
    compare_at_price = serializers.CharField(allow_null=True)
    currency = serializers.CharField(default="USD")
    in_stock = serializers.BooleanField(default=True)
    total_available_stock = serializers.IntegerField(default=0)
    average_rating = serializers.FloatField(allow_null=True)
    review_count = serializers.IntegerField(default=0)
    rating_breakdown = serializers.DictField(child=serializers.IntegerField(), default=dict)
    images = StorefrontImageSerializer(many=True)
    variants = StorefrontVariantSerializer(many=True)
    recent_reviews = StorefrontReviewItemSerializer(many=True)


class StorefrontSellerDetailSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    name = serializers.CharField()
    store_name = serializers.CharField()
    description = serializers.CharField(allow_blank=True, default="")
    contact_email = serializers.CharField(allow_blank=True, default="")
    city = serializers.CharField(allow_null=True)
    state = serializers.CharField(allow_null=True)
    country = serializers.CharField(allow_null=True)
    average_rating = serializers.FloatField(allow_null=True)
    total_products = serializers.IntegerField(default=0)
