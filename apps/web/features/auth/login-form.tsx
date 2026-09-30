"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { ApiError, errorMessage } from "@/lib/api/client";
import {
  ErrorState,
  FormField,
  primaryButton,
} from "@/components/ui/primitives";
import { useAuth } from "./auth-provider";

export function LoginForm() {
  const { login, state, refresh } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const inFlight = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await login(
        String(values.get("email") ?? ""),
        String(values.get("password") ?? ""),
      );
      router.replace("/workspaces");
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason
          : new ApiError(errorMessage(reason), 0),
      );
    } finally {
      const password = form.elements.namedItem("password");
      if (password instanceof HTMLInputElement) password.value = "";
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-3 text-lg font-semibold tracking-tight text-teal-900"
        >
          <span
            aria-hidden="true"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-800 text-white"
          >
            Q
          </span>
          Quick Commerce
        </Link>
        <section
          className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9"
          aria-labelledby="login-heading"
        >
          <h1
            id="login-heading"
            className="text-2xl font-semibold tracking-tight"
          >
            Welcome back
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Sign in to your seller or platform workspace.
          </p>
          {state.kind === "error" && !error && (
            <div className="mt-5">
              <ErrorState
                title="We couldn’t check your current session"
                message={state.error.message}
                requestId={state.error.requestId}
                onRetry={() => void refresh()}
              />
            </div>
          )}
          {state.kind === "authenticated" && (
            <p className="mt-4 text-sm">
              <Link
                href="/workspaces"
                className="font-medium text-teal-800 underline"
              >
                Continue with your current account
              </Link>
            </p>
          )}
          <form onSubmit={submit} className="mt-7 space-y-5" aria-busy={busy}>
            <FormField
              id="email"
              name="email"
              type="email"
              label="Email address"
              autoComplete="username"
              required
              maxLength={254}
              disabled={busy}
              error={error?.fields.email?.join(" ")}
            />
            <FormField
              id="password"
              name="password"
              type="password"
              label="Password"
              autoComplete="current-password"
              required
              maxLength={1024}
              disabled={busy}
              error={error?.fields.password?.join(" ")}
            />
            {error && (
              <div
                role="alert"
                className="rounded-lg bg-red-50 p-3 text-sm leading-6 text-red-900"
              >
                {error.message}
                {error.requestId && (
                  <span className="block text-xs">
                    Request reference: {error.requestId}
                  </span>
                )}
              </div>
            )}
            <button
              type="submit"
              disabled={busy}
              className={`${primaryButton} w-full`}
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </section>
        <p className="mt-6 text-center text-xs text-slate-500">
          One account. The workspaces you’re authorized to manage.
        </p>
      </div>
    </main>
  );
}
