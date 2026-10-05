import Link from "next/link";
import type { StorefrontProductCard } from "@/lib/api/types";
import {
  StorefrontImage,
  StorefrontPrice,
  StorefrontRating,
  StorefrontSeller,
} from "@/components/storefront/content";

/** Discovery-only composition leaves seller/PDP cards and purchase workflows unchanged. */
export function DiscoveryProduct({
  product,
}: {
  product: StorefrontProductCard;
}) {
  const href = `/products/${encodeURIComponent(product.id)}`;
  return (
    <article className="sf-discovery-product">
      <Link
        href={href}
        aria-label={`View ${product.title}`}
        className="sf-discovery-image"
      >
        <StorefrontImage src={product.thumbnail_url} alt={product.title} />
      </Link>
      <div className="sf-discovery-product-details">
        <Link
          href={`/categories/${encodeURIComponent(product.category_id)}`}
          className="sf-discovery-category"
        >
          {product.category_name}
        </Link>
        <h2>
          <Link href={href}>{product.title}</Link>
        </h2>
        {product.brand_name && (
          <p className="sf-discovery-brand">{product.brand_name}</p>
        )}
        <StorefrontSeller
          id={product.seller.id}
          name={product.seller.store_name}
        />
        <StorefrontPrice
          amount={product.starting_price}
          currency={product.currency}
          compareAt={product.compare_at_price}
        />
        {product.average_rating !== null && (
          <StorefrontRating
            value={product.average_rating}
            count={product.review_count}
          />
        )}
        <p className="sf-discovery-stock" data-in-stock={product.in_stock}>
          {product.in_stock ? "In stock" : "Currently out of stock"}
        </p>
      </div>
    </article>
  );
}
