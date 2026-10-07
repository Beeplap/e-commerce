"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type {
  Page,
  StorefrontProductCard,
  StorefrontSellerDetail,
} from "@/lib/api/types";
import { storefrontApi } from "@/lib/api/client";
import { StorefrontRating } from "@/components/storefront/content";
import { StorefrontButton } from "@/components/storefront/controls";
import { ProductCard } from "./product-card";

interface SellerStoreViewProps {
  seller: StorefrontSellerDetail;
}

export function SellerStoreView({ seller }: SellerStoreViewProps) {
  const [productsPage, setProductsPage] =
    useState<Page<StorefrontProductCard> | null>(null);
  const [sort, setSort] = useState<
    "newest" | "price_asc" | "price_desc" | "rating"
  >("newest");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    storefrontApi
      .products({ seller: seller.id, sort, page }, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setProductsPage(data);
        setLoading(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setProductsPage(null);
        setLoadError(true);
        setLoading(false);
      });
    return () => controller.abort();
  }, [seller.id, sort, page, retry]);

  const location = [seller.city, seller.state, seller.country]
    .filter(Boolean)
    .join(", ");
  const count = productsPage?.count ?? 0;
  const countLabel = `${count} ${count === 1 ? "product" : "products"}`;

  return (
    <div className="sf-seller-store-container">
      <header className="sf-seller-store-heading">
        <p className="sf-seller-store-kicker">Independent shop</p>
        <div className="sf-seller-store-title-row">
          <h1>{seller.store_name}</h1>
          <span className="sf-seller-store-verified">Verified seller</span>
        </div>
        {seller.description && (
          <p className="sf-seller-store-description">{seller.description}</p>
        )}
        <div className="sf-seller-store-details">
          {location && <span>{location}</span>}
          {seller.contact_email && <span>{seller.contact_email}</span>}
          <span>
            {seller.total_products} active{" "}
            {seller.total_products === 1 ? "product" : "products"}
          </span>
          {seller.average_rating !== null && (
            <StorefrontRating value={seller.average_rating} />
          )}
        </div>
      </header>

      <section
        className="sf-seller-store-catalog"
        aria-labelledby="seller-products-title"
      >
        <div className="sf-seller-store-toolbar">
          <div>
            <h2 id="seller-products-title">From this shop</h2>
            <p>
              {loading
                ? "Loading products"
                : `${productsPage?.results.length ?? 0} of ${countLabel}`}
            </p>
          </div>
          <div className="sf-seller-store-sort">
            <label htmlFor="seller-product-sort">Sort</label>
            <select
              id="seller-product-sort"
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as typeof sort);
                setPage(1);
                setLoading(true);
                setLoadError(false);
              }}
            >
              <option value="newest">Newest</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="rating">Customer rating</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div
            className="sf-seller-product-grid"
            role="status"
            aria-label="Loading products"
          >
            {[1, 2, 3, 4].map((item) => (
              <div className="sf-seller-product-skeleton" key={item} />
            ))}
          </div>
        ) : loadError ? (
          <div className="sf-seller-store-error" role="alert">
            <p>We couldn’t load this shop’s products.</p>
            <StorefrontButton
              variant="secondary"
              onClick={() => {
                setLoading(true);
                setLoadError(false);
                setRetry((current) => current + 1);
              }}
            >
              Try again
            </StorefrontButton>
          </div>
        ) : productsPage?.results.length ? (
          <div className="sf-seller-product-grid">
            {productsPage.results.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="sf-seller-store-empty">
            <p>No products from this shop yet.</p>
            <Link href="/search">Browse all products</Link>
          </div>
        )}

        {productsPage && productsPage.count > 25 && (
          <nav
            className="sf-seller-store-pagination"
            aria-label="Product pages"
          >
            <StorefrontButton
              variant="secondary"
              disabled={!productsPage.previous || page <= 1}
              onClick={() => {
                setPage((current) => Math.max(1, current - 1));
                setLoading(true);
                setLoadError(false);
              }}
            >
              Previous
            </StorefrontButton>
            <span>Page {page}</span>
            <StorefrontButton
              variant="secondary"
              disabled={!productsPage.next}
              onClick={() => {
                setPage((current) => current + 1);
                setLoading(true);
                setLoadError(false);
              }}
            >
              Next
            </StorefrontButton>
          </nav>
        )}
      </section>
    </div>
  );
}
