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
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-800 text-2xl font-bold text-white shadow">
              {seller.store_name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold text-slate-900">
                  {seller.store_name}
                </h1>
                <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-bold text-teal-800">
                  Verified Seller
                </span>
              </div>
              {seller.description && (
                <p className="mt-1.5 max-w-2xl text-sm text-slate-600">
                  {seller.description}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
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
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4 border border-slate-200">
              <div className="text-3xl font-bold text-slate-900">
                {seller.average_rating.toFixed(1)}
              </div>
              <div className="text-xs text-slate-500">
                <div className="flex text-amber-400">
                  {"★".repeat(Math.round(seller.average_rating))}
                  {"☆".repeat(5 - Math.round(seller.average_rating))}
                </div>
                <span>Seller Store Rating</span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400">New marketplace seller</div>
          )}
        </div>
      </section>

      {/* Catalog Controls */}
      <section className="mt-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Store Products</h2>
            <p className="text-xs text-slate-500">
              Showing {productsPage?.results?.length || 0} of{" "}
              {productsPage?.count || 0} items
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <label
              htmlFor="sort-select"
              className="font-semibold text-slate-700"
            >
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
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-teal-700 focus:outline-none"
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
                className="h-72 rounded-xl border border-slate-200 bg-slate-100 animate-pulse"
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
          <div className="mt-12 text-center text-sm text-slate-500">
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
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="flex items-center px-3 text-xs font-medium text-slate-600">
              Page {page}
            </span>
            <button
              type="button"
              disabled={!productsPage.next}
              onClick={() => {
                setPage((p) => p + 1);
                setLoading(true);
              }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
