"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  StorefrontBreadcrumb,
  StorefrontSkeleton,
} from "@/components/storefront/content";
import {
  StorefrontButton,
  StorefrontInput,
  StorefrontSelect,
} from "@/components/storefront/controls";
import {
  StorefrontNotice,
  StorefrontOverlay,
} from "@/components/storefront/feedback";
import { StorefrontHeader } from "../header";
import { StorefrontFooter } from "../footer";
import { isUuid } from "../catalog-evidence";
import { ActiveFilterBadges, SearchFiltersSidebar } from "../search-filters";
import { DiscoveryProduct } from "./product";
import {
  discoveryHref,
  filterChips,
  pageSize,
  readDiscoveryQuery,
  sortOptions,
  type DiscoveryQuery,
  type FilterState,
} from "./query";
import {
  useDiscovery,
  useDiscoveryCategories,
  type Input,
} from "./use-discovery";

export function DiscoveryShell({ children }: { children: ReactNode }) {
  return (
    <div className="sf-storefront sf-discovery flex min-h-screen flex-col">
      <StorefrontHeader />
      <main
        id="storefront-content"
        tabIndex={-1}
        className="sf-discovery-container flex-1"
      >
        {children}
      </main>
      <StorefrontFooter />
    </div>
  );
}
function ProductLoading() {
  return (
    <div
      className="sf-discovery-grid"
      role="status"
      aria-label="Loading products"
    >
      {[1, 2, 3, 4, 5, 6].map((key) => (
        <StorefrontSkeleton
          key={key}
          className="sf-discovery-product-loading"
        />
      ))}
    </div>
  );
}
export function DiscoveryLoading() {
  return (
    <>
      <div className="sf-discovery-heading">
        <p role="status">Loading the catalog…</p>
      </div>
      <ProductLoading />
    </>
  );
}

function SearchAlternative({
  query,
  onSearch,
}: {
  query: string;
  onSearch: (query: string) => void;
}) {
  const [value, setValue] = useState(query);
  return (
    <form
      className="sf-discovery-search-again"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(value);
      }}
    >
      <StorefrontInput
        label="Try another search"
        type="search"
        value={value}
        maxLength={100}
        onChange={(event) => setValue(event.target.value)}
      />
      <StorefrontButton type="submit">Search</StorefrontButton>
    </form>
  );
}

export function DiscoveryPage({
  categoryId: suppliedCategoryId,
}: {
  categoryId?: string;
}) {
  const categoryId = suppliedCategoryId?.toLowerCase();
  const params = useSearchParams().toString();
  const input = useMemo<Input>(() => {
    try {
      return {
        value: readDiscoveryQuery(new URLSearchParams(params), categoryId),
      };
    } catch (error) {
      return {
        error:
          error instanceof Error ? error.message : "This address is invalid.",
      };
    }
  }, [params, categoryId]);
  return (
    <DiscoveryContent
      key={categoryId || "search"}
      input={input}
      categoryId={categoryId}
    />
  );
}

function DiscoveryContent({
  input,
  categoryId,
}: {
  input: Input;
  categoryId?: string;
}) {
  const router = useRouter();
  const { read, retry } = useDiscovery(input);
  const categories = useDiscoveryCategories();
  const category =
    categoryId && categories.read.kind === "ready"
      ? categories.read.value.find((item) => item.id === categoryId)
      : undefined;
  const current: DiscoveryQuery = input.value || {
    query: "",
    filters: { sort: categoryId ? "newest" : "relevance" },
    page: 1,
  };
  const result = input.value && read.kind === "ready" ? read.value : undefined;
  const facets = result?.facets || null;
  const [drawerInput, setDrawerInput] = useState<Input>();
  const [draft, setDraft] = useState<FilterState>({});
  const drawerOpen = drawerInput === input;
  const filterButton = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLDivElement>(null);
  const shouldFocusResults = useRef(false);
  const shouldFocusAfterResize = useRef(false);
  const activeCount = filterChips(current.filters, facets, categoryId).length;
  const changeFilters = (filters: FilterState) => {
    setDrawerInput(undefined);
    router.push(discoveryHref({ ...current, filters, page: 1 }, categoryId), {
      scroll: false,
    });
  };
  const clearAll = () =>
    changeFilters({ category: categoryId, sort: current.filters.sort });
  const resetAddress = () =>
    router.push(
      categoryId && isUuid(categoryId)
        ? `/categories/${encodeURIComponent(categoryId)}`
        : "/search",
    );
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const close = () => {
      if (media.matches && drawerOpen) {
        shouldFocusAfterResize.current = true;
        setDrawerInput(undefined);
      }
    };
    media.addEventListener("change", close);
    return () => media.removeEventListener("change", close);
  }, [drawerOpen]);
  useEffect(() => {
    if (!drawerOpen && shouldFocusAfterResize.current) {
      heading.current?.focus();
      shouldFocusAfterResize.current = false;
    }
  }, [drawerOpen]);
  useEffect(() => {
    if (result && shouldFocusResults.current) {
      heading.current?.focus();
      heading.current?.scrollIntoView({ block: "start" });
      shouldFocusResults.current = false;
    }
  }, [result]);
  const title = categoryId
    ? category?.name || "Category"
    : current.query
      ? `Results for “${current.query}”`
      : "Shop all products";
  const totalPages = result
    ? Math.max(1, Math.ceil(result.count / pageSize))
    : 1;
  const invalidCategory =
    categoryId && categories.read.kind === "ready" && !category;
  const suggestions =
    categories.read.kind === "ready"
      ? categories.read.value
          .filter((item) => item.id !== categoryId)
          .slice(0, 6)
      : [];
  return (
    <>
      <StorefrontBreadcrumb
        items={[
          { label: "Home", href: "/" },
          ...(categoryId ? [{ label: "Shop", href: "/search" }] : []),
          {
            label: categoryId
              ? category?.name || "Category"
              : current.query
                ? "Search"
                : "Shop",
          },
        ]}
      />
      <div className="sf-discovery-heading" ref={heading} tabIndex={-1}>
        <p className="sf-discovery-eyebrow">Find your next favourite</p>
        <h1>{title}</h1>
        {category?.description && (
          <p className="sf-discovery-description">{category.description}</p>
        )}
        <div className="sf-discovery-summary" role="status" aria-live="polite">
          {input.error || read.kind === "error"
            ? "Results are unavailable."
            : !result
              ? "Searching catalog…"
              : `${result.count} item${result.count === 1 ? "" : "s"} found`}
          {current.query && (
            <StorefrontButton
              variant="quiet"
              onClick={() =>
                router.push(
                  discoveryHref({ ...current, query: "", page: 1 }, categoryId),
                )
              }
            >
              Clear search
            </StorefrontButton>
          )}
        </div>
      </div>
      {categoryId && categories.read.kind === "error" && (
        <StorefrontNotice tone="error">
          Category details are unavailable.{" "}
          <StorefrontButton variant="quiet" onClick={categories.retry}>
            Retry category details
          </StorefrontButton>
        </StorefrontNotice>
      )}
      <div className="sf-discovery-toolbar">
        <StorefrontButton
          variant="secondary"
          ref={filterButton}
          className="sf-discovery-filter-trigger"
          aria-haspopup="dialog"
          aria-expanded={drawerOpen}
          onClick={() => {
            setDraft(current.filters);
            setDrawerInput(input);
          }}
        >
          Filters{activeCount ? ` (${activeCount})` : ""}
        </StorefrontButton>
        <span className="sf-discovery-toolbar-label">Explore the catalog</span>
        <StorefrontSelect
          id="search-sort"
          label="Sort:"
          value={current.filters.sort}
          onChange={(event) =>
            changeFilters({ ...current.filters, sort: event.target.value })
          }
        >
          {sortOptions.map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </StorefrontSelect>
      </div>
      <ActiveFilterBadges
        filters={current.filters}
        facets={facets}
        categoryId={categoryId}
        onFilterChange={changeFilters}
        onClearAll={clearAll}
      />
      <div className="sf-discovery-layout">
        <div className="sf-discovery-sidebar">
          <h2>Refine your search</h2>
          <SearchFiltersSidebar
            facets={facets}
            filters={current.filters}
            categoryId={categoryId}
            onFilterChange={changeFilters}
          />
        </div>
        <section
          className="sf-discovery-results"
          aria-label="Product results"
          aria-busy={Boolean(input.value && read.kind === "loading")}
        >
          {input.error ? (
            <div className="sf-discovery-state" role="alert">
              <h2>Check your search address</h2>
              <p>{input.error}</p>
              <StorefrontButton variant="secondary" onClick={resetAddress}>
                Reset search address
              </StorefrontButton>
            </div>
          ) : invalidCategory ? (
            <div className="sf-discovery-state">
              <h2>This category is unavailable.</h2>
              <p>Explore other categories or search the catalog below.</p>
              <Link
                href="/search"
                className="sf-button"
                data-variant="secondary"
              >
                Shop all products
              </Link>
            </div>
          ) : read.kind === "loading" ? (
            <ProductLoading />
          ) : read.kind === "error" ? (
            <div className="sf-discovery-state" role="alert">
              <h2>We couldn’t load these products.</h2>
              <p>
                Please try again. Your search and filters are still in the
                address.
              </p>
              <StorefrontButton variant="secondary" onClick={retry}>
                Retry products
              </StorefrontButton>
            </div>
          ) : result && result.results.length ? (
            <>
              <div className="sf-discovery-grid">
                {result.results.map((product) => (
                  <DiscoveryProduct key={product.id} product={product} />
                ))}
              </div>
              {totalPages > 1 && (
                <nav
                  className="sf-discovery-pagination"
                  aria-label="Product pages"
                >
                  {current.page > 1 ? (
                    <Link
                      href={discoveryHref(
                        { ...current, page: current.page - 1 },
                        categoryId,
                      )}
                      className="sf-button"
                      data-variant="secondary"
                      onClick={() => {
                        shouldFocusResults.current = true;
                      }}
                    >
                      Previous
                    </Link>
                  ) : (
                    <span
                      className="sf-button"
                      data-variant="secondary"
                      aria-disabled="true"
                    >
                      Previous
                    </span>
                  )}
                  <span>
                    Page {current.page} of {totalPages}
                  </span>
                  {current.page < totalPages ? (
                    <Link
                      href={discoveryHref(
                        { ...current, page: current.page + 1 },
                        categoryId,
                      )}
                      className="sf-button"
                      data-variant="secondary"
                      onClick={() => {
                        shouldFocusResults.current = true;
                      }}
                    >
                      Next
                    </Link>
                  ) : (
                    <span
                      className="sf-button"
                      data-variant="secondary"
                      aria-disabled="true"
                    >
                      Next
                    </span>
                  )}
                </nav>
              )}
            </>
          ) : (
            <div className="sf-discovery-state">
              <p className="sf-discovery-eyebrow">
                A different route to a good find
              </p>
              <h2>
                {current.page > 1
                  ? "This page has no products."
                  : "No matching products found"}
              </h2>
              <p>
                {current.page > 1
                  ? "The catalog may have changed. Return to the first page with your current filters."
                  : "Try different words, broaden the price range, or remove a filter."}
              </p>
              <div className="sf-discovery-state-actions">
                {current.page > 1 && (
                  <Link
                    href={discoveryHref({ ...current, page: 1 }, categoryId)}
                    className="sf-button"
                    data-variant="primary"
                  >
                    Go to first page
                  </Link>
                )}
                <StorefrontButton variant="secondary" onClick={clearAll}>
                  Clear All Filters
                </StorefrontButton>
                <Link href="/search" className="sf-button" data-variant="quiet">
                  Shop all products
                </Link>
              </div>
            </div>
          )}
          {(input.error ||
            invalidCategory ||
            (result && !result.results.length)) && (
            <div className="sf-discovery-recovery">
              <SearchAlternative
                key={current.query}
                query={current.query}
                onSearch={(query) =>
                  router.push(
                    discoveryHref(
                      {
                        query,
                        filters: {
                          category: categoryId,
                          sort: categoryId ? "newest" : "relevance",
                        },
                        page: 1,
                      },
                      categoryId,
                    ),
                  )
                }
              />
              {suggestions.length > 0 && (
                <div className="sf-discovery-suggestions">
                  <h2>Try a category</h2>
                  {suggestions.map((item) => (
                    <Link
                      key={item.id}
                      href={`/categories/${encodeURIComponent(item.id)}`}
                    >
                      {item.name}
                    </Link>
                  ))}
                </div>
              )}
              {categories.read.kind === "error" && (
                <StorefrontButton variant="quiet" onClick={categories.retry}>
                  Retry category suggestions
                </StorefrontButton>
              )}
            </div>
          )}
        </section>
      </div>
      {drawerOpen && (
        <div className="sf-discovery-filter-overlay">
          <StorefrontOverlay
            kind="drawer"
            open
            title="Filters"
            description="Choose filters, then apply them to the catalog."
            onClose={() => setDrawerInput(undefined)}
          >
            <div className="sf-discovery-drawer">
              <SearchFiltersSidebar
                facets={facets}
                filters={draft}
                categoryId={categoryId}
                onFilterChange={setDraft}
              />
              <div className="sf-discovery-drawer-actions">
                <StorefrontButton
                  variant="quiet"
                  onClick={() =>
                    setDraft({
                      category: categoryId,
                      sort: current.filters.sort,
                    })
                  }
                >
                  Clear filters
                </StorefrontButton>
                <StorefrontButton onClick={() => changeFilters(draft)}>
                  Apply filters
                </StorefrontButton>
              </div>
            </div>
          </StorefrontOverlay>
        </div>
      )}
    </>
  );
}
