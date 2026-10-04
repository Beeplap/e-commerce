"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { storefrontApi } from "@/lib/api/client";
import type { StorefrontSuggestResponse } from "@/lib/api/types";
import { StorefrontPrice } from "@/components/storefront/content";

interface SearchBarProps {
  initialQuery?: string;
  className?: string;
  onSearchSubmit?: (query: string) => void;
}

export function SearchBar({
  initialQuery = "",
  className = "",
  onSearchSubmit,
}: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<StorefrontSuggestResponse | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track initialQuery change during render (standard React pattern)
  const [prevInitialQuery, setPrevInitialQuery] = useState(initialQuery);
  if (prevInitialQuery !== initialQuery) {
    setPrevInitialQuery(initialQuery);
    setQuery(initialQuery);
  }

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch suggestions when query changes
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      setLoading(true);
      storefrontApi
        .suggest(trimmed, controller.signal)
        .then((res) => {
          setData(res);
          setIsOpen(true);
          setLoading(false);
          setSelectedIndex(-1);
        })
        .catch(() => {
          setLoading(false);
        });
    }, 150);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [query]);

  // Calculate flat items for keyboard navigation
  const flatItems: Array<{
    type: "suggestion" | "category" | "brand" | "product";
    href: string;
    label: string;
  }> = [];
  if (data) {
    data.suggestions.forEach((s) => {
      flatItems.push({
        type: "suggestion",
        href: `/search?q=${encodeURIComponent(s)}`,
        label: s,
      });
    });
    data.categories.forEach((c) => {
      flatItems.push({
        type: "category",
        href: `/categories/${c.id}`,
        label: c.name,
      });
    });
    data.brands.forEach((b) => {
      flatItems.push({
        type: "brand",
        href: `/search?brand=${b.id}`,
        label: b.name,
      });
    });
    data.products.forEach((p) => {
      flatItems.push({
        type: "product",
        href: `/products/${p.id}`,
        label: p.title,
      });
    });
  }

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = query.trim();
    setIsOpen(false);

    const selectedItem = flatItems[selectedIndex];
    if (selectedItem) {
      router.push(selectedItem.href);
      return;
    }

    if (trimmed) {
      if (onSearchSubmit) {
        onSearchSubmit(trimmed);
      } else {
        router.push(`/search?q=${encodeURIComponent(trimmed)}`);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || flatItems.length === 0) {
      if (e.key === "Enter") {
        handleSubmit(e);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < flatItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : flatItems.length - 1));
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setSelectedIndex(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <form onSubmit={handleSubmit} role="search">
        <div className="relative flex items-center">
          <input
            type="search"
            role="combobox"
            aria-label="Search products, brands and categories"
            aria-expanded={isOpen}
            aria-autocomplete="list"
            aria-controls="search-suggestions-dropdown"
            placeholder="Search products, brands, categories..."
            value={query}
            onChange={(e) => {
              const val = e.target.value;
              setQuery(val);
              if (!val.trim()) {
                setData(null);
                setIsOpen(false);
                setLoading(false);
              }
            }}
            onFocus={() => {
              if (data && query.trim()) setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            className="w-full rounded-sf-control border border-sf-control bg-sf-surface px-4 py-2.5 pl-10 pr-10 text-sm text-sf-foreground placeholder-sf-muted transition focus:border-sf-action focus:outline-none"
          />
          <div className="pointer-events-none absolute left-3 text-sf-muted">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          {loading ? (
            <div className="absolute right-3">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-sf-action border-t-transparent" />
            </div>
          ) : query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setData(null);
                setIsOpen(false);
              }}
              className="absolute right-3 text-xs text-sf-muted hover:text-sf-soft"
              aria-label="Clear search input"
            >
              ✕
            </button>
          ) : null}
        </div>
      </form>

      {/* Autocomplete Dropdown */}
      {isOpen && data && (
        <div
          id="search-suggestions-dropdown"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-96 overflow-y-auto rounded-sf-image border border-sf-border bg-sf-surface py-2 shadow-sf-overlay"
        >
          {/* Text Suggestions */}
          {data.suggestions.length > 0 && (
            <div className="px-2 py-1">
              <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-sf-muted">
                Suggestions
              </span>
              <div className="mt-1 space-y-0.5">
                {data.suggestions.map((suggestion, idx) => {
                  const itemIndex = idx;
                  const isSelected = selectedIndex === itemIndex;
                  return (
                    <button
                      key={suggestion}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        setQuery(suggestion);
                        setIsOpen(false);
                        router.push(
                          `/search?q=${encodeURIComponent(suggestion)}`,
                        );
                      }}
                      className={`flex w-full items-center gap-2 rounded-sf-control px-2 py-1.5 text-left text-sm text-sf-soft transition ${
                        isSelected
                          ? "bg-sf-accent-soft text-sf-link font-semibold"
                          : "hover:bg-sf-background"
                      }`}
                    >
                      <svg
                        className="h-3.5 w-3.5 text-sf-muted flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                      <span className="truncate">{suggestion}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Categories Suggestions */}
          {data.categories.length > 0 && (
            <div className="border-t border-sf-border px-2 py-1.5">
              <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-sf-muted">
                Categories
              </span>
              <div className="mt-1 flex flex-wrap gap-1.5 px-2">
                {data.categories.map((c) => (
                  <Link
                    key={c.id}
                    href={`/categories/${c.id}`}
                    onClick={() => setIsOpen(false)}
                    className="rounded-md bg-sf-accent-soft px-2.5 py-1 text-xs font-medium text-sf-link hover:bg-sf-accent-soft transition"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Brands Suggestions */}
          {data.brands.length > 0 && (
            <div className="border-t border-sf-border px-2 py-1.5">
              <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-sf-muted">
                Brands
              </span>
              <div className="mt-1 flex flex-wrap gap-1.5 px-2">
                {data.brands.map((b) => (
                  <Link
                    key={b.id}
                    href={`/search?brand=${b.id}`}
                    onClick={() => setIsOpen(false)}
                    className="rounded-md bg-sf-surface-strong px-2.5 py-1 text-xs font-medium text-sf-soft hover:bg-sf-border transition"
                  >
                    {b.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Top Matching Products */}
          {data.products.length > 0 && (
            <div className="border-t border-sf-border px-2 py-1.5">
              <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-sf-muted">
                Products
              </span>
              <div className="mt-1 space-y-1">
                {data.products.map((prod) => (
                  <Link
                    key={prod.id}
                    href={`/products/${prod.id}`}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 rounded-sf-control p-1.5 hover:bg-sf-background transition"
                  >
                    <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-md border border-sf-border bg-sf-surface-strong">
                      {prod.thumbnail_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={prod.thumbnail_url}
                          alt={prod.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-sf-muted">
                          QC
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-xs font-semibold text-sf-foreground">
                        {prod.title}
                      </p>
                      <p className="text-[10px] text-sf-muted">
                        {prod.category_name}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-sf-foreground pr-2">
                      <StorefrontPrice
                        amount={prod.starting_price}
                        currency={prod.currency}
                      />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* View All Results Link */}
          <div className="border-t border-sf-border px-3 pt-2 pb-1 text-center">
            <button
              type="button"
              onClick={() => handleSubmit()}
              className="w-full text-xs font-semibold text-sf-link hover:text-sf-link hover:underline"
            >
              View all results for &ldquo;{query.trim()}&rdquo; →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
