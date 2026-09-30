"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { errorMessage } from "@/lib/api/client";
import { useAuth } from "./auth-provider";

export function AccountMenu() {
  const { state, logout } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  if (state.kind !== "authenticated") return null;
  const user = state.user;
  async function signOut() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await logout();
      router.replace("/login");
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <details className="relative">
      <summary className="min-h-11 cursor-pointer rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-slate-100">
        Account <span className="sr-only">menu for {user.email}</span>
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-72 max-w-[calc(100vw_-_2rem)] rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
        <p className="truncate text-sm font-semibold">
          {user.first_name || "Your account"}
          {user.last_name ? ` ${user.last_name}` : ""}
        </p>
        <p className="mt-1 truncate text-xs text-slate-600">{user.email}</p>
        <div className="mt-3 border-t border-slate-100 pt-2">
          <Link
            href="/account"
            className="block rounded-lg px-2 py-2.5 text-sm hover:bg-slate-50"
          >
            My account
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            disabled={busy}
            className="min-h-11 w-full rounded-lg px-2 text-left text-sm text-red-800 hover:bg-red-50 disabled:opacity-60"
          >
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-800">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}
