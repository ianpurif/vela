"use client";

import { useEffect, useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { calculateTotals } from "@/features/cart/pricing";
import type { CartItem, Product } from "@/types/commerce";

const validId = /^[a-zA-Z0-9_-]{1,120}$/;
const MAX_QUANTITY = 10;
const MAX_LINES = 20;

// Keep the persist API available during SSR and tolerate restricted browser storage.
const browserStorage = {
  getItem: (name: string) => {
    try {
      const raw = typeof window === "undefined" ? null : window.localStorage.getItem(name);
      if (raw) JSON.parse(raw);
      return raw;
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(name, value);
    } catch {
      /* The in-memory bag still works when storage is unavailable. */
    }
  },
  removeItem: (name: string) => {
    try {
      if (typeof window !== "undefined") window.localStorage.removeItem(name);
    } catch {
      /* The in-memory bag remains usable. */
    }
  },
};

/** Storage is untrusted: restore only valid IDs and bounded integer quantities. */
export function sanitizeCartItems(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];
  const items = new Map<string, number>();
  for (const candidate of value.slice(0, 100)) {
    if (!candidate || typeof candidate !== "object") continue;
    const { productId, quantity } = candidate;
    if (typeof productId !== "string" || !validId.test(productId)) continue;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) continue;
    if (!items.has(productId) && items.size >= MAX_LINES) continue;
    items.set(productId, Math.min(MAX_QUANTITY, (items.get(productId) ?? 0) + quantity));
  }
  return [...items].map(([productId, quantity]) => ({ productId, quantity }));
}

type CartState = {
  items: CartItem[];
  open: boolean;
  add: (productId: string, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  setOpen: (open: boolean) => void;
};

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      open: false,
      add: (productId, quantity = 1) => {
        if (
          !validId.test(productId) ||
          !Number.isInteger(quantity) ||
          quantity < 1 ||
          quantity > MAX_QUANTITY
        )
          return;
        set((state) => {
          const existing = state.items.find((item) => item.productId === productId);
          if (!existing && state.items.length >= MAX_LINES) return state;
          return {
            items: existing
              ? state.items.map((item) =>
                  item.productId === productId
                    ? { ...item, quantity: Math.min(MAX_QUANTITY, item.quantity + quantity) }
                    : item,
                )
              : [...state.items, { productId, quantity }],
          };
        });
      },
      setQuantity: (productId, quantity) => {
        if (!Number.isInteger(quantity) || quantity < 0 || quantity > MAX_QUANTITY) return;
        set((state) => ({
          items:
            quantity === 0
              ? state.items.filter((item) => item.productId !== productId)
              : state.items.map((item) =>
                  item.productId === productId ? { ...item, quantity } : item,
                ),
        }));
      },
      remove: (productId) =>
        set((state) => ({ items: state.items.filter((item) => item.productId !== productId) })),
      clear: () => set({ items: [] }),
      setOpen: (open) => set({ open }),
    }),
    {
      name: "vela-bag-v1",
      version: 1,
      storage: createJSONStorage(() => browserStorage),
      partialize: (state) => ({ items: state.items }),
      skipHydration: true,
      merge: (persisted, current) => ({
        ...current,
        items: sanitizeCartItems(
          persisted && typeof persisted === "object" && "items" in persisted ? persisted.items : [],
        ),
      }),
    },
  ),
);

const subscribeHydration = (callback: () => void) => {
  const start = useCart.persist.onHydrate(callback);
  const finish = useCart.persist.onFinishHydration(callback);
  return () => {
    start();
    finish();
  };
};

/** The server and first client render agree, even when a saved bag exists. */
export function useCartReady() {
  useEffect(() => {
    if (!useCart.persist.hasHydrated()) void useCart.persist.rehydrate();
  }, []);
  return useSyncExternalStore(subscribeHydration, useCart.persist.hasHydrated, () => false);
}

export function resolveCart(items: CartItem[], products: Product[]) {
  const byId = new Map(
    products
      .filter((product) => product.status === "published")
      .map((product) => [product.id, product]),
  );
  const lines = items.map((item) => ({ ...item, product: byId.get(item.productId) }));
  const totals = calculateTotals(
    lines.flatMap((line) =>
      line.product ? [{ unitPrice: line.product.price, quantity: line.quantity }] : [],
    ),
  );
  const unavailable = lines.some(
    (line) =>
      !line.product || line.quantity > Math.max(0, line.product.stock - line.product.reserved),
  );
  return {
    lines,
    ...totals,
    unavailable,
    count: items.reduce((total, item) => total + item.quantity, 0),
  };
}
