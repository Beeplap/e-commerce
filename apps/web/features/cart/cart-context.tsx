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
import { cartApi, errorMessage } from "@/lib/api/client";
import type { CartResponse } from "@/lib/api/types";
import { useAuth } from "@/features/auth/auth-provider";
import { isCount, isUuid } from "../storefront/catalog-evidence";
import { cartEvidence } from "./evidence";

interface CartContextType {
  cart: CartResponse | null;
  status: "loading" | "ready" | "error";
  error: string | null;
  identity: string;
  revision: number;
  isLoading: boolean;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  addItem: (variantId: string, quantity?: number) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
}
const CartContext = createContext<CartContextType | null>(null);
type Read = {
  identity: string;
  cart: CartResponse | null;
  status: CartContextType["status"];
  error: string | null;
  revision: number;
  pending: boolean;
};

/** Bind cart UX to session identity without remounting unrelated page workflows. */
export function SessionCartProvider({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const identity = state.kind === "authenticated" ? state.user.id : state.kind;
  return <CartProvider identity={identity}>{children}</CartProvider>;
}

export function CartProvider({
  children,
  identity = "browser",
}: {
  children: ReactNode;
  identity?: string;
}) {
  const [read, setRead] = useState<Read>({
    identity,
    cart: null,
    status: "loading",
    error: null,
    revision: 0,
    pending: false,
  });
  const [overlay, setOverlay] = useState<{ identity: string; open: boolean }>({
    identity,
    open: false,
  });
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const mutation = useRef<number | null>(null);
  const load = useCallback(async () => {
    const current = ++generation.current;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setRead((previous) => ({
      identity,
      cart: null,
      status: "loading",
      error: null,
      revision: previous.revision,
      pending: false,
    }));
    if (identity === "loading") return;
    try {
      const data = cartEvidence(await cartApi.get(request.signal));
      if (current === generation.current && !request.signal.aborted)
        setRead((previous) => ({
          identity,
          cart: data,
          status: "ready",
          error: null,
          revision: previous.revision + 1,
          pending: false,
        }));
    } catch (error: unknown) {
      if (current === generation.current && !request.signal.aborted)
        setRead((previous) => ({
          identity,
          cart: null,
          status: "error",
          error: errorMessage(error),
          revision: previous.revision,
          pending: false,
        }));
    }
  }, [identity]);
  const invalidate = useCallback(() => {
    ++generation.current;
    controller.current?.abort();
  }, []);
  useEffect(() => {
    void load();
    return () => {
      invalidate();
    };
  }, [load, invalidate]);

  const command = useCallback(
    async (send: () => Promise<CartResponse>, open = false) => {
      if (mutation.current !== null)
        throw new Error(
          "A cart action is still in progress. Wait and try again.",
        );
      if (identity === "loading")
        throw new Error("Your session is being checked. Try again shortly.");
      const current = ++generation.current;
      mutation.current = current;
      controller.current?.abort();
      setRead((previous) => ({ ...previous, pending: true }));
      let received = false;
      try {
        const response = await send();
        received = true;
        const updated = cartEvidence(response);
        if (current !== generation.current)
          throw new Error(
            "Your cart context changed. Reload your cart before trying again.",
          );
        setRead((previous) => ({
          identity,
          cart: updated,
          status: "ready",
          error: null,
          revision: previous.revision + 1,
          pending: false,
        }));
        if (open) setOverlay({ identity, open: true });
      } catch (error: unknown) {
        if (current === generation.current)
          setRead((previous) => ({
            ...previous,
            cart: received ? null : previous.cart,
            pending: false,
            status: !received && previous.cart ? "ready" : "error",
            error: !received && previous.cart ? null : errorMessage(error),
          }));
        throw error;
      } finally {
        if (mutation.current === current) mutation.current = null;
      }
    },
    [identity],
  );
  const refreshCart = useCallback(async () => {
    if (mutation.current !== null)
      throw new Error("Wait for the cart action to finish before reloading.");
    await load();
  }, [load]);
  const addItem = useCallback(
    async (id: string, quantity = 1) => {
      if (!isUuid(id) || !isCount(quantity) || quantity < 1)
        throw new Error("Choose a valid product option and quantity.");
      await command(() => cartApi.addItem(id, quantity), true);
    },
    [command],
  );
  const updateQuantity = useCallback(
    async (id: string, quantity: number) => {
      if (!isUuid(id) || !isCount(quantity))
        throw new Error("Choose a valid cart item and quantity.");
      await command(() => cartApi.updateQuantity(id, quantity));
    },
    [command],
  );
  const removeItem = useCallback(
    async (id: string) => {
      if (!isUuid(id)) throw new Error("Choose a valid cart item.");
      await command(() => cartApi.removeItem(id));
    },
    [command],
  );
  const clearCart = useCallback(
    () => command(() => cartApi.clear()),
    [command],
  );
  const openCart = useCallback(
    () => setOverlay({ identity, open: true }),
    [identity],
  );
  const closeCart = useCallback(
    () => setOverlay({ identity, open: false }),
    [identity],
  );
  const toggleCart = useCallback(
    () =>
      setOverlay((previous) => ({
        identity,
        open: previous.identity !== identity || !previous.open,
      })),
    [identity],
  );
  const current = read.identity === identity;
  return (
    <CartContext.Provider
      value={{
        cart: current ? read.cart : null,
        status: current ? read.status : "loading",
        error: current ? read.error : null,
        identity,
        revision: current ? read.revision : 0,
        isLoading: !current || read.status === "loading" || read.pending,
        isOpen: overlay.identity === identity && overlay.open,
        openCart,
        closeCart,
        toggleCart,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        refreshCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

const unavailable = async () => {
  throw new Error("The cart is unavailable. Reload this page.");
};
const defaultCartContext: CartContextType = {
  cart: null,
  status: "error",
  error: "The cart is unavailable. Reload this page.",
  identity: "unavailable",
  revision: 0,
  isLoading: false,
  isOpen: false,
  openCart: () => {},
  closeCart: () => {},
  toggleCart: () => {},
  addItem: unavailable,
  updateQuantity: unavailable,
  removeItem: unavailable,
  clearCart: unavailable,
  refreshCart: unavailable,
};
export function useCart() {
  return useContext(CartContext) ?? defaultCartContext;
}
