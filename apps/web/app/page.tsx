"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StorefrontHeader } from "@/features/storefront/header";
import { StorefrontFooter } from "@/features/storefront/footer";
import { ProductCard } from "@/features/storefront/product-card";
import {
  StorefrontEmptyState,
  StorefrontSectionHeader,
  StorefrontSkeleton,
} from "@/components/storefront/content";
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
    <div className="sf-storefront flex min-h-screen flex-col bg-sf-background">
      <StorefrontHeader />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="sf-inverse relative overflow-hidden bg-sf-dark py-16 text-sf-on-dark sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <span className="inline-block rounded-full bg-sf-primary/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sf-dark-muted">
                Verified Seller Marketplace
              </span>
              <h1 className="sf-display sf-hero-title mt-4">
                Lightning commerce, direct from trusted sellers.
              </h1>
              <p className="mt-4 text-base text-sf-dark-muted sm:text-lg">
                Explore thousands of products with verified live inventory, fast
                regional shipping, and transparent verified customer reviews.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <a href="#catalog" className="sf-button" data-variant="primary">
                  Shop Now
                </a>
                <Link
                  href="/onboarding"
                  className="rounded-sf-image border border-sf-dark-muted bg-sf-surface/10 px-6 py-3 text-sm font-semibold text-sf-on-dark backdrop-blur hover:bg-sf-surface/20 transition"
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
            <StorefrontSectionHeader title="Explore by Category" />
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
                      ? "border-sf-action bg-sf-accent-soft ring-2 ring-sf-action shadow-sf-small"
                      : "border-sf-border bg-sf-surface hover:border-sf-action hover:shadow-sf-small"
                  }`}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sf-accent-soft text-sf-link text-lg font-bold">
                    {cat.name.slice(0, 1)}
                  </div>
                  <span className="mt-3 text-sm font-semibold text-sf-foreground">
                    {cat.name}
                  </span>
                  <span className="mt-0.5 text-xs text-sf-muted">
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
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-sf-border pb-4">
            <div>
              <h2 className="text-2xl font-bold text-sf-foreground">
                {selectedCategory
                  ? categories.find((c) => c.id === selectedCategory)?.name ||
                    "Category Products"
                  : "All Products"}
              </h2>
              <p className="text-xs text-sf-muted mt-1">
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
                  className="rounded-sf-control border border-sf-control bg-sf-surface px-3 py-1.5 text-xs font-semibold text-sf-soft hover:bg-sf-background transition"
                >
                  ✕ Clear Category
                </button>
              )}

              <div className="flex items-center gap-2 text-xs">
                <label
                  htmlFor="sort-select"
                  className="font-semibold text-sf-soft"
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
                  className="rounded-sf-control border border-sf-control bg-sf-surface px-3 py-1.5 text-xs text-sf-foreground focus:border-sf-action focus:outline-none"
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
                <StorefrontSkeleton key={i} className="h-80" />
              ))}
            </div>
          ) : productsPage && productsPage.results.length > 0 ? (
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {productsPage.results.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <StorefrontEmptyState
              title="No products found"
              description="Check back soon as verified sellers continuously publish new inventory!"
            />
          )}
        </section>
      </main>

      <StorefrontFooter />
    </div>
  );
}
