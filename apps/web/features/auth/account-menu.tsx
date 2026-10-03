"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { confirmUnsavedNavigation } from "@/components/ui/unsaved-changes";
import { errorMessage } from "@/lib/api/client";
import { useAuth } from "./auth-provider";

export function AccountMenu() {
  const { state, logout } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function dismissOutside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !menu.current?.contains(event.target) &&
        menu.current
      )
        menu.current.open = false;
    }
    function dismissOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && menu.current?.open) {
        menu.current.open = false;
        menu.current.querySelector("summary")?.focus();
      }
    }
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, []);
  if (state.kind !== "authenticated") return null;
  const user = state.user;
  async function signOut() {
    if (inFlight.current || !confirmUnsavedNavigation()) return;
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
    <details ref={menu} className="relative shrink-0">
      <summary className="min-h-11 cursor-pointer rounded-control px-3 py-2.5 text-sm font-medium text-ui-secondary hover:bg-ui-surface-muted active:bg-ui-selected">
        Account <span className="sr-only">menu for {user.email}</span>
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-72 max-w-[calc(100vw_-_2rem)] rounded-overlay border border-ui-border bg-ui-surface p-4 shadow-lg">
        <p className="truncate text-sm font-semibold">
          {user.first_name || "Your account"}
          {user.last_name ? ` ${user.last_name}` : ""}
        </p>
        <p className="mt-1 truncate text-ui-caption text-ui-secondary">
          {user.email}
        </p>
        <div className="mt-3 border-t border-ui-border pt-2">
          <Link
            href="/account"
            onClick={() => {
              if (menu.current) menu.current.open = false;
            }}
            className="block min-h-11 rounded-control px-2 py-2.5 text-sm hover:bg-ui-surface-muted"
          >
            My account
          </Link>
          <Button
            variant="quiet"
            onClick={() => void signOut()}
            busy={busy}
            className="w-full justify-start px-2 text-ui-danger"
          >
            {busy ? "Signing out…" : "Sign out"}
          </Button>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-ui-body text-ui-danger">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}
