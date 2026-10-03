"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { StorefrontHeader } from "@/features/storefront/header";
import { StorefrontFooter } from "@/features/storefront/footer";
import { ProductDetailView } from "@/features/storefront/product-detail-view";
import { storefrontApi } from "@/lib/api/client";
import type { StorefrontProductDetail } from "@/lib/api/types";

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export default function ProductDetailPage({ params }: ProductPageProps) {
  const { id } = use(params);
  const [product, setProduct] = useState<StorefrontProductDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const controller = new AbortController();
    storefrontApi
      .productDetail(id, controller.signal)
      .then((data) => {
        setProduct(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error
            ? err.message
            : "Product not found or unavailable.",
        );
        setLoading(false);
      });
    return () => controller.abort();
  }, [id]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <StorefrontHeader />

      <main className="flex-1">
        {loading ? (
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
              <div className="aspect-square rounded-2xl bg-slate-200 animate-pulse" />
              <div className="space-y-4">
                <div className="h-6 w-1/4 rounded bg-slate-200 animate-pulse" />
                <div className="h-10 w-3/4 rounded bg-slate-200 animate-pulse" />
                <div className="h-8 w-1/3 rounded bg-slate-200 animate-pulse" />
                <div className="h-32 rounded bg-slate-200 animate-pulse" />
              </div>
            </div>
          </div>
        ) : error || !product ? (
          <div className="mx-auto max-w-2xl px-4 py-24 text-center">
            <h1 className="text-2xl font-bold text-slate-900">
              Product Unavailable
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {error ||
                "This item is currently not active or no longer exists."}
            </p>
            <div className="mt-6">
              <Link
                href="/"
                className="rounded-lg bg-teal-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-900 transition"
              >
                Return to Storefront
              </Link>
            </div>
          </div>
        ) : (
          <ProductDetailView product={product} />
        )}
      </main>

      <StorefrontFooter />
    </div>
  );
}
