"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  StorefrontButton,
  StorefrontInput,
} from "@/components/storefront/controls";
import { StorefrontBrand } from "@/features/storefront/brand";
import {
  AccountError,
  asAccountError,
  fieldError,
} from "@/features/account/shared";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "./auth-provider";
export function LoginForm() {
  const { login, state, refresh } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<ApiError | null>(null);
  const inFlight = useRef(false),
    alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const form = event.currentTarget,
      values = new FormData(form);
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await login(
        String(values.get("email") ?? ""),
        String(values.get("password") ?? ""),
      );
      if (alive.current) router.replace("/workspaces");
    } catch (reason) {
      if (alive.current) setError(asAccountError(reason));
    } finally {
      const password = form.elements.namedItem("password");
      if (password instanceof HTMLInputElement) password.value = "";
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <div className="sf-storefront sf-auth">
      <header className="sf-auth-header">
        <StorefrontBrand />
        <Link href="/shop">Back to shopping</Link>
      </header>
      <main id="storefront-content" className="sf-auth-main">
        <div className="sf-auth-intro">
          <p className="sf-eyebrow">Your QuickCommerce account</p>
          <h1>Welcome back.</h1>
          <p>
            Sign in to see your orders, saved addresses and account details.
          </p>
        </div>
        <section className="sf-auth-form-panel" aria-labelledby="login-heading">
          <h2 id="login-heading">Sign in</h2>
          <p>Use the email address for your account.</p>
          {state.kind === "error" && !error && (
            <AccountError error={state.error} onRetry={() => void refresh()} />
          )}
          {state.kind === "authenticated" && (
            <p className="sf-auth-current">
              <Link href="/workspaces">Continue with your current account</Link>
            </p>
          )}
          <form onSubmit={submit} aria-busy={busy}>
            <fieldset disabled={busy} className="sf-auth-fields">
              <StorefrontInput
                name="email"
                type="email"
                label="Email address"
                autoComplete="username"
                required
                maxLength={254}
                error={fieldError(error, "email")}
              />
              <StorefrontInput
                name="password"
                type="password"
                label="Password"
                autoComplete="current-password"
                required
                maxLength={1024}
                error={fieldError(error, "password")}
              />
            </fieldset>
            {error && <AccountError error={error} />}
            <StorefrontButton type="submit" busy={busy}>
              {busy ? "Signing in..." : "Sign in"}
            </StorefrontButton>
          </form>
          <p className="sf-auth-help">
            Account registration and password recovery are not available on this
            site yet.
          </p>
        </section>
        <div className="sf-auth-aside">
          <p>Here to manage a store?</p>
          <p>
            The same sign-in gives you access to your authorized seller and
            platform workspaces.
          </p>
        </div>
      </main>
      <footer className="sf-auth-footer">
        <Link href="/">QuickCommerce</Link>
        <span>Your account, from shopping to selling.</span>
      </footer>
    </div>
  );
}
