"use client";

import { StorefrontHeader } from "../header";
import { StorefrontFooter } from "../footer";
import {
  HomeArrivals,
  HomeCategories,
  HomeEditorial,
  HomeHero,
  HomeShops,
  HomeValues,
} from "./sections";
import { useHomeCatalog } from "./use-home-catalog";

export function HomeStorefront() {
  const discovery = useHomeCatalog();
  return (
    <div className="sf-storefront sf-home flex min-h-screen flex-col">
      <StorefrontHeader />
      <main id="storefront-content" tabIndex={-1} className="flex-1">
        <HomeHero catalog={discovery.catalog} />
        <HomeCategories
          categories={discovery.categories}
          retryCategories={discovery.retryCategories}
        />
        <HomeArrivals
          catalog={discovery.catalog}
          retryCatalog={discovery.retryCatalog}
        />
        <HomeShops catalog={discovery.catalog} />
        <HomeEditorial />
        <HomeValues />
      </main>
      <StorefrontFooter />
    </div>
  );
}
