"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { storefrontApi } from "@/lib/api/client";
import type { StorefrontCategory } from "@/lib/api/types";
import { useAuth } from "@/features/auth/auth-provider";

export function StorefrontHeader() {
  const router = useRouter();
  const { state } = useAuth();
  const user = state.kind === "authenticated" ? state.user : null;
  const [categories, setCategories] = useState<StorefrontCategory[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    storefrontApi
      .categories(controller.signal)
      .then((data) => setCategories(data))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      {/* Top Banner / Announcement */}
      <div className="bg-slate-900 px-4 py-1.5 text-center text-xs font-medium text-slate-200">
        <span>
          Fast, reliable marketplace delivery from verified sellers. Free
          shipping on select items.
        </span>
      </div>

      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        {/* Logo */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-700 font-bold text-white shadow-sm">
              QC
            </span>
            <span className="text-xl font-bold tracking-tight text-slate-900">
              Quick<span className="text-teal-700">Commerce</span>
            </span>
          </Link>

          {/* Desktop Categories Quick Nav */}
          <nav className="hidden lg:flex items-center gap-4 text-sm font-medium text-slate-600">
            {categories.slice(0, 5).map((cat) => (
              <Link
                key={cat.id}
                href={`/categories/${cat.id}`}
                className="transition hover:text-teal-700"
              >
                {cat.name}
              </Link>
            ))}
          </nav>
        </div>

        {/* Search Bar */}
        <form
          onSubmit={handleSearchSubmit}
          className="flex-1 max-w-lg hidden sm:block"
        >
          <div className="relative">
            <input
              type="search"
              placeholder="Search products, brands, sellers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-full border border-slate-300 bg-slate-50 px-4 py-2 pl-10 text-sm text-slate-900 transition focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-600"
            />
            <svg
              className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </form>

        {/* Actions (Cart, Account, Workspaces) */}
        <div className="flex items-center gap-3">
          {/* Cart Icon */}
          <Link
            href="/cart"
            aria-label="Shopping Cart"
            className="relative flex items-center justify-center rounded-lg p-2 text-slate-700 transition hover:bg-slate-100 hover:text-teal-700"
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
              className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-teal-600 px-1 text-[10px] font-bold text-white"
            >
              0
            </span>
          </Link>

          {/* User Account / Workspaces */}
          {user ? (
            <div className="flex items-center gap-2">
              <Link
                href="/workspaces"
                className="hidden md:inline-flex items-center rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Workspaces
              </Link>
              <Link
                href="/account"
                className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 transition"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
                  {user.email.slice(0, 2).toUpperCase()}
                </div>
              </Link>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-900"
            >
              Sign In
            </Link>
          )}

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex items-center justify-center rounded-lg p-2 text-slate-700 lg:hidden hover:bg-slate-100"
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
        <div className="border-t border-slate-200 bg-white px-4 py-3 lg:hidden">
          <form onSubmit={handleSearchSubmit} className="mb-3 sm:hidden">
            <input
              type="search"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </form>
          <div className="space-y-1">
            <p className="px-2 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Categories
            </p>
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/categories/${cat.id}`}
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-md px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
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
