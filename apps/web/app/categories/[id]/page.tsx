"use client";

import { use, useEffect, useState } from "react";
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

interface CategoryPageProps {
  params: Promise<{ id: string }>;
}

export default function CategoryBrowsePage({ params }: CategoryPageProps) {
  const { id } = use(params);
  const [categories, setCategories] = useState<StorefrontCategory[]>([]);
  const [productsPage, setProductsPage] =
    useState<Page<StorefrontProductCard> | null>(null);
  const [sort, setSort] = useState<
    "newest" | "price_asc" | "price_desc" | "rating"
  >("newest");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    storefrontApi
      .categories(controller.signal)
      .then((data) => setCategories(data))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const currentCategory = categories.find((c) => c.id === id);

  useEffect(() => {
    const controller = new AbortController();
    storefrontApi
      .products({ category: id, sort }, controller.signal)
      .then((data) => {
        setProductsPage(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
    return () => controller.abort();
  }, [id, sort]);

  return (
    <div className="sf-storefront flex min-h-screen flex-col bg-sf-background">
      <StorefrontHeader />

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav
            aria-label="Breadcrumb"
            className="mb-4 flex items-center gap-2 text-xs text-sf-muted"
          >
            <Link href="/" className="hover:text-sf-link transition">
              Home
            </Link>
            <span>/</span>
            <span className="font-semibold text-sf-foreground">
              {currentCategory?.name || "Category"}
            </span>
          </nav>

          {/* Category Header */}
          <div className="border-b border-sf-border pb-6">
            <h1 className="text-3xl font-extrabold text-sf-foreground">
              {currentCategory?.name || "Category"}
            </h1>
            {currentCategory?.description && (
              <p className="mt-2 max-w-2xl text-sm text-sf-soft">
                {currentCategory.description}
              </p>
            )}
          </div>

          {/* Controls Bar */}
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-sf-border pb-4">
            <p className="text-xs text-sf-muted">
              Showing {productsPage?.results.length || 0} of{" "}
              {productsPage?.count || 0} items
            </p>

            <div className="flex items-center gap-2 text-xs">
              <label htmlFor="cat-sort" className="font-semibold text-sf-soft">
                Sort:
              </label>
              <select
                id="cat-sort"
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

          {/* Products Grid */}
          {loading ? (
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="h-80 rounded-sf-image border border-sf-border bg-sf-surface p-4 shadow-sf-small motion-safe:animate-pulse"
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
            <div className="mt-16 rounded-sf-editorial border border-dashed border-sf-control bg-sf-surface p-12 text-center">
              <h3 className="text-base font-semibold text-sf-foreground">
                No products found in this category
              </h3>
              <p className="mt-1 text-xs text-sf-muted">
                Explore our other categories or check back soon!
              </p>
              <div className="mt-6">
                <Link
                  href="/"
                  className="rounded-sf-control bg-sf-action px-5 py-2.5 text-xs font-semibold text-sf-on-dark hover:bg-sf-action-hover transition"
                >
                  Browse All Categories
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>

      <StorefrontFooter />
    </div>
  );
}
