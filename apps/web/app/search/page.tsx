"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { storefrontApi } from "@/lib/api/client";
import type {
  StorefrontProductCard,
  StorefrontSearchFacets,
} from "@/lib/api/types";
import { StorefrontHeader } from "@/features/storefront/header";
import { StorefrontFooter } from "@/features/storefront/footer";
import { ProductCard } from "@/features/storefront/product-card";
import {
  ActiveFilterBadges,
  type FilterState,
  SearchFiltersSidebar,
} from "@/features/storefront/search-filters";

function SearchResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Parse filters from URL
  const query = searchParams.get("q") || "";
  const category = searchParams.get("category") || undefined;
  const brand = searchParams.get("brand") || undefined;
  const min_price = searchParams.get("min_price") || undefined;
  const max_price = searchParams.get("max_price") || undefined;
  const in_stock = searchParams.get("in_stock") === "true";
  const min_rating_param = searchParams.get("min_rating");
  const min_rating = min_rating_param
    ? parseFloat(min_rating_param)
    : undefined;
  const sort = searchParams.get("sort") || "relevance";
  const page_param = searchParams.get("page");
  const page = page_param ? parseInt(page_param, 10) : 1;

  const currentFilters: FilterState = {
    category,
    brand,
    min_price,
    max_price,
    in_stock: in_stock || undefined,
    min_rating,
    sort,
  };

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<StorefrontProductCard[]>([]);
  const [facets, setFacets] = useState<StorefrontSearchFacets | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    storefrontApi
      .search(
        {
          q: query || undefined,
          category,
          brand,
          min_price,
          max_price,
          in_stock,
          min_rating,
          sort,
          page,
          limit: 20,
        },
        controller.signal,
      )
      .then((data) => {
        setProducts(data.results);
        setFacets(data.facets);
        setTotalCount(data.count);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });

    return () => controller.abort();
  }, [
    query,
    category,
    brand,
    min_price,
    max_price,
    in_stock,
    min_rating,
    sort,
    page,
  ]);

  // Navigate with updated filter state
  const handleFilterChange = (newFilters: FilterState) => {
    setLoading(true);
    const sp = new URLSearchParams();
    if (query) sp.set("q", query);
    if (newFilters.category) sp.set("category", newFilters.category);
    if (newFilters.brand) sp.set("brand", newFilters.brand);
    if (newFilters.min_price) sp.set("min_price", newFilters.min_price);
    if (newFilters.max_price) sp.set("max_price", newFilters.max_price);
    if (newFilters.in_stock) sp.set("in_stock", "true");
    if (newFilters.min_rating)
      sp.set("min_rating", String(newFilters.min_rating));
    if (newFilters.sort && newFilters.sort !== "relevance")
      sp.set("sort", newFilters.sort);

    router.push(`/search?${sp.toString()}`);
  };

  const handleClearAll = () => {
    setLoading(true);
    if (query) {
      router.push(`/search?q=${encodeURIComponent(query)}`);
    } else {
      router.push("/search");
    }
  };

  const handleSortChange = (newSort: string) => {
    handleFilterChange({ ...currentFilters, sort: newSort });
  };

  const totalPages = Math.ceil(totalCount / 20);

  return (
    <div className="sf-storefront flex min-h-screen flex-col bg-sf-background">
      <StorefrontHeader />

      <main
        id="storefront-content"
        tabIndex={-1}
        className="flex-1 mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 w-full"
      >
        {/* Breadcrumb & Search Summary Header */}
        <div className="mb-6">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-2 text-xs text-sf-muted mb-2"
          >
            <Link href="/" className="hover:text-sf-link transition">
              Home
            </Link>
            <span>/</span>
            <span className="font-semibold text-sf-foreground">Search</span>
          </nav>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-sf-foreground sm:text-3xl">
                {query ? (
                  <>
                    Results for &ldquo;
                    <span className="text-sf-link">{query}</span>&rdquo;
                  </>
                ) : (
                  "Explore All Products"
                )}
              </h1>
              <p className="mt-1 text-xs text-sf-muted">
                {loading
                  ? "Searching catalog..."
                  : `${totalCount} item${totalCount === 1 ? "" : "s"} found`}
              </p>
            </div>

            {/* Sort & Mobile Filter Toggle */}
            <div className="flex items-center gap-3 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
                className="flex items-center gap-1.5 rounded-sf-control border border-sf-control bg-sf-surface px-3 py-1.5 text-xs font-semibold text-sf-soft shadow-sf-small hover:bg-sf-background md:hidden"
              >
                <svg
                  className="h-4 w-4 text-sf-muted"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                  />
                </svg>
                Filters
              </button>

              <div className="flex items-center gap-2">
                <label
                  htmlFor="search-sort"
                  className="text-xs font-semibold text-sf-soft"
                >
                  Sort:
                </label>
                <select
                  id="search-sort"
                  value={sort}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="rounded-sf-control border border-sf-control bg-sf-surface px-3 py-1.5 text-xs font-medium text-sf-foreground shadow-sf-small focus:border-sf-action focus:outline-none"
                >
                  <option value="relevance">Relevance</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="rating">Highest Rated</option>
                  <option value="newest">Newest Arrivals</option>
                </select>
              </div>
            </div>
          </div>

          {/* Active Filter Chips */}
          <ActiveFilterBadges
            filters={currentFilters}
            facets={facets}
            onFilterChange={handleFilterChange}
            onClearAll={handleClearAll}
          />
        </div>

        {/* 2-Column Layout: Filter Sidebar + Products Grid */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Desktop Sidebar */}
          <div className="hidden md:block md:col-span-1">
            <SearchFiltersSidebar
              facets={facets}
              filters={currentFilters}
              onFilterChange={handleFilterChange}
            />
          </div>

          {/* Mobile Filter Drawer / Modal */}
          {mobileFiltersOpen && (
            <div className="fixed inset-0 z-50 flex bg-black/50 md:hidden">
              <div className="ml-auto w-full max-w-xs bg-sf-surface p-6 shadow-xl overflow-y-auto">
                <div className="flex items-center justify-between border-b pb-3 mb-4">
                  <h2 className="text-sm font-bold text-sf-foreground">
                    Filters
                  </h2>
                  <button
                    type="button"
                    onClick={() => setMobileFiltersOpen(false)}
                    className="text-sf-muted hover:text-sf-soft font-bold"
                  >
                    ✕
                  </button>
                </div>
                <SearchFiltersSidebar
                  facets={facets}
                  filters={currentFilters}
                  onFilterChange={(f) => {
                    handleFilterChange(f);
                    setMobileFiltersOpen(false);
                  }}
                />
              </div>
            </div>
          )}

          {/* Products Content Area */}
          <div className="md:col-span-3">
            {loading ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="h-80 rounded-sf-image border border-sf-border bg-sf-surface p-4 shadow-sf-small motion-safe:animate-pulse"
                  />
                ))}
              </div>
            ) : products.length > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="mt-10 flex items-center justify-center gap-3 border-t border-sf-border pt-6">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => {
                        const sp = new URLSearchParams(searchParams.toString());
                        sp.set("page", String(page - 1));
                        router.push(`/search?${sp.toString()}`);
                      }}
                      className="rounded-sf-control border border-sf-control bg-sf-surface px-4 py-2 text-xs font-semibold text-sf-soft shadow-sf-small hover:bg-sf-background disabled:opacity-40 transition"
                    >
                      ← Previous
                    </button>
                    <span className="text-xs text-sf-muted">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => {
                        const sp = new URLSearchParams(searchParams.toString());
                        sp.set("page", String(page + 1));
                        router.push(`/search?${sp.toString()}`);
                      }}
                      className="rounded-sf-control border border-sf-control bg-sf-surface px-4 py-2 text-xs font-semibold text-sf-soft shadow-sf-small hover:bg-sf-background disabled:opacity-40 transition"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            ) : (
              /* Empty Search Results State */
              <div className="rounded-2xl border border-dashed border-sf-control bg-sf-surface p-12 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sf-surface-strong text-sf-muted-strong mb-4">
                  <svg
                    className="h-8 w-8"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-sf-foreground">
                  No matching products found
                </h3>
                <p className="mt-1 text-xs text-sf-muted max-w-md mx-auto">
                  We couldn&apos;t find anything matching your search criteria.
                  Try adjusting your keywords, broadening price ranges, or
                  removing filters.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="rounded-sf-image bg-sf-action px-4 py-2 text-xs font-bold text-sf-on-dark shadow-sf-small hover:bg-sf-action-hover transition"
                  >
                    Clear All Filters
                  </button>
                  <Link
                    href="/"
                    className="rounded-sf-image border border-sf-control bg-sf-surface px-4 py-2 text-xs font-semibold text-sf-soft hover:bg-sf-background transition"
                  >
                    Browse Homepage
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <StorefrontFooter />
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="sf-storefront flex min-h-screen items-center justify-center bg-sf-background">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-sf-action border-t-transparent" />
        </div>
      }
    >
      <SearchResultsContent />
    </Suspense>
  );
}
