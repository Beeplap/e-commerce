"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StorefrontHeader } from "@/features/storefront/header";
import { StorefrontFooter } from "@/features/storefront/footer";
import { ProductCard } from "@/features/storefront/product-card";
import { storefrontApi } from "@/lib/api/client";
import type {
  StorefrontCategory,
  StorefrontProductCard,
  Page,
} from "@/lib/api/types";

export default function Home() {
  const [categories, setCategories] = useState<StorefrontCategory[]>([]);
  const [productsPage, setProductsPage] =
    useState<Page<StorefrontProductCard> | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<
    "newest" | "price_asc" | "price_desc" | "rating"
  >("newest");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    storefrontApi
      .categories(controller.signal)
      .then((cats) => setCategories(cats))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    storefrontApi
      .products(
        {
          category: selectedCategory || undefined,
          sort,
        },
        controller.signal,
      )
      .then((data) => {
        setProductsPage(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
    return () => controller.abort();
  }, [selectedCategory, sort]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <StorefrontHeader />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 py-16 text-white sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <span className="inline-block rounded-full bg-teal-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-teal-300">
                Verified Seller Marketplace
              </span>
              <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
                Lightning commerce, direct from trusted sellers.
              </h1>
              <p className="mt-4 text-base text-teal-100 sm:text-lg">
                Explore thousands of products with verified live inventory, fast
                regional shipping, and transparent verified customer reviews.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <a
                  href="#catalog"
                  className="rounded-xl bg-white px-6 py-3 text-sm font-bold text-teal-900 shadow hover:bg-slate-100 transition"
                >
                  Shop Now
                </a>
                <Link
                  href="/onboarding"
                  className="rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur hover:bg-white/20 transition"
                >
                  Sell on QuickCommerce
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Categories Showcase */}
        {categories.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <h2 className="text-xl font-bold text-slate-900">
              Explore by Category
            </h2>
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(
                      selectedCategory === cat.id ? null : cat.id,
                    );
                    setLoading(true);
                  }}
                  className={`flex flex-col items-center justify-center rounded-2xl border p-4 text-center transition ${
                    selectedCategory === cat.id
                      ? "border-teal-700 bg-teal-50 ring-2 ring-teal-600 shadow-sm"
                      : "border-slate-200 bg-white hover:border-teal-600 hover:shadow-sm"
                  }`}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 text-teal-800 text-lg font-bold">
                    {cat.name.slice(0, 1)}
                  </div>
                  <span className="mt-3 text-sm font-semibold text-slate-900">
                    {cat.name}
                  </span>
                  <span className="mt-0.5 text-xs text-slate-400">
                    {cat.product_count} product
                    {cat.product_count === 1 ? "" : "s"}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Product Catalog Section */}
        <section
          id="catalog"
          className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                {selectedCategory
                  ? categories.find((c) => c.id === selectedCategory)?.name ||
                    "Category Products"
                  : "All Products"}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Showing {productsPage?.results.length || 0} of{" "}
                {productsPage?.count || 0} active items
              </p>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {selectedCategory && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory(null);
                    setLoading(true);
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  ✕ Clear Category
                </button>
              )}

              <div className="flex items-center gap-2 text-xs">
                <label
                  htmlFor="sort-select"
                  className="font-semibold text-slate-700"
                >
                  Sort:
                </label>
                <select
                  id="sort-select"
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value as typeof sort);
                    setLoading(true);
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-teal-700 focus:outline-none"
                >
                  <option value="newest">Newest Arrivals</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="rating">Top Rated</option>
                </select>
              </div>
            </div>
          </div>

          {/* Product Cards Grid */}
          {loading ? (
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div
                  key={i}
                  className="h-80 rounded-xl border border-slate-200 bg-white p-4 shadow-sm animate-pulse"
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
            <div className="mt-16 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <h3 className="text-base font-semibold text-slate-800">
                No products found
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Check back soon as verified sellers continuously publish new
                inventory!
              </p>
            </div>
          )}
        </section>
      </main>

      <StorefrontFooter />
    </div>
  );
}
