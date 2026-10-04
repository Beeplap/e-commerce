import Link from "next/link";
import type { StorefrontProductCard as ProductCardType } from "@/lib/api/types";
import {
  discountPercentage,
  StorefrontBadge,
  StorefrontImage,
  StorefrontPrice,
  StorefrontRating,
  StorefrontSeller,
} from "@/components/storefront/content";

export function ProductCard({ product }: { product: ProductCardType }) {
  const discountPercent = discountPercentage(
    product.starting_price,
    product.compare_at_price,
  );
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-sf-image border border-sf-border bg-sf-surface">
      <Link href={`/products/${product.id}`} className="relative block">
        <StorefrontImage src={product.thumbnail_url} alt={product.title}>
          {discountPercent !== null && (
            <StorefrontBadge
              tone="danger"
              className="absolute top-2.5 left-2.5"
            >
              {discountPercent}% OFF
            </StorefrontBadge>
          )}
          <StorefrontBadge
            tone={product.in_stock ? "success" : "neutral"}
            className="absolute top-2.5 right-2.5"
          >
            {product.in_stock ? "In Stock" : "Out of Stock"}
          </StorefrontBadge>
        </StorefrontImage>
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-1 flex items-center justify-between gap-2 text-xs text-sf-muted">
          <Link
            href={`/categories/${product.category_id}`}
            className="truncate hover:text-sf-link transition"
          >
            {product.category_name}
          </Link>
          {product.brand_name && (
            <span className="truncate">{product.brand_name}</span>
          )}
        </div>
        <h3 className="text-sm font-semibold text-sf-foreground group-hover:text-sf-link transition line-clamp-2">
          <Link href={`/products/${product.id}`}>{product.title}</Link>
        </h3>
        <div className="mt-2">
          <StorefrontRating
            value={product.average_rating}
            count={product.review_count}
          />
        </div>
        <div className="mt-2">
          <StorefrontSeller
            id={product.seller.id}
            name={product.seller.store_name}
          />
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
          <StorefrontPrice
            amount={product.starting_price}
            currency={product.currency}
            compareAt={product.compare_at_price}
            className="text-lg"
          />
          <Link
            href={`/products/${product.id}`}
            className="sf-button"
            data-variant="quiet"
          >
            View
          </Link>
        </div>
      </div>
    </div>
  );
}
