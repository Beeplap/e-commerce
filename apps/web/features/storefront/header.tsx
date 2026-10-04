"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { StorefrontButton } from "@/components/storefront/controls";
import { StorefrontOverlay } from "@/components/storefront/feedback";
import { useAuth } from "@/features/auth/auth-provider";
import { useCart } from "@/features/cart/cart-context";
import { StorefrontBrand } from "./brand";
import { useNavigationData } from "./navigation-data";
import { SearchBar } from "./search-bar";
import { ShellIcon } from "./shell-icons";

function DiscoveryLinks({
  state,
  type,
  retry,
  onNavigate,
}: {
  state: ReturnType<typeof useNavigationData>["categories"];
  type: "categories" | "sellers";
  retry: () => void;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  if (state.kind === "loading")
    return (
      <p role="status" className="sf-discovery-status">
        Loading {type}…
      </p>
    );
  if (state.kind === "error")
    return (
      <div className="sf-discovery-status" role="status">
        <p>We couldn’t load {type}.</p>
        <StorefrontButton variant="quiet" onClick={retry}>
          Try again
        </StorefrontButton>
      </div>
    );
  if (!state.items.length)
    return (
      <p className="sf-discovery-status">
        {type === "categories"
          ? "No categories are available yet."
          : "No seller stores in the latest arrivals yet."}
      </p>
    );
  return (
    <ul className="sf-discovery-links">
      {state.items.map((item) => (
        <li key={item.id}>
          <Link
            href={item.href}
            aria-current={pathname === item.href ? "page" : undefined}
            onClick={onNavigate}
          >
            {item.name}
            <ShellIcon name="arrow" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function HeaderShell({
  state,
}: {
  state: ReturnType<typeof useAuth>["state"];
}) {
  const pathname = usePathname();
  const user = state.kind === "authenticated" ? state.user : null;
  const { cart, openCart } = useCart();
  const count = cart?.total_items;
  const countDescription =
    count === undefined
      ? "Item count unavailable"
      : `${count} ${count === 1 ? "item" : "items"}`;
  const identity = useId();
  const navRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const focusBrandAfterResize = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [panel, setPanel] = useState<"categories" | "sellers" | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sellersEnabled, setSellersEnabled] = useState(false);
  const [mobileSellers, setMobileSellers] = useState(false);
  const navigation = useNavigationData(sellersEnabled);

  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !navRef.current?.contains(event.target)
      )
        setPanel(null);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  useEffect(() => {
    if (!window.matchMedia) return;
    const media = window.matchMedia("(min-width: 1100px)");
    const resize = () => {
      if (media.matches && drawerOpen) {
        focusBrandAfterResize.current = true;
        setDrawerOpen(false);
      }
    };
    media.addEventListener("change", resize);
    return () => {
      media.removeEventListener("change", resize);
    };
  }, [drawerOpen]);
  useEffect(() => {
    if (!drawerOpen && focusBrandAfterResize.current) {
      focusBrandAfterResize.current = false;
      headerRef.current?.querySelector<HTMLAnchorElement>(".sf-brand")?.focus();
    }
  }, [drawerOpen]);

  const closeNavigation = () => {
    setPanel(null);
    setDrawerOpen(false);
  };
  const accountHref = user ? "/account" : "/login";
  const accountLabel = user ? "Your account" : "Sign in to your account";
  return (
    <header ref={headerRef} className="sf-header">
      <a className="sf-skip-link" href="#storefront-content">
        Skip to content
      </a>
      <div className="sf-announcement sf-inverse">
        Independent sellers. One marketplace.
      </div>
      <div className="sf-header-inner">
        <StorefrontBrand />
        <nav
          ref={navRef}
          className="sf-desktop-nav"
          aria-label="Main navigation"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              setPanel(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && panel) {
              event.preventDefault();
              navRef.current
                ?.querySelector<HTMLButtonElement>('[aria-expanded="true"]')
                ?.focus();
              setPanel(null);
            }
          }}
        >
          <Link
            href="/search"
            aria-current={
              pathname === "/search" || pathname.startsWith("/products/")
                ? "location"
                : undefined
            }
          >
            Shop
          </Link>
          {(["categories", "sellers"] as const).map((type) => (
            <div className="sf-nav-disclosure" key={type}>
              <button
                type="button"
                aria-expanded={panel === type}
                aria-current={
                  pathname.startsWith(`/${type}/`) ? "location" : undefined
                }
                aria-controls={
                  panel === type ? `${identity}-${type}` : undefined
                }
                onClick={() => {
                  setPanel((current) => (current === type ? null : type));
                  if (type === "sellers") setSellersEnabled(true);
                }}
              >
                {type === "categories" ? "Categories" : "Sellers"}
                <ShellIcon name="chevron" />
              </button>
              {panel === type && (
                <div className="sf-nav-panel" id={`${identity}-${type}`}>
                  <p className="sf-nav-panel-heading">
                    {type === "categories"
                      ? "Explore by category"
                      : "Meet the sellers"}
                  </p>
                  {type === "sellers" && (
                    <p className="sf-nav-panel-note">
                      Stores from the latest catalog arrivals.
                    </p>
                  )}
                  <DiscoveryLinks
                    state={navigation[type]}
                    type={type}
                    retry={
                      type === "categories"
                        ? navigation.retryCategories
                        : navigation.retrySellers
                    }
                    onNavigate={closeNavigation}
                  />
                  <Link
                    className="sf-nav-panel-all"
                    href="/search"
                    onClick={closeNavigation}
                  >
                    Explore all products <ShellIcon name="arrow" />
                  </Link>
                </div>
              )}
            </div>
          ))}
          <Link href="/search?sort=newest">New arrivals</Link>
        </nav>
        <SearchBar className="sf-header-search" onNavigate={closeNavigation} />
        <div className="sf-header-actions">
          <Link
            className="sf-header-action"
            href={accountHref}
            aria-label={accountLabel}
            aria-current={
              pathname === "/account" || pathname.startsWith("/account/")
                ? "location"
                : undefined
            }
          >
            <ShellIcon name="account" />
            <span className="sf-action-word">
              {user ? "Account" : "Sign In"}
            </span>
          </Link>
          <button
            type="button"
            className="sf-header-action sf-cart-action"
            onClick={openCart}
            aria-label="Shopping Cart"
            aria-describedby={`${identity}-cart-count`}
          >
            <ShellIcon name="cart" />
            <span
              data-testid="cart-badge"
              className="sf-cart-count"
              aria-hidden="true"
            >
              {count === undefined ? "—" : count > 99 ? "99+" : count}
            </span>
            <span id={`${identity}-cart-count`} className="sr-only">
              {countDescription}
            </span>
          </button>
          <button
            type="button"
            className="sf-header-action sf-mobile-trigger"
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
            aria-haspopup="dialog"
            onClick={() => setDrawerOpen(true)}
          >
            <ShellIcon name="menu" />
          </button>
        </div>
      </div>
      {drawerOpen && (
        <StorefrontOverlay
          kind="drawer"
          open
          title="Explore QuickCommerce"
          initialFocus={searchRef}
          onClose={() => setDrawerOpen(false)}
        >
          <div
            className="sf-mobile-navigation"
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;
              // Autocomplete consumes its first Escape. The next closes navigation,
              // before the native search input can consume it to clear its value.
              if (event.key === "Escape" && !event.defaultPrevented) {
                event.preventDefault();
                setDrawerOpen(false);
              }
            }}
          >
            <SearchBar inputRef={searchRef} onNavigate={closeNavigation} />
            <nav aria-label="Mobile navigation">
              <Link
                className="sf-mobile-primary"
                href="/search"
                aria-current={
                  pathname === "/search" || pathname.startsWith("/products/")
                    ? "location"
                    : undefined
                }
                onClick={closeNavigation}
              >
                Shop all products
                <ShellIcon name="arrow" />
              </Link>
              <Link
                className="sf-mobile-primary"
                href="/search?sort=newest"
                onClick={closeNavigation}
              >
                New arrivals
                <ShellIcon name="arrow" />
              </Link>
              <section className="sf-mobile-section" aria-label="Categories">
                <h3>Categories</h3>
                <DiscoveryLinks
                  state={navigation.categories}
                  type="categories"
                  retry={navigation.retryCategories}
                  onNavigate={closeNavigation}
                />
              </section>
              <section className="sf-mobile-section" aria-label="Sellers">
                <button
                  type="button"
                  className="sf-mobile-primary"
                  aria-expanded={mobileSellers}
                  aria-current={
                    pathname.startsWith("/sellers/") ? "location" : undefined
                  }
                  aria-controls={
                    mobileSellers ? `${identity}-mobile-sellers` : undefined
                  }
                  onClick={() => {
                    setMobileSellers((value) => !value);
                    setSellersEnabled(true);
                  }}
                >
                  Sellers
                  <ShellIcon name="chevron" />
                </button>
                {mobileSellers && (
                  <div id={`${identity}-mobile-sellers`}>
                    <p className="sf-nav-panel-note">
                      Stores from the latest catalog arrivals.
                    </p>
                    <DiscoveryLinks
                      state={navigation.sellers}
                      type="sellers"
                      retry={navigation.retrySellers}
                      onNavigate={closeNavigation}
                    />
                  </div>
                )}
              </section>
              <section
                className="sf-mobile-section"
                aria-label="Account and cart"
              >
                <Link
                  className="sf-mobile-primary"
                  href={accountHref}
                  onClick={closeNavigation}
                >
                  {user ? "Your account" : "Sign In"}
                  <ShellIcon name="account" />
                </Link>
                <Link
                  className="sf-mobile-primary"
                  href="/cart"
                  onClick={closeNavigation}
                >
                  Your cart
                  <span className="sf-mobile-meta">{countDescription}</span>
                </Link>
                {user && (
                  <Link
                    className="sf-mobile-secondary"
                    href="/workspaces"
                    onClick={closeNavigation}
                  >
                    Your workspaces
                  </Link>
                )}
                <Link
                  className="sf-mobile-secondary"
                  href="/onboarding"
                  onClick={closeNavigation}
                >
                  Sell with us
                </Link>
              </section>
            </nav>
          </div>
        </StorefrontOverlay>
      )}
    </header>
  );
}

export function StorefrontHeader() {
  const { state } = useAuth();
  const pathname = usePathname();
  // Remount the shell to abort/discard discovery on route or signed-in identity changes.
  return (
    <HeaderShell
      key={`${pathname}:${state.kind === "authenticated" ? state.user.id : "public"}`}
      state={state}
    />
  );
}
