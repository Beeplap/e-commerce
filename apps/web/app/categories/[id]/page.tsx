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
    <div className="flex min-h-screen flex-col bg-slate-50">
      <StorefrontHeader />

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav
            aria-label="Breadcrumb"
            className="mb-4 flex items-center gap-2 text-xs text-slate-500"
          >
            <Link href="/" className="hover:text-teal-700 transition">
              Home
            </Link>
            <span>/</span>
            <span className="font-semibold text-slate-800">
              {currentCategory?.name || "Category"}
            </span>
          </nav>

          {/* Category Header */}
          <div className="border-b border-slate-200 pb-6">
            <h1 className="text-3xl font-extrabold text-slate-900">
              {currentCategory?.name || "Category"}
            </h1>
            {currentCategory?.description && (
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                {currentCategory.description}
              </p>
            )}
          </div>

          {/* Controls Bar */}
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
            <p className="text-xs text-slate-500">
              Showing {productsPage?.results.length || 0} of{" "}
              {productsPage?.count || 0} items
            </p>

            <div className="flex items-center gap-2 text-xs">
              <label
                htmlFor="cat-sort"
                className="font-semibold text-slate-700"
              >
                Sort:
              </label>
              <select
                id="cat-sort"
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

          {/* Products Grid */}
          {loading ? (
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
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
                No products found in this category
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Explore our other categories or check back soon!
              </p>
              <div className="mt-6">
                <Link
                  href="/"
                  className="rounded-lg bg-teal-800 px-5 py-2.5 text-xs font-semibold text-white hover:bg-teal-900 transition"
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
