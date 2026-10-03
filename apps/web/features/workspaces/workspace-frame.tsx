"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { PageShell } from "@/components/ui/layout";
import { useAuth } from "@/features/auth/auth-provider";
import { AccountMenu } from "@/features/auth/account-menu";
import {
  activeNavigationLink,
  workspaceBreadcrumbs,
  workspaceNavigation,
  workspaceNames,
  type NavigationGroup,
  type SellerNavigationAccess,
  type WorkspaceMode,
} from "./navigation";

export type { WorkspaceMode } from "./navigation";

function WorkspaceNavigation({
  groups,
  pathname,
  onNavigate,
  mobile = false,
}: {
  groups: NavigationGroup[];
  pathname: string;
  onNavigate?: () => void;
  mobile?: boolean;
}) {
  const active = activeNavigationLink(pathname, groups);
  return (
    <nav
      aria-label={
        mobile ? "Mobile workspace navigation" : "Workspace navigation"
      }
      className="space-y-5"
    >
      {groups.map((group) => (
        <div key={group.label}>
          {group.label !== "Overview" && (
            <p className="mb-1 px-3 text-ui-caption font-medium text-ui-muted">
              {group.label}
            </p>
          )}
          <ul className="space-y-0.5">
            {group.links.map((link) => {
              const current = active?.href === link.href;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={onNavigate}
                    aria-current={
                      current
                        ? pathname === link.href
                          ? "page"
                          : "location"
                        : undefined
                    }
                    className={`flex min-h-11 items-center gap-3 rounded-control px-3 py-2 text-sm lg:min-h-10 motion-safe:transition-colors ${current ? "bg-ui-selected font-semibold text-ui-accent" : "text-ui-secondary hover:bg-ui-surface-muted hover:text-ui-foreground active:bg-ui-selected"}`}
                  >
                    <Icon name={link.icon} />
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function MobileNavigation({
  groups,
  pathname,
  mode,
  sellerPicker,
}: {
  groups: NavigationGroup[];
  pathname: string;
  mode: WorkspaceMode;
  sellerPicker?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  return (
    <>
      <Button
        variant="quiet"
        className="shrink-0 gap-2 lg:hidden"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Icon name="menu" size={20} />
        Menu
      </Button>
      {open && (
        <Dialog
          open
          title={workspaceNames[mode]}
          variant="drawer"
          onClose={() => setOpen(false)}
          initialFocus={closeButton}
        >
          <Button
            ref={closeButton}
            variant="quiet"
            className="mt-3 w-full gap-2"
            onClick={() => setOpen(false)}
          >
            <Icon name="close" />
            Close navigation
          </Button>
          {sellerPicker && (
            <div className="my-5 border-b border-ui-border pb-5">
              {sellerPicker}
            </div>
          )}
          <div className="mt-5">
            <WorkspaceNavigation
              groups={groups}
              pathname={pathname}
              mobile
              onNavigate={() => setOpen(false)}
            />
          </div>
        </Dialog>
      )}
    </>
  );
}

export function WorkspaceFrame({
  mode,
  children,
  sellerPicker,
  ...access
}: SellerNavigationAccess & {
  mode: WorkspaceMode;
  children: ReactNode;
  sellerPicker?: ReactNode;
}) {
  const pathname = usePathname();
  const { state } = useAuth();
  const user = state.kind === "authenticated" ? state.user : null;
  const groups = workspaceNavigation(mode, user, access);
  const crumbs = workspaceBreadcrumbs(mode, pathname, groups);
  return (
    <div className="min-h-screen bg-ui-canvas text-ui-foreground">
      <a
        href="#workspace-content"
        className="sr-only fixed top-2 left-2 z-50 rounded-control bg-ui-accent p-3 text-white focus:not-sr-only"
      >
        Skip to content
      </a>
      <div className="mx-auto flex min-h-screen max-w-(--ui-page-width)">
        <aside className="hidden w-(--ui-sidebar-width) shrink-0 border-r border-ui-border bg-ui-surface lg:block">
          <div className="sticky top-0 max-h-dvh overflow-y-auto px-3 pb-6">
            <Link
              href="/workspaces"
              className="flex h-(--ui-topbar-height) items-center px-3 text-sm font-semibold tracking-tight"
            >
              Quick Commerce
            </Link>
            <p className="mb-4 px-3 text-ui-caption text-ui-muted">
              {workspaceNames[mode]}
            </p>
            {sellerPicker && (
              <div className="mb-5 border-b border-ui-border px-3 pb-5">
                {sellerPicker}
              </div>
            )}
            <WorkspaceNavigation groups={groups} pathname={pathname} />
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex min-h-(--ui-topbar-height) items-center justify-between gap-2 border-b border-ui-border bg-ui-surface px-4 sm:px-6 lg:px-8">
            <MobileNavigation
              key={pathname}
              groups={groups}
              pathname={pathname}
              mode={mode}
              sellerPicker={sellerPicker}
            />
            <nav
              aria-label="Breadcrumb"
              className="min-w-0 flex-1 text-ui-caption text-ui-secondary"
            >
              <ol className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 py-2">
                {crumbs.map((crumb, index) => (
                  <li
                    key={crumb.href}
                    className={`flex min-w-0 items-center gap-2 ${index === 0 && crumbs.length > 1 ? "hidden sm:flex" : ""}`}
                  >
                    {index > 0 && (
                      <span aria-hidden="true" className="text-ui-muted">
                        /
                      </span>
                    )}
                    {index === crumbs.length - 1 ? (
                      <span
                        aria-current="page"
                        className="truncate text-ui-foreground"
                      >
                        {crumb.label}
                      </span>
                    ) : (
                      <Link
                        href={crumb.href}
                        className="truncate hover:text-ui-accent"
                      >
                        {crumb.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
            {mode === "seller" && (
              <Link
                href="/seller/notifications"
                aria-label="Notifications"
                title="Notifications"
                className="flex size-11 shrink-0 items-center justify-center rounded-control text-ui-secondary hover:bg-ui-surface-muted"
              >
                <Icon name="bell" size={20} />
              </Link>
            )}
            <AccountMenu />
          </header>
          <PageShell>{children}</PageShell>
        </div>
      </div>
    </div>
  );
}
