"use client";

import { useState, useEffect } from "react";
import type {
  StorefrontSellerDetail,
  StorefrontProductCard,
  Page,
} from "@/lib/api/types";
import { storefrontApi } from "@/lib/api/client";
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
  const [page, setPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const controller = new AbortController();
    storefrontApi
      .products({ seller: seller.id, sort, page }, controller.signal)
      .then((data) => {
        setProductsPage(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
    return () => controller.abort();
  }, [seller.id, sort, page]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Seller Header Banner */}
      <section className="overflow-hidden rounded-sf-editorial border border-sf-border bg-sf-surface p-6 shadow-sf-small sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-sf-image bg-sf-action text-2xl font-bold text-sf-on-dark shadow-sf-small">
              {seller.store_name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold text-sf-foreground">
                  {seller.store_name}
                </h1>
                <span className="rounded-full bg-sf-accent-soft px-2.5 py-0.5 text-xs font-bold text-sf-link">
                  Verified Seller
                </span>
              </div>
              {seller.description && (
                <p className="mt-1.5 max-w-2xl text-sm text-sf-soft">
                  {seller.description}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-sf-muted">
                {seller.city && seller.country && (
                  <span>
                    📍 {seller.city}, {seller.state ? `${seller.state}, ` : ""}
                    {seller.country}
                  </span>
                )}
                {seller.contact_email && <span>✉️ {seller.contact_email}</span>}
                <span>📦 {seller.total_products} Active Products</span>
              </div>
            </div>
          </div>

          {/* Rating Summary Card */}
          {seller.average_rating ? (
            <div className="flex items-center gap-3 rounded-sf-image bg-sf-background p-4 border border-sf-border">
              <div className="text-3xl font-bold text-sf-foreground">
                {seller.average_rating.toFixed(1)}
              </div>
              <div className="text-xs text-sf-muted">
                <div className="flex text-sf-warning-text">
                  {"★".repeat(Math.round(seller.average_rating))}
                  {"☆".repeat(5 - Math.round(seller.average_rating))}
                </div>
                <span>Seller Store Rating</span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-sf-muted">New marketplace seller</div>
          )}
        </div>
      </section>

      {/* Catalog Controls */}
      <section className="mt-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-sf-border pb-4">
          <div>
            <h2 className="text-lg font-bold text-sf-foreground">
              Store Products
            </h2>
            <p className="text-xs text-sf-muted">
              Showing {productsPage?.results?.length || 0} of{" "}
              {productsPage?.count || 0} items
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <label htmlFor="sort-select" className="font-semibold text-sf-soft">
              Sort by:
            </label>
            <select
              id="sort-select"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as typeof sort);
                setPage(1);
                setLoading(true);
              }}
              className="rounded-sf-control border border-sf-control bg-sf-surface px-3 py-1.5 text-xs text-sf-foreground focus:border-sf-action focus:outline-none"
            >
              <option value="newest">Newest Arrivals</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="rating">Customer Rating</option>
            </select>
          </div>
        </div>

        {/* Product Grid */}
        {loading ? (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-72 rounded-sf-image border border-sf-border bg-sf-surface-strong motion-safe:animate-pulse"
              />
            ))}
          </div>
        ) : productsPage && productsPage.results.length > 0 ? (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {productsPage.results.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="mt-12 text-center text-sm text-sf-muted">
            No products found for this seller.
          </div>
        )}

        {/* Pagination */}
        {productsPage && productsPage.count > 25 && (
          <div className="mt-10 flex justify-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => {
                setPage((p) => Math.max(1, p - 1));
                setLoading(true);
              }}
              className="rounded-sf-control border border-sf-control px-4 py-2 text-xs font-semibold text-sf-soft hover:bg-sf-background disabled:opacity-40"
            >
              Previous
            </button>
            <span className="flex items-center px-3 text-xs font-medium text-sf-soft">
              Page {page}
            </span>
            <button
              type="button"
              disabled={!productsPage.next}
              onClick={() => {
                setPage((p) => p + 1);
                setLoading(true);
              }}
              className="rounded-sf-control border border-sf-control px-4 py-2 text-xs font-semibold text-sf-soft hover:bg-sf-background disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
