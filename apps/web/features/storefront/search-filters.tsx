"use client";

import { useState } from "react";
import type { StorefrontSearchFacets } from "@/lib/api/types";

export interface FilterState {
  category?: string;
  brand?: string;
  min_price?: string;
  max_price?: string;
  in_stock?: boolean;
  min_rating?: number;
  sort?: string;
}

interface SearchFiltersSidebarProps {
  facets: StorefrontSearchFacets | null;
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  className?: string;
}

export function SearchFiltersSidebar({
  facets,
  filters,
  onFilterChange,
  className = "",
}: SearchFiltersSidebarProps) {
  const [customMin, setCustomMin] = useState(filters.min_price || "");
  const [customMax, setCustomMax] = useState(filters.max_price || "");

  const handleApplyCustomPrice = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange({
      ...filters,
      min_price: customMin || undefined,
      max_price: customMax || undefined,
    });
  };

  return (
    <aside className={`space-y-6 ${className}`}>
      {/* In-Stock Only Toggle */}
      <div className="rounded-sf-image border border-sf-border bg-sf-surface p-4 shadow-sf-small">
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm font-semibold text-sf-foreground">
            In-Stock Only
          </span>
          <input
            type="checkbox"
            checked={!!filters.in_stock}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                in_stock: e.target.checked || undefined,
              })
            }
            className="h-4 w-4 rounded border-sf-control text-sf-link focus:ring-sf-action cursor-pointer"
          />
        </label>
        {facets && (
          <p className="mt-1 text-xs text-sf-muted">
            {facets.in_stock_count} item{facets.in_stock_count === 1 ? "" : "s"}{" "}
            ready to ship
          </p>
        )}
      </div>

      {/* Categories Facet */}
      {facets && facets.categories.length > 0 && (
        <div className="rounded-sf-image border border-sf-border bg-sf-surface p-4 shadow-sf-small">
          <h3 className="text-xs font-bold uppercase tracking-wider text-sf-muted">
            Categories
          </h3>
          <div className="mt-3 space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {facets.categories.map((cat) => {
              const isSelected = filters.category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() =>
                    onFilterChange({
                      ...filters,
                      category: isSelected ? undefined : cat.id,
                    })
                  }
                  className={`flex w-full items-center justify-between rounded-sf-control px-2.5 py-1.5 text-xs transition ${
                    isSelected
                      ? "bg-sf-accent-soft font-semibold text-sf-link"
                      : "text-sf-soft hover:bg-sf-background hover:text-sf-foreground"
                  }`}
                >
                  <span className="truncate">{cat.name}</span>
                  <span
                    className={`ml-2 rounded px-1.5 py-0.5 text-[10px] ${
                      isSelected
                        ? "bg-sf-accent-soft text-sf-link"
                        : "bg-sf-surface-strong text-sf-muted-strong"
                    }`}
                  >
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Brands Facet */}
      {facets && facets.brands.length > 0 && (
        <div className="rounded-sf-image border border-sf-border bg-sf-surface p-4 shadow-sf-small">
          <h3 className="text-xs font-bold uppercase tracking-wider text-sf-muted">
            Brands
          </h3>
          <div className="mt-3 space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {facets.brands.map((brand) => {
              const isSelected = filters.brand === brand.id;
              return (
                <button
                  key={brand.id}
                  type="button"
                  onClick={() =>
                    onFilterChange({
                      ...filters,
                      brand: isSelected ? undefined : brand.id,
                    })
                  }
                  className={`flex w-full items-center justify-between rounded-sf-control px-2.5 py-1.5 text-xs transition ${
                    isSelected
                      ? "bg-sf-accent-soft font-semibold text-sf-link"
                      : "text-sf-soft hover:bg-sf-background hover:text-sf-foreground"
                  }`}
                >
                  <span className="truncate">{brand.name}</span>
                  <span
                    className={`ml-2 rounded px-1.5 py-0.5 text-[10px] ${
                      isSelected
                        ? "bg-sf-accent-soft text-sf-link"
                        : "bg-sf-surface-strong text-sf-muted-strong"
                    }`}
                  >
                    {brand.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Price Brackets & Range */}
      <div className="rounded-sf-image border border-sf-border bg-sf-surface p-4 shadow-sf-small">
        <h3 className="text-xs font-bold uppercase tracking-wider text-sf-muted">
          Price Range
        </h3>

        {/* Pre-calculated Price Brackets */}
        {facets && facets.price_brackets.length > 0 && (
          <div className="mt-3 space-y-1">
            {facets.price_brackets.map((b) => {
              const isSelected =
                filters.min_price === b.min_price &&
                (filters.max_price === b.max_price ||
                  (!filters.max_price && !b.max_price));
              return (
                <button
                  key={b.label}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      onFilterChange({
                        ...filters,
                        min_price: undefined,
                        max_price: undefined,
                      });
                      setCustomMin("");
                      setCustomMax("");
                    } else {
                      onFilterChange({
                        ...filters,
                        min_price: b.min_price,
                        max_price: b.max_price || undefined,
                      });
                      setCustomMin(b.min_price);
                      setCustomMax(b.max_price || "");
                    }
                  }}
                  className={`flex w-full items-center justify-between rounded-sf-control px-2.5 py-1.5 text-xs transition ${
                    isSelected
                      ? "bg-sf-accent-soft font-semibold text-sf-link"
                      : "text-sf-soft hover:bg-sf-background"
                  }`}
                >
                  <span>{b.label}</span>
                  <span
                    className={`ml-2 rounded px-1.5 py-0.5 text-[10px] ${
                      isSelected
                        ? "bg-sf-accent-soft text-sf-link"
                        : "bg-sf-surface-strong text-sf-muted-strong"
                    }`}
                  >
                    {b.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Custom Min / Max Inputs */}
        <form
          onSubmit={handleApplyCustomPrice}
          className="mt-4 border-t border-sf-border pt-3"
        >
          <div className="flex items-center gap-2 text-xs">
            <input
              type="number"
              placeholder="Min $"
              min="0"
              value={customMin}
              onChange={(e) => setCustomMin(e.target.value)}
              className="w-full rounded-sf-control border border-sf-border px-2 py-1 text-sf-foreground placeholder-sf-control focus:border-sf-action focus:outline-none"
            />
            <span className="text-sf-muted">–</span>
            <input
              type="number"
              placeholder="Max $"
              min="0"
              value={customMax}
              onChange={(e) => setCustomMax(e.target.value)}
              className="w-full rounded-sf-control border border-sf-border px-2 py-1 text-sf-foreground placeholder-sf-control focus:border-sf-action focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-sf-control bg-sf-action px-3 py-1 font-semibold text-sf-on-dark hover:bg-sf-action-hover transition"
            >
              Go
            </button>
          </div>
        </form>
      </div>

      {/* Customer Rating Facet */}
      {facets && facets.rating_brackets.length > 0 && (
        <div className="rounded-sf-image border border-sf-border bg-sf-surface p-4 shadow-sf-small">
          <h3 className="text-xs font-bold uppercase tracking-wider text-sf-muted">
            Customer Rating
          </h3>
          <div className="mt-3 space-y-1">
            {facets.rating_brackets.map((r) => {
              const isSelected = filters.min_rating === r.min_rating;
              return (
                <button
                  key={r.min_rating}
                  type="button"
                  onClick={() =>
                    onFilterChange({
                      ...filters,
                      min_rating: isSelected ? undefined : r.min_rating,
                    })
                  }
                  className={`flex w-full items-center justify-between rounded-sf-control px-2.5 py-1.5 text-xs transition ${
                    isSelected
                      ? "bg-sf-accent-soft font-semibold text-sf-link"
                      : "text-sf-soft hover:bg-sf-background"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-sf-warning-text text-xs">
                      {"★".repeat(r.min_rating)}
                      {"☆".repeat(5 - r.min_rating)}
                    </span>
                    <span>&amp; up</span>
                  </div>
                  <span
                    className={`ml-2 rounded px-1.5 py-0.5 text-[10px] ${
                      isSelected
                        ? "bg-sf-accent-soft text-sf-link"
                        : "bg-sf-surface-strong text-sf-muted-strong"
                    }`}
                  >
                    {r.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}

interface ActiveFilterBadgesProps {
  filters: FilterState;
  facets: StorefrontSearchFacets | null;
  onFilterChange: (filters: FilterState) => void;
  onClearAll: () => void;
}

export function ActiveFilterBadges({
  filters,
  facets,
  onFilterChange,
  onClearAll,
}: ActiveFilterBadgesProps) {
  const chips: Array<{ id: string; label: string; onRemove: () => void }> = [];

  if (filters.category && facets) {
    const cat = facets.categories.find((c) => c.id === filters.category);
    chips.push({
      id: "category",
      label: `Category: ${cat ? cat.name : "Selected"}`,
      onRemove: () => onFilterChange({ ...filters, category: undefined }),
    });
  }

  if (filters.brand && facets) {
    const brand = facets.brands.find((b) => b.id === filters.brand);
    chips.push({
      id: "brand",
      label: `Brand: ${brand ? brand.name : "Selected"}`,
      onRemove: () => onFilterChange({ ...filters, brand: undefined }),
    });
  }

  if (filters.min_price || filters.max_price) {
    let priceLabel = "Price: ";
    if (filters.min_price && filters.max_price) {
      priceLabel += `$${filters.min_price} - $${filters.max_price}`;
    } else if (filters.min_price) {
      priceLabel += `Over $${filters.min_price}`;
    } else if (filters.max_price) {
      priceLabel += `Under $${filters.max_price}`;
    }
    chips.push({
      id: "price",
      label: priceLabel,
      onRemove: () =>
        onFilterChange({
          ...filters,
          min_price: undefined,
          max_price: undefined,
        }),
    });
  }

  if (filters.min_rating) {
    chips.push({
      id: "rating",
      label: `${filters.min_rating}★ & above`,
      onRemove: () => onFilterChange({ ...filters, min_rating: undefined }),
    });
  }

  if (filters.in_stock) {
    chips.push({
      id: "in_stock",
      label: "In Stock Only",
      onRemove: () => onFilterChange({ ...filters, in_stock: undefined }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      <span className="text-xs text-sf-muted font-medium">Filters:</span>
      {chips.map((chip) => (
        <span
          key={chip.id}
          className="inline-flex items-center gap-1.5 rounded-full border border-sf-action bg-sf-accent-soft px-3 py-1 text-xs font-medium text-sf-link shadow-sf-small"
        >
          {chip.label}
          <button
            type="button"
            onClick={chip.onRemove}
            className="hover:text-sf-link font-bold ml-1"
            aria-label={`Remove filter ${chip.label}`}
          >
            ✕
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="text-xs font-semibold text-sf-danger hover:text-sf-danger hover:underline ml-2"
      >
        Clear All
      </button>
    </div>
  );
}
