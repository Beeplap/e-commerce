"use client";

import { useState } from "react";
import type { StorefrontSearchFacets } from "@/lib/api/types";
import {
  StorefrontButton,
  StorefrontInput,
} from "@/components/storefront/controls";
import {
  filterChips,
  validPriceRange,
  type FilterState,
} from "./discovery/query";
export type { FilterState } from "./discovery/query";

type FilterProps = {
  facets: StorefrontSearchFacets | null;
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  categoryId?: string;
  className?: string;
};

function facetSelected(
  id: string | undefined,
  slug: string | undefined,
  item: { id: string; slug: string },
) {
  return id ? id === item.id : slug === item.slug;
}

function PriceRange({
  filters,
  onFilterChange,
}: Pick<FilterProps, "filters" | "onFilterChange">) {
  const [min, setMin] = useState(filters.min_price || "");
  const [max, setMax] = useState(filters.max_price || "");
  const [error, setError] = useState<string>();
  return (
    <form
      className="sf-discovery-price-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!validPriceRange(min, max)) {
          setError(
            "Enter nonnegative prices with the maximum at least the minimum.",
          );
          return;
        }
        setError(undefined);
        onFilterChange({
          ...filters,
          min_price: min || undefined,
          max_price: max || undefined,
        });
      }}
    >
      <div className="sf-discovery-price-inputs">
        <StorefrontInput
          label="Minimum price"
          inputMode="decimal"
          maxLength={128}
          value={min}
          error={error}
          onChange={(event) => setMin(event.target.value)}
        />
        <StorefrontInput
          label="Maximum price"
          inputMode="decimal"
          maxLength={128}
          value={max}
          aria-invalid={Boolean(error)}
          onChange={(event) => setMax(event.target.value)}
        />
      </div>
      <StorefrontButton type="submit" variant="secondary">
        Apply price
      </StorefrontButton>
    </form>
  );
}

export function SearchFiltersSidebar({
  facets,
  filters,
  onFilterChange,
  categoryId,
  className = "",
}: FilterProps) {
  return (
    <aside
      className={`sf-discovery-filters ${className}`}
      aria-label="Product filters"
    >
      <div className="sf-discovery-filter-group">
        <label className="sf-discovery-stock-filter">
          <input
            type="checkbox"
            checked={Boolean(filters.in_stock)}
            onChange={(event) =>
              onFilterChange({
                ...filters,
                in_stock: event.target.checked || undefined,
              })
            }
          />
          <span>In-Stock Only</span>
        </label>
        {facets && (
          <p className="sf-discovery-filter-hint">
            {facets.in_stock_count} matching{" "}
            {facets.in_stock_count === 1 ? "product is" : "products are"} in
            stock before filters.
          </p>
        )}
      </div>
      {!categoryId && facets && facets.categories.length > 0 && (
        <fieldset className="sf-discovery-filter-group">
          <legend>Categories</legend>
          <div className="sf-discovery-facet-list">
            {facets.categories.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-label={`${item.name}: ${item.count} products before filters`}
                aria-pressed={facetSelected(
                  filters.category,
                  filters.category_slug,
                  item,
                )}
                onClick={() =>
                  onFilterChange({
                    ...filters,
                    category: facetSelected(
                      filters.category,
                      filters.category_slug,
                      item,
                    )
                      ? undefined
                      : item.id,
                    category_slug: undefined,
                  })
                }
              >
                <span>{item.name}</span>{" "}
                <span>
                  {item.count}
                  <span className="sr-only"> products before filters</span>
                </span>
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {facets && facets.brands.length > 0 && (
        <fieldset className="sf-discovery-filter-group">
          <legend>Brands</legend>
          <div className="sf-discovery-facet-list">
            {facets.brands.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-label={`${item.name}: ${item.count} products before filters`}
                aria-pressed={facetSelected(
                  filters.brand,
                  filters.brand_slug,
                  item,
                )}
                onClick={() =>
                  onFilterChange({
                    ...filters,
                    brand: facetSelected(
                      filters.brand,
                      filters.brand_slug,
                      item,
                    )
                      ? undefined
                      : item.id,
                    brand_slug: undefined,
                  })
                }
              >
                <span>{item.name}</span>{" "}
                <span>
                  {item.count}
                  <span className="sr-only"> products before filters</span>
                </span>
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <fieldset className="sf-discovery-filter-group">
        <legend>Price range</legend>
        <p className="sf-discovery-filter-hint">
          Amounts use each product’s listed currency. Prices are not converted.
        </p>
        {facets && facets.price_brackets.length > 0 && (
          <div className="sf-discovery-facet-list">
            {facets.price_brackets.map((item, index) => {
              const selected =
                filters.min_price === item.min_price &&
                (filters.max_price || null) === item.max_price;
              return (
                <button
                  key={index}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    onFilterChange({
                      ...filters,
                      min_price: selected ? undefined : item.min_price,
                      max_price: selected
                        ? undefined
                        : item.max_price || undefined,
                    })
                  }
                >
                  <span>
                    {item.max_price
                      ? `${item.min_price} to ${item.max_price}`
                      : `${item.min_price} and above`}
                  </span>
                  {selected && <span aria-hidden="true">✓</span>}
                </button>
              );
            })}
          </div>
        )}
        <PriceRange
          key={`${filters.min_price || ""}:${filters.max_price || ""}`}
          filters={filters}
          onFilterChange={onFilterChange}
        />
      </fieldset>
      {facets && facets.rating_brackets.length > 0 && (
        <fieldset className="sf-discovery-filter-group">
          <legend>Customer rating</legend>
          <div className="sf-discovery-facet-list">
            {facets.rating_brackets.map((item, index) => (
              <button
                key={index}
                type="button"
                aria-pressed={filters.min_rating === item.min_rating}
                aria-label={`${item.min_rating} stars & above: ${item.count} products before filters`}
                onClick={() =>
                  onFilterChange({
                    ...filters,
                    min_rating:
                      filters.min_rating === item.min_rating
                        ? undefined
                        : item.min_rating,
                  })
                }
              >
                <span>{item.min_rating} stars &amp; above</span>{" "}
                <span>
                  {item.count}
                  <span className="sr-only"> products before filters</span>
                </span>
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {facets && (
        <p className="sf-discovery-filter-hint">
          Category, brand and rating counts reflect your search words before
          filters.
        </p>
      )}
    </aside>
  );
}

export function ActiveFilterBadges({
  filters,
  facets,
  onFilterChange,
  onClearAll,
  categoryId,
}: FilterProps & { onClearAll: () => void }) {
  const chips = filterChips(filters, facets, categoryId);
  if (!chips.length) return null;
  return (
    <div className="sf-discovery-active" aria-label="Active filters">
      <span>Filters:</span>
      {chips.map((chip) => (
        <StorefrontButton
          key={chip.label}
          variant="secondary"
          aria-label={`Remove filter ${chip.label}`}
          onClick={() => onFilterChange(chip.clear)}
        >
          {chip.label}
          <span aria-hidden="true"> ×</span>
        </StorefrontButton>
      ))}
      <StorefrontButton variant="quiet" onClick={onClearAll}>
        Clear All
      </StorefrontButton>
    </div>
  );
}
