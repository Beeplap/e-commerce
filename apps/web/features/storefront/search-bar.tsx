"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { storefrontApi } from "@/lib/api/client";
import type { StorefrontSuggestResponse } from "@/lib/api/types";

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
            className="w-full rounded-xl border border-slate-300 bg-slate-50/80 px-4 py-2.5 pl-10 pr-10 text-sm text-slate-800 placeholder-slate-400 shadow-inner transition focus:border-orange-700 focus:bg-ui-surface focus:outline-none focus:ring-1 focus:ring-ui-focus"
          />
          <div className="pointer-events-none absolute left-3 text-slate-400">
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
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-600 border-t-transparent" />
            </div>
          ) : query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setData(null);
                setIsOpen(false);
              }}
              className="absolute right-3 text-xs text-slate-400 hover:text-slate-600"
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
          className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-ui-surface py-2 shadow-xl"
        >
          {/* Text Suggestions */}
          {data.suggestions.length > 0 && (
            <div className="px-2 py-1">
              <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
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
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 transition ${
                        isSelected
                          ? "bg-orange-50 text-orange-900 font-semibold"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <svg
                        className="h-3.5 w-3.5 text-slate-400 flex-shrink-0"
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
            <div className="border-t border-slate-100 px-2 py-1.5">
              <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Categories
              </span>
              <div className="mt-1 flex flex-wrap gap-1.5 px-2">
                {data.categories.map((c) => (
                  <Link
                    key={c.id}
                    href={`/categories/${c.id}`}
                    onClick={() => setIsOpen(false)}
                    className="rounded-md bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-800 hover:bg-orange-100 transition"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Brands Suggestions */}
          {data.brands.length > 0 && (
            <div className="border-t border-slate-100 px-2 py-1.5">
              <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Brands
              </span>
              <div className="mt-1 flex flex-wrap gap-1.5 px-2">
                {data.brands.map((b) => (
                  <Link
                    key={b.id}
                    href={`/search?brand=${b.id}`}
                    onClick={() => setIsOpen(false)}
                    className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 transition"
                  >
                    {b.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Top Matching Products */}
          {data.products.length > 0 && (
            <div className="border-t border-slate-100 px-2 py-1.5">
              <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Products
              </span>
              <div className="mt-1 space-y-1">
                {data.products.map((prod) => (
                  <Link
                    key={prod.id}
                    href={`/products/${prod.id}`}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 rounded-lg p-1.5 hover:bg-slate-50 transition"
                  >
                    <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                      {prod.thumbnail_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={prod.thumbnail_url}
                          alt={prod.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-slate-400">
                          QC
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-900">
                        {prod.title}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {prod.category_name}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-slate-900 pr-2">
                      ${parseFloat(prod.starting_price).toFixed(2)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* View All Results Link */}
          <div className="border-t border-slate-100 px-3 pt-2 pb-1 text-center">
            <button
              type="button"
              onClick={() => handleSubmit()}
              className="w-full text-xs font-semibold text-orange-700 hover:text-orange-900 hover:underline"
            >
              View all results for &ldquo;{query.trim()}&rdquo; →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
