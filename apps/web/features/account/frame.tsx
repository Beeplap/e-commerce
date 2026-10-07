"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { StorefrontBreadcrumb } from "@/components/storefront/content";
import { StorefrontButton } from "@/components/storefront/controls";
import { useAuth } from "@/features/auth/auth-provider";
import { StorefrontHeader } from "@/features/storefront/header";
import { StorefrontFooter } from "@/features/storefront/footer";
import { errorMessage } from "@/lib/api/client";
import type { CurrentUser } from "@/lib/api/types";
import { AccountError, AccountLoading, useAccountCommand } from "./shared";

const links = [
  ["/account", "Overview"],
  ["/account/orders", "Orders"],
  ["/account/addresses", "Addresses"],
  ["/account/profile", "Profile & security"],
] as const;

/** Public shell only. Confidential data loads through Django after session validation. */
export function AccountFrame({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: (user: CurrentUser) => ReactNode;
}) {
  const { state, refresh, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (state.kind === "anonymous") router.replace("/login");
  }, [state.kind, router]);
  const command = useAccountCommand();
  const [logoutError, setLogoutError] = useState<string | null>(null);
  return (
    <div className="sf-storefront sf-account">
      <StorefrontHeader />
      <main id="storefront-content" tabIndex={-1} className="sf-account-main">
        <StorefrontBreadcrumb
          items={[
            { label: "Home", href: "/" },
            {
              label: "My account",
              ...(pathname !== "/account" ? { href: "/account" } : {}),
            },
            ...(pathname !== "/account" ? [{ label: title }] : []),
          ]}
        />
        <div className="sf-account-layout">
          {state.kind === "authenticated" && (
            <aside className="sf-account-navigation">
              <p className="sf-eyebrow">My account</p>
              <p className="sf-account-identity">
                {state.user.first_name || "Welcome back"}
              </p>
              <nav aria-label="Account">
                <ul>
                  {links.map(([href, label]) => (
                    <li key={href}>
                      <Link
                        href={href}
                        aria-current={
                          pathname === href ||
                          (href !== "/account" &&
                            pathname.startsWith(href + "/"))
                            ? "page"
                            : undefined
                        }
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="sf-account-signout">
                <Link href="/workspaces">Your workspaces</Link>
                <StorefrontButton
                  variant="quiet"
                  busy={command.busy}
                  onClick={() =>
                    void command.run(
                      async () => {
                        await logout();
                        if (command.active()) router.replace("/login");
                      },
                      (error) => setLogoutError(errorMessage(error)),
                    )
                  }
                >
                  Sign out
                </StorefrontButton>
              </div>
              {logoutError && <AccountError message={logoutError} />}
            </aside>
          )}
          <div className="sf-account-content">
            <header className="sf-account-heading">
              <h1>{title}</h1>
              <p>{description}</p>
            </header>
            {state.kind === "loading" && (
              <AccountLoading label="Checking your session" />
            )}
            {state.kind === "error" && (
              <AccountError
                error={state.error}
                onRetry={() => void refresh()}
              />
            )}
            {state.kind === "anonymous" && (
              <div className="sf-account-empty">
                <h2>Sign in to view your account</h2>
                <p>
                  Your orders and personal details are available after sign-in.
                </p>
                <Link
                  className="sf-button"
                  data-variant="primary"
                  href="/login"
                >
                  Sign in
                </Link>
              </div>
            )}
            {state.kind === "authenticated" && (
              <div key={state.user.id + pathname}>{children(state.user)}</div>
            )}
          </div>
        </div>
      </main>
      <StorefrontFooter />
    </div>
  );
}
