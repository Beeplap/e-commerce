import type { StorefrontProductCard } from "@/lib/api/types";
import {
  categoryEvidence,
  isCount,
  isRecord,
  productEvidence,
} from "../catalog-evidence";

export const homeCategories = (value: unknown) => categoryEvidence(value, 24);
export type HomeCatalog = { count: number; products: StorefrontProductCard[] };
export function homeProducts(value: unknown): HomeCatalog {
  if (
    !isRecord(value) ||
    !isCount(value.count) ||
    !Array.isArray(value.results) ||
    value.count < value.results.length ||
    (value.count > 0 && value.results.length === 0)
  )
    throw new Error("Invalid catalog evidence");
  return { count: value.count, products: productEvidence(value.results, 25) };
}

export function homeSellers(products: StorefrontProductCard[]) {
  const stores = new Map<
    string,
    { seller: StorefrontProductCard["seller"]; categories: Set<string> }
  >();
  for (const product of products) {
    const store = stores.get(product.seller.id) ?? {
      seller: product.seller,
      categories: new Set<string>(),
    };
    store.categories.add(product.category_name);
    stores.set(product.seller.id, store);
  }
  return [...stores.values()].slice(0, 4);
}
