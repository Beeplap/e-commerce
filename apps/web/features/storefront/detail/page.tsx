"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, storefrontApi } from "@/lib/api/client";
import { useAuth } from "@/features/auth/auth-provider";
import type { StorefrontProductDetail } from "@/lib/api/types";
import { StorefrontButton } from "@/components/storefront/controls";
import { StorefrontSkeleton } from "@/components/storefront/content";
import { StorefrontHeader } from "../header";
import { StorefrontFooter } from "../footer";
import { ProductDetailView } from "../product-detail-view";
import { isUuid } from "../catalog-evidence";
import { detailEvidence } from "./evidence";

type Read =
  | { kind: "loading" }
  | { kind: "ready"; product: StorefrontProductDetail }
  | { kind: "error"; missing: boolean };

function ProductRead({ id }: { id: string }) {
  const [read, setRead] = useState<Read>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!isUuid(id)) return;
    const controller = new AbortController();
    storefrontApi
      .productDetail(id.toLowerCase(), controller.signal)
      .then((value) => detailEvidence(value, id))
      .then((product) => {
        if (!controller.signal.aborted) setRead({ kind: "ready", product });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setRead({
            kind: "error",
            missing: error instanceof ApiError && error.status === 404,
          });
      });
    return () => controller.abort();
  }, [id, attempt]);
  if (isUuid(id) && read.kind === "ready")
    return <ProductDetailView key={id} product={read.product} />;
  if (isUuid(id) && read.kind === "loading")
    return (
      <div className="sf-pdp-container sf-pdp-loading" aria-busy="true">
        <p role="status">Loading product…</p>
        <div className="sf-pdp-main" aria-hidden="true">
          <StorefrontSkeleton className="sf-pdp-loading-image" />
          <div className="sf-pdp-loading-info">
            <StorefrontSkeleton />
            <StorefrontSkeleton className="h-16" />
            <StorefrontSkeleton className="h-10 w-1/2" />
            <StorefrontSkeleton className="h-28" />
            <StorefrontSkeleton className="h-12" />
          </div>
        </div>
      </div>
    );
  const missing = !isUuid(id) || (read.kind === "error" && read.missing);
  return (
    <div className="sf-pdp-container sf-pdp-recovery">
      <p className="sf-pdp-eyebrow">QuickCommerce / Product</p>
      <h1>
        {missing ? "Product unavailable" : "We couldn’t load this product"}
      </h1>
      <p>
        {missing
          ? "This product may no longer be listed. There’s more to explore in the shop."
          : "Product details are temporarily unavailable. Try again before choosing an option."}
      </p>
      <div className="sf-pdp-recovery-actions">
        {!missing && (
          <StorefrontButton
            onClick={() => {
              setRead({ kind: "loading" });
              setAttempt((value) => value + 1);
            }}
          >
            Try again
          </StorefrontButton>
        )}
        <Link href="/search" className="sf-pdp-text-link">
          Browse the shop <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </div>
  );
}

export function ProductDetailPage({ id }: { id: string }) {
  const { state } = useAuth();
  const identity = state.kind === "authenticated" ? state.user.id : state.kind;
  return (
    <div className="sf-storefront sf-pdp flex min-h-screen flex-col">
      <StorefrontHeader />
      <main id="storefront-content" tabIndex={-1} className="flex-1">
        <ProductRead key={`${id}:${identity}`} id={id} />
      </main>
      <StorefrontFooter />
    </div>
  );
}
