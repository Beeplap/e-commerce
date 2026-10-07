import Link from "next/link";
import type { StorefrontProductCard } from "@/lib/api/types";
import {
  StorefrontImage,
  StorefrontPrice,
  StorefrontRating,
} from "@/components/storefront/content";

export function ProductCard({ product }: { product: StorefrontProductCard }) {
  return (
    <article
      className="sf-seller-product"
      data-has-image={Boolean(product.thumbnail_url)}
    >
      <Link
        href={`/products/${encodeURIComponent(product.id)}`}
        className="sf-seller-product-image"
        aria-label={`View ${product.title}`}
      >
        <StorefrontImage src={product.thumbnail_url} alt={product.title} />
      </Link>
      <div className="sf-seller-product-details">
        <p className="sf-seller-product-category">
          {product.brand_name || product.category_name}
        </p>
        <h3>
          <Link href={`/products/${encodeURIComponent(product.id)}`}>
            {product.title}
          </Link>
        </h3>
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
        <p className="sf-seller-product-stock" data-in-stock={product.in_stock}>
          {product.in_stock ? "In stock" : "Currently out of stock"}
        </p>
      </div>
    </article>
  );
}
