"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { cartApi } from "@/lib/api/client";
import type { CartResponse } from "@/lib/api/types";

interface CartContextType {
  cart: CartResponse | null;
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

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const load = useCallback((signal?: AbortSignal) => {
    return cartApi
      .get(signal)
      .then((data) => {
        setCart(data);
      })
      .catch(() => {})
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const refreshCart = useCallback(async () => {
    setIsLoading(true);
    await load();
  }, [load]);

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);
  const toggleCart = useCallback(() => setIsOpen((prev) => !prev), []);

  const addItem = useCallback(async (variantId: string, quantity = 1) => {
    try {
      setIsLoading(true);
      const updated = await cartApi.addItem(variantId, quantity);
      setCart(updated);
      setIsOpen(true);
    } catch (err) {
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateQuantity = useCallback(
    async (itemId: string, quantity: number) => {
      try {
        setIsLoading(true);
        const updated = await cartApi.updateQuantity(itemId, quantity);
        setCart(updated);
      } catch (err) {
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const removeItem = useCallback(async (itemId: string) => {
    try {
      setIsLoading(true);
      const updated = await cartApi.removeItem(itemId);
      setCart(updated);
    } catch (err) {
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearCart = useCallback(async () => {
    try {
      setIsLoading(true);
      const updated = await cartApi.clear();
      setCart(updated);
    } catch (err) {
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <CartContext.Provider
      value={{
        cart,
        isLoading,
        isOpen,
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

const defaultCartContext: CartContextType = {
  cart: null,
  isLoading: false,
  isOpen: false,
  openCart: () => {},
  closeCart: () => {},
  toggleCart: () => {},
  addItem: async () => {},
  updateQuantity: async () => {},
  removeItem: async () => {},
  clearCart: async () => {},
  refreshCart: async () => {},
};

export function useCart() {
  const context = useContext(CartContext);
  return context || defaultCartContext;
}
