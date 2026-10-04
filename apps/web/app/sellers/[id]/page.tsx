"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { StorefrontHeader } from "@/features/storefront/header";
import { StorefrontFooter } from "@/features/storefront/footer";
import { SellerStoreView } from "@/features/storefront/seller-store-view";
import { storefrontApi } from "@/lib/api/client";
import type { StorefrontSellerDetail } from "@/lib/api/types";

interface SellerPageProps {
  params: Promise<{ id: string }>;
}

export default function SellerStorePage({ params }: SellerPageProps) {
  const { id } = use(params);
  const [seller, setSeller] = useState<StorefrontSellerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const controller = new AbortController();
    storefrontApi
      .sellerDetail(id, controller.signal)
      .then((data) => {
        setSeller(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error
            ? err.message
            : "Seller store not found or unavailable.",
        );
        setLoading(false);
      });
    return () => controller.abort();
  }, [id]);

  return (
    <div className="sf-storefront flex min-h-screen flex-col bg-sf-background">
      <StorefrontHeader />

      <main className="flex-1">
        {loading ? (
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="h-44 rounded-2xl bg-sf-border motion-safe:animate-pulse" />
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-72 rounded-sf-image bg-sf-border motion-safe:animate-pulse"
                />
              ))}
            </div>
          </div>
        ) : error || !seller ? (
          <div className="mx-auto max-w-2xl px-4 py-24 text-center">
            <h1 className="text-2xl font-bold text-sf-foreground">
              Seller Store Unavailable
            </h1>
            <p className="mt-2 text-sm text-sf-muted">
              {error ||
                "This seller store is currently not active or no longer exists."}
            </p>
            <div className="mt-6">
              <Link
                href="/"
                className="rounded-sf-control bg-sf-action px-5 py-2.5 text-sm font-semibold text-sf-on-dark hover:bg-sf-action-hover transition"
              >
                Return to Storefront
              </Link>
            </div>
          </div>
        ) : (
          <SellerStoreView seller={seller} />
        )}
      </main>

      <StorefrontFooter />
    </div>
  );
}
