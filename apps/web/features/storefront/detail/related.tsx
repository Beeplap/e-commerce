"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { storefrontApi } from "@/lib/api/client";
import type { StorefrontProductCard } from "@/lib/api/types";
import {
  StorefrontImage,
  StorefrontPrice,
  StorefrontSeller,
  StorefrontSkeleton,
} from "@/components/storefront/content";
import { StorefrontButton } from "@/components/storefront/controls";
import { isCount, isRecord, productEvidence } from "../catalog-evidence";

type Read =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; products: StorefrontProductCard[] };
export function RelatedProducts({
  categoryId,
  categoryName,
  productId,
}: {
  categoryId: string;
  categoryName: string;
  productId: string;
}) {
  const [read, setRead] = useState<Read>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    storefrontApi
      .products({ category: categoryId, sort: "newest" }, controller.signal)
      .then((value) => {
        if (!isRecord(value) || !isCount(value.count))
          throw new Error("Invalid related products");
        const products = productEvidence(value.results, 25);
        if (
          products.length > value.count ||
          products.some(
            (product) =>
              product.category_id.toLowerCase() !== categoryId.toLowerCase(),
          )
        )
          throw new Error("Invalid related products");
        return products
          .filter(
            (product) => product.id.toLowerCase() !== productId.toLowerCase(),
          )
          .slice(0, 4);
      })
      .then((products) => {
        if (!controller.signal.aborted) setRead({ kind: "ready", products });
      })
      .catch(() => {
        if (!controller.signal.aborted) setRead({ kind: "error" });
      });
    return () => controller.abort();
  }, [categoryId, productId, attempt]);
  return (
    <section className="sf-pdp-related" aria-labelledby="product-related-title">
      <div className="sf-pdp-section-heading">
        <div>
          <p className="sf-pdp-eyebrow">Keep exploring</p>
          <h2 id="product-related-title">More in {categoryName}</h2>
        </div>
        <Link className="sf-pdp-text-link" href={`/categories/${categoryId}`}>
          Explore category <span aria-hidden="true">↗</span>
        </Link>
      </div>
      {read.kind === "loading" && (
        <>
          <p role="status">Loading related products…</p>
          <div className="sf-pdp-related-grid" aria-hidden="true">
            {[0, 1, 2, 3].map((index) => (
              <StorefrontSkeleton key={index} className="aspect-square" />
            ))}
          </div>
        </>
      )}
      {read.kind === "error" && (
        <div className="sf-pdp-local-error" role="alert">
          <p>Related products couldn’t be loaded.</p>
          <StorefrontButton
            variant="secondary"
            onClick={() => {
              setRead({ kind: "loading" });
              setAttempt((value) => value + 1);
            }}
          >
            Retry related products
          </StorefrontButton>
        </div>
      )}
      {read.kind === "ready" &&
        (read.products.length ? (
          <div className="sf-pdp-related-grid">
            {read.products.map((product) => (
              <article key={product.id}>
                <Link
                  href={`/products/${product.id}`}
                  aria-label={`View ${product.title}`}
                >
                  <StorefrontImage
                    src={product.thumbnail_url}
                    alt={product.title}
                  />
                </Link>
                <h3>
                  <Link href={`/products/${product.id}`}>{product.title}</Link>
                </h3>
                <StorefrontSeller
                  id={product.seller.id}
                  name={product.seller.store_name}
                />
                <StorefrontPrice
                  amount={product.starting_price}
                  currency={product.currency}
                  compareAt={product.compare_at_price}
                />
              </article>
            ))}
          </div>
        ) : (
          <p className="sf-pdp-caption">
            There are no other products to show in this category right now.
          </p>
        ))}
    </section>
  );
}
