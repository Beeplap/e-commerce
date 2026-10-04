"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { storefrontApi } from "@/lib/api/client";
import type { StorefrontCategory } from "@/lib/api/types";
import { useAuth } from "@/features/auth/auth-provider";
import { useCart } from "@/features/cart/cart-context";
import { SearchBar } from "./search-bar";

export function StorefrontHeader() {
  const { state } = useAuth();
  const { cart, openCart } = useCart();
  const user = state.kind === "authenticated" ? state.user : null;
  const cartItemCount = cart?.total_items || 0;
  const [categories, setCategories] = useState<StorefrontCategory[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    storefrontApi
      .categories(controller.signal)
      .then((data) => {
        if (Array.isArray(data)) setCategories(data);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-sf-border bg-sf-surface/95 backdrop-blur-sm">
      {/* Top Banner / Announcement */}
      <div className="bg-sf-dark px-4 py-1.5 text-center text-xs font-medium text-sf-on-dark">
        <span>
          Fast, reliable marketplace delivery from verified sellers. Free
          shipping on select items.
        </span>
      </div>

      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        {/* Logo */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-sf-control bg-sf-action font-bold text-sf-on-dark shadow-sf-small">
              QC
            </span>
            <span className="text-xl font-bold tracking-tight text-sf-foreground">
              Quick<span className="text-sf-link">Commerce</span>
            </span>
          </Link>

          {/* Desktop Categories Quick Nav */}
          <nav className="hidden lg:flex items-center gap-4 text-sm font-medium text-sf-soft">
            {categories.slice(0, 5).map((cat) => (
              <Link
                key={cat.id}
                href={`/categories/${cat.id}`}
                className="transition hover:text-sf-link"
              >
                {cat.name}
              </Link>
            ))}
          </nav>
        </div>

        {/* Search Bar with Autocomplete */}
        <SearchBar className="flex-1 max-w-lg hidden sm:block" />

        {/* Actions (Cart, Account, Workspaces) */}
        <div className="flex items-center gap-3">
          {/* Cart Icon / Drawer Toggle */}
          <button
            type="button"
            onClick={openCart}
            aria-label="Shopping Cart"
            className="relative flex items-center justify-center rounded-sf-control p-2 text-sf-soft transition hover:bg-sf-surface-strong hover:text-sf-link"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
            <span
              id="cart-badge"
              data-testid="cart-badge"
              className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-sf-action px-1 text-[10px] font-bold text-sf-on-dark"
            >
              {cartItemCount}
            </span>
          </button>

          {/* User Account / Workspaces */}
          {user ? (
            <div className="flex items-center gap-2">
              <Link
                href="/workspaces"
                className="hidden md:inline-flex items-center rounded-md border border-sf-control px-3 py-1.5 text-xs font-semibold text-sf-soft hover:bg-sf-background transition"
              >
                Workspaces
              </Link>
              <Link
                href="/account"
                className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-sf-soft hover:bg-sf-surface-strong transition"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sf-border text-xs font-bold text-sf-soft">
                  {user.email.slice(0, 2).toUpperCase()}
                </div>
              </Link>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-sf-control bg-sf-action px-4 py-2 text-sm font-semibold text-sf-on-dark transition hover:bg-sf-action-hover"
            >
              Sign In
            </Link>
          )}

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex items-center justify-center rounded-sf-control p-2 text-sf-soft lg:hidden hover:bg-sf-surface-strong"
            aria-label="Toggle menu"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={
                  mobileMenuOpen
                    ? "M6 18L18 6M6 6l12 12"
                    : "M4 6h16M4 12h16M4 18h16"
                }
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="border-t border-sf-border bg-sf-surface px-4 py-3 lg:hidden">
          <SearchBar className="mb-3 sm:hidden" />
          <div className="space-y-1">
            <p className="px-2 py-1 text-xs font-semibold text-sf-muted uppercase tracking-wider">
              Categories
            </p>
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/categories/${cat.id}`}
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-md px-2 py-1.5 text-sm font-medium text-sf-soft hover:bg-sf-surface-strong"
              >
                {cat.name} ({cat.product_count})
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
