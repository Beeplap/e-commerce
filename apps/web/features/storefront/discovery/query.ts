import type { StorefrontSearchFacets } from "@/lib/api/types";
import { isDecimal, isUuid } from "../catalog-evidence";

export interface FilterState {
  category?: string;
  category_slug?: string;
  brand?: string;
  brand_slug?: string;
  seller?: string;
  min_price?: string;
  max_price?: string;
  in_stock?: boolean;
  min_rating?: number;
  sort?: string;
}
export const sortOptions = [
  ["relevance", "Relevance"],
  ["newest", "Newest arrivals"],
  ["price_asc", "Price: Low to High"],
  ["price_desc", "Price: High to Low"],
  ["rating", "Highest rated"],
] as const;
export const pageSize = 20;
export type DiscoveryQuery = {
  query: string;
  filters: FilterState;
  page: number;
};

/** Compare decimal units exactly; input is bounded before BigInt allocation. */
export function validPriceRange(min = "", max = ""): boolean {
  if ((min && !isDecimal(min)) || (max && !isDecimal(max))) return false;
  if (!min || !max) return true;
  const places = Math.max(
    min.split(".")[1]?.length ?? 0,
    max.split(".")[1]?.length ?? 0,
  );
  const units = (value: string) => {
    const [whole, fraction = ""] = value.split(".");
    return BigInt(whole + fraction.padEnd(places, "0"));
  };
  return units(min) <= units(max);
}

export function readDiscoveryQuery(
  params: URLSearchParams,
  categoryId?: string,
): DiscoveryQuery {
  const allowed = new Set([
    "q",
    "category",
    "category_slug",
    "brand",
    "brand_slug",
    "seller",
    "min_price",
    "max_price",
    "in_stock",
    "min_rating",
    "sort",
    "page",
    "limit",
  ]);
  for (const key of params.keys()) {
    if (!allowed.has(key) || params.getAll(key).length !== 1)
      throw new Error(
        "This address contains unsupported or repeated filters. Reset the filters to continue.",
      );
  }
  const filters: FilterState = {};
  for (const key of ["category", "brand", "seller"] as const) {
    const value = params.get(key);
    if (value) {
      if (!isUuid(value))
        throw new Error(
          "A category, brand or shop filter is invalid. Reset the filters to continue.",
        );
      filters[key] = value.toLowerCase();
    }
  }
  for (const key of ["category_slug", "brand_slug"] as const) {
    const value = params.get(key);
    if (value) {
      if (!/^[a-zA-Z0-9_-]{1,200}$/.test(value))
        throw new Error("A category or brand filter is invalid.");
      filters[key] = value;
    }
  }
  if (categoryId) {
    if (!isUuid(categoryId))
      throw new Error("This category address is invalid.");
    categoryId = categoryId.toLowerCase();
    if (
      (filters.category && filters.category !== categoryId) ||
      filters.category_slug
    )
      throw new Error("This address contains a conflicting category filter.");
    filters.category = categoryId;
  }
  for (const key of ["min_price", "max_price"] as const) {
    const value = params.get(key);
    if (value) filters[key] = value;
  }
  if (!validPriceRange(filters.min_price, filters.max_price))
    throw new Error(
      "Enter nonnegative prices with the maximum at least the minimum.",
    );
  const stock = params.get("in_stock");
  if (
    stock &&
    !["true", "1", "yes", "false", "0", "no"].includes(stock.toLowerCase())
  )
    throw new Error("The availability filter is invalid.");
  filters.in_stock = stock
    ? ["true", "1", "yes"].includes(stock.toLowerCase()) || undefined
    : undefined;
  const rating = params.get("min_rating");
  if (rating) {
    if (!/^(?:[0-4](?:\.\d+)?|5(?:\.0+)?)$/.test(rating))
      throw new Error("The minimum rating must be between 0 and 5.");
    filters.min_rating = Number(rating);
  }
  const sort = params.get("sort") || (categoryId ? "newest" : "relevance");
  if (!sortOptions.some(([value]) => value === sort))
    throw new Error("This sorting option is unavailable.");
  filters.sort = sort;
  const page = params.get("page") || "1";
  if (!/^[1-9]\d{0,9}$/.test(page) || !Number.isSafeInteger(Number(page)))
    throw new Error("This page number is invalid.");
  if (params.get("limit") && params.get("limit") !== String(pageSize))
    throw new Error(
      "This page size is unavailable. Reset the filters to continue.",
    );
  // Match Django's printable, trimmed, 100-code-point query rather than inventing a new search language.
  const query = [
    ...(params.get("q") || "")
      .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
      .trim(),
  ]
    .slice(0, 100)
    .join("");
  return { query, filters, page: Number(page) };
}

export function discoveryHref(
  query: DiscoveryQuery,
  categoryId?: string,
): string {
  const params = new URLSearchParams();
  if (query.query) params.set("q", query.query);
  for (const key of [
    "category",
    "category_slug",
    "brand",
    "brand_slug",
    "seller",
    "min_price",
    "max_price",
  ] as const)
    if (query.filters[key] && !(categoryId && key === "category"))
      params.set(key, query.filters[key]!);
  if (query.filters.in_stock) params.set("in_stock", "true");
  if (query.filters.min_rating !== undefined && query.filters.min_rating > 0)
    params.set("min_rating", String(query.filters.min_rating));
  if (
    query.filters.sort &&
    query.filters.sort !== (categoryId ? "newest" : "relevance")
  )
    params.set("sort", query.filters.sort);
  if (query.page > 1) params.set("page", String(query.page));
  const base = categoryId
    ? `/categories/${encodeURIComponent(categoryId)}`
    : "/search";
  return `${base}${params.size ? `?${params}` : ""}`;
}

export function filterChips(
  filters: FilterState,
  facets: StorefrontSearchFacets | null,
  categoryId?: string,
) {
  const chips: { label: string; clear: FilterState }[] = [];
  if (!categoryId && (filters.category || filters.category_slug))
    chips.push({
      label: `Category: ${facets?.categories.find((c) => c.id === filters.category)?.name || filters.category_slug || "Selected"}`,
      clear: { ...filters, category: undefined, category_slug: undefined },
    });
  if (filters.brand || filters.brand_slug)
    chips.push({
      label: `Brand: ${facets?.brands.find((b) => b.id === filters.brand)?.name || filters.brand_slug || "Selected"}`,
      clear: { ...filters, brand: undefined, brand_slug: undefined },
    });
  if (filters.seller)
    chips.push({
      label: "Shop: Selected",
      clear: { ...filters, seller: undefined },
    });
  if (filters.min_price || filters.max_price)
    chips.push({
      label: `Price: ${filters.min_price || "0"}${filters.max_price ? ` to ${filters.max_price}` : " and above"}`,
      clear: { ...filters, min_price: undefined, max_price: undefined },
    });
  if (filters.min_rating !== undefined && filters.min_rating > 0)
    chips.push({
      label: `${filters.min_rating} stars & above`,
      clear: { ...filters, min_rating: undefined },
    });
  if (filters.in_stock)
    chips.push({
      label: "In Stock Only",
      clear: { ...filters, in_stock: undefined },
    });
  return chips;
}
