"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { hasPlatformPermission } from "@/lib/permissions";
import { useAuth } from "@/features/auth/auth-provider";
import { AccountMenu } from "@/features/auth/account-menu";

export type WorkspaceMode = "seller" | "admin" | "account" | "workspaces";
const names = {
  seller: "Seller workspace",
  admin: "Platform workspace",
  account: "My account",
  workspaces: "Workspaces",
};

export function WorkspaceFrame({
  mode,
  children,
  sellerPicker,
  sellerCanReadSettings = false,
  sellerCanReadProducts = false,
  sellerCanReadInventory = false,
  sellerCanReadOrders = false,
  sellerCanReadFinance = false,
}: {
  mode: WorkspaceMode;
  children: ReactNode;
  sellerPicker?: ReactNode;
  sellerCanReadSettings?: boolean;
  sellerCanReadProducts?: boolean;
  sellerCanReadInventory?: boolean;
  sellerCanReadOrders?: boolean;
  sellerCanReadFinance?: boolean;
}) {
  const pathname = usePathname();
  const { state } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const user = state.kind === "authenticated" ? state.user : null;
  const links = [{ href: `/${mode}`, label: "Overview" }];
  if (mode === "seller" && sellerCanReadOrders)
    links.push({ href: "/seller/orders", label: "Orders" });
  if (mode === "seller" && sellerCanReadProducts)
    links.push({ href: "/seller/products", label: "Products" });
  if (mode === "seller" && sellerCanReadInventory) {
    links.push({ href: "/seller/inventory", label: "Inventory" });
    links.push({ href: "/seller/warehouses", label: "Warehouses" });
  }
  if (mode === "seller" && sellerCanReadFinance)
    links.push({ href: "/seller/finance", label: "Finance" });
  if (mode === "seller" && sellerCanReadSettings)
    links.push({ href: "/seller/settings", label: "Seller settings" });
  if (mode === "admin" && hasPlatformPermission(user, "platform.orders.read"))
    links.push({ href: "/admin/orders", label: "Orders" });
  if (mode === "admin" && hasPlatformPermission(user, "platform.sellers.read"))
    links.push({ href: "/admin/sellers", label: "Sellers" });
  if (mode === "admin" && hasPlatformPermission(user, "platform.finance.read"))
    links.push({ href: "/admin/finance", label: "Finance" });
  if (mode === "admin" && hasPlatformPermission(user, "platform.products.read"))
    links.push({ href: "/admin/products", label: "Moderation queue" });
  if (
    mode === "admin" &&
    hasPlatformPermission(user, "platform.inventory.read")
  )
    links.push({ href: "/admin/inventory", label: "Inventory" });
  if (
    mode === "admin" &&
    hasPlatformPermission(user, "platform.catalog.read")
  ) {
    links.push({ href: "/admin/categories", label: "Categories" });
    links.push({ href: "/admin/attributes", label: "Attributes" });
    links.push({ href: "/admin/brands", label: "Brands" });
  }
  if (mode !== "workspaces")
    links.push({ href: "/workspaces", label: "Workspaces" });
  if (mode !== "account") links.push({ href: "/account", label: "My account" });
  if (mode !== "admin" && hasPlatformPermission(user, "platform.access"))
    links.push({ href: "/admin", label: "Platform workspace" });
  return (
    <div className="min-h-screen">
      <a
        href="#workspace-content"
        className="sr-only fixed top-2 left-2 z-50 rounded bg-teal-900 p-3 text-white focus:not-sr-only"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-10 flex h-18 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-7">
        <Link
          href="/workspaces"
          className="flex items-center gap-3 text-lg font-semibold tracking-tight"
        >
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-800 text-white"
          >
            Q
          </span>
          <span>Quick Commerce</span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="min-h-11 rounded-lg px-3 text-sm md:hidden"
            aria-expanded={menuOpen}
            aria-controls="workspace-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            Menu
          </button>
          <AccountMenu />
        </div>
      </header>
      <div className="mx-auto flex max-w-[1600px] flex-col md:flex-row">
        <aside
          className={`${menuOpen ? "block" : "hidden"} border-b border-slate-200 bg-white px-4 py-7 md:block md:min-h-[calc(100vh-4.5rem)] md:w-60 md:shrink-0 md:border-r md:border-b-0`}
        >
          <p className="px-3 text-xs font-semibold tracking-wider text-slate-500 uppercase">
            {names[mode]}
          </p>
          <nav
            id="workspace-navigation"
            aria-label="Workspace navigation"
            className="mt-4"
          >
            <ul className="space-y-1">
              {links.map((link) => {
                const current = pathname === link.href;
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={current ? "page" : undefined}
                      onClick={() => setMenuOpen(false)}
                      className={`flex min-h-11 items-center rounded-lg px-3 text-sm font-medium ${current ? "bg-teal-50 text-teal-900" : "text-slate-700 hover:bg-slate-50"}`}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          {sellerPicker && (
            <div className="mt-7 border-t border-slate-100 pt-6">
              {sellerPicker}
            </div>
          )}
        </aside>
        <main
          id="workspace-content"
          tabIndex={-1}
          className="min-w-0 flex-1 px-5 py-7 sm:px-9 sm:py-9"
        >
          <nav aria-label="Breadcrumb" className="mb-6 text-xs text-slate-500">
            <ol className="flex items-center gap-2">
              <li>
                <Link href="/workspaces" className="hover:text-slate-900">
                  Workspaces
                </Link>
              </li>
              {mode !== "workspaces" && (
                <>
                  <li aria-hidden="true">/</li>
                  <li aria-current="page">{names[mode]}</li>
                </>
              )}
            </ol>
          </nav>
          {children}
        </main>
      </div>
    </div>
  );
}
