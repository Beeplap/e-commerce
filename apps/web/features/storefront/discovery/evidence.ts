import type { StorefrontSearchResultPage } from "@/lib/api/types";
import {
  isCount,
  isDecimal,
  isRecord,
  isText,
  isUuid,
  productEvidence,
} from "../catalog-evidence";
import { pageSize, validPriceRange } from "./query";

export function discoveryEvidence(value: unknown): StorefrontSearchResultPage {
  if (
    !isRecord(value) ||
    !isCount(value.count) ||
    !(value.next === null || typeof value.next === "string") ||
    !(value.previous === null || typeof value.previous === "string") ||
    !Array.isArray(value.results) ||
    value.count < value.results.length ||
    !isRecord(value.facets)
  )
    throw new Error("Invalid search evidence");
  productEvidence(value.results, pageSize);
  const facets = value.facets;
  for (const key of ["categories", "brands"] as const) {
    if (!Array.isArray(facets[key]) || facets[key].length > 15)
      throw new Error("Invalid search facets");
    const ids = new Set<string>();
    for (const facet of facets[key]) {
      if (
        !isRecord(facet) ||
        !isUuid(facet.id) ||
        ids.has(facet.id) ||
        !isText(facet.name) ||
        typeof facet.slug !== "string" ||
        !isCount(facet.count)
      )
        throw new Error("Invalid search facets");
      ids.add(facet.id);
    }
  }
  if (
    !isCount(facets.in_stock_count) ||
    !Array.isArray(facets.price_brackets) ||
    facets.price_brackets.length > 10 ||
    !Array.isArray(facets.rating_brackets) ||
    facets.rating_brackets.length > 5
  )
    throw new Error("Invalid search facets");
  for (const bracket of facets.price_brackets)
    if (
      !isRecord(bracket) ||
      !isText(bracket.label) ||
      !isDecimal(bracket.min_price) ||
      !(bracket.max_price === null || isDecimal(bracket.max_price)) ||
      !validPriceRange(bracket.min_price, bracket.max_price || "") ||
      !isCount(bracket.count)
    )
      throw new Error("Invalid search facets");
  for (const bracket of facets.rating_brackets)
    if (
      !isRecord(bracket) ||
      !isText(bracket.label) ||
      typeof bracket.min_rating !== "number" ||
      !Number.isFinite(bracket.min_rating) ||
      bracket.min_rating < 0 ||
      bracket.min_rating > 5 ||
      !isCount(bracket.count)
    )
      throw new Error("Invalid search facets");
  // Pagination URLs are deliberately never followed: local allowlisted state builds every destination.
  return value as unknown as StorefrontSearchResultPage;
}
