"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ApiError, authApi, isAbort } from "@/lib/api/client";
import type { CurrentUser } from "@/lib/api/types";

type AuthState =
  | { kind: "loading" }
  | { kind: "anonymous" }
  | { kind: "authenticated"; user: CurrentUser }
  | { kind: "error"; error: ApiError };
interface AuthContextValue {
  state: AuthState;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ kind: "loading" });
  const generation = useRef(0);
  const load = useCallback((signal?: AbortSignal) => {
    const current = ++generation.current;
    return authApi
      .me(signal)
      .then((user) => {
        if (current === generation.current && !signal?.aborted)
          setState({ kind: "authenticated", user });
      })
      .catch((error: unknown) => {
        if (isAbort(error) || current !== generation.current) return;
        if (error instanceof ApiError && error.status === 403)
          setState({ kind: "anonymous" });
        else
          setState({
            kind: "error",
            error:
              error instanceof ApiError
                ? error
                : new ApiError("We couldn’t verify your session.", 0),
          });
      });
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  const login = useCallback(
    async (email: string, password: string) => {
      const current = ++generation.current;
      try {
        const user = await authApi.login(email, password);
        if (current === generation.current)
          setState({ kind: "authenticated", user });
      } catch (error) {
        if (current === generation.current) await load();
        throw error;
      }
    },
    [load],
  );
  const refresh = useCallback(() => {
    setState({ kind: "loading" });
    return load();
  }, [load]);
  const logout = useCallback(async () => {
    const current = ++generation.current;
    await authApi.logout();
    if (current === generation.current) setState({ kind: "anonymous" });
  }, []);
  return (
    <AuthContext value={{ state, login, logout, refresh }}>
      {children}
    </AuthContext>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) throw new Error("useAuth requires AuthProvider.");
  return context;
}
