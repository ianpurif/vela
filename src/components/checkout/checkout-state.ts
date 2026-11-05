"use client";

import type { CartItem, Order } from "@/types/commerce";
import { sanitizeCartItems, useCart } from "@/stores/cart";

export type CheckoutAttempt = {
  requestKey: string;
  items: CartItem[];
  orderId?: string;
  status: Order["paymentStatus"];
  createdAt: number;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const closed = new Set<Order["paymentStatus"]>(["failed", "cancelled", "expired"]);
const attemptKey = (uid: string) => `vela-checkout-attempts-v1:${uid}`;

export function cartFingerprint(items: CartItem[]) {
  return JSON.stringify(
    [...items]
      .sort((a, b) => a.productId.localeCompare(b.productId))
      .map(({ productId, quantity }) => [productId, quantity]),
  );
}

function readAttempts(uid: string): Record<string, CheckoutAttempt> {
  const raw = sessionStorage.getItem(attemptKey(uid));
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const result: Record<string, CheckoutAttempt> = {};
    for (const [key, candidate] of Object.entries(value)) {
      if (!candidate || typeof candidate !== "object") continue;
      const attempt = candidate as Partial<CheckoutAttempt>;
      if (
        typeof attempt.requestKey !== "string" ||
        !uuid.test(attempt.requestKey) ||
        !Array.isArray(attempt.items)
      )
        continue;
      const items = sanitizeCartItems(attempt.items);
      if (
        !items.length ||
        cartFingerprint(items) !== key ||
        !["pending", "paid", "failed", "cancelled", "expired"].includes(attempt.status || "")
      )
        continue;
      result[key] = {
        requestKey: attempt.requestKey,
        items,
        orderId: typeof attempt.orderId === "string" ? attempt.orderId : undefined,
        status: attempt.status!,
        createdAt: typeof attempt.createdAt === "number" ? attempt.createdAt : 0,
      };
    }
    return result;
  } catch {
    return {};
  }
}

/** Keep the same request key through ambiguous responses; only explicit or terminal retries replace it. */
export function getCheckoutAttempt(
  uid: string,
  items: CartItem[],
  startNew = false,
): CheckoutAttempt {
  try {
    const attempts = readAttempts(uid);
    const fingerprint = cartFingerprint(items);
    const previous = attempts[fingerprint];
    if (previous && !startNew && !closed.has(previous.status)) return previous;
    const attempt: CheckoutAttempt = {
      requestKey: crypto.randomUUID(),
      items: items.map(({ productId, quantity }) => ({ productId, quantity })),
      status: "pending",
      createdAt: Date.now(),
    };
    attempts[fingerprint] = attempt;
    sessionStorage.setItem(attemptKey(uid), JSON.stringify(attempts));
    return attempt;
  } catch {
    throw new Error(
      "Your browser couldn’t save this checkout attempt. Enable session storage or open a regular browser tab before continuing.",
    );
  }
}

export function rememberCheckoutOrder(order: Order) {
  const attempts = readAttempts(order.userId);
  const items = order.lines.map(({ productId, quantity }) => ({ productId, quantity }));
  const key = cartFingerprint(items);
  const existing = attempts[key];
  // An older order must not replace a newer attempt for the same basket.
  if (!existing || existing.requestKey !== order.requestKey) return;
  attempts[key] = {
    requestKey: order.requestKey,
    items,
    orderId: order.id,
    status: order.paymentStatus,
    createdAt: existing?.createdAt ?? order.createdAt,
  };
  sessionStorage.setItem(attemptKey(order.userId), JSON.stringify(attempts));
}

export function stripeCheckoutUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.hostname === "checkout.stripe.com" &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.pathname.startsWith("/")
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function subtractOrderedQuantities(current: CartItem[], purchased: CartItem[]): CartItem[] {
  const quantities = new Map(purchased.map((item) => [item.productId, item.quantity]));
  return current.flatMap((item) => {
    const quantity = Math.max(0, item.quantity - (quantities.get(item.productId) || 0));
    return quantity ? [{ productId: item.productId, quantity }] : [];
  });
}

type CleanupJournal = { state: "applying" | "done"; before: CartItem[]; after: CartItem[] };
type CleanupResult = "updated" | "already-updated" | "preserved";

/** A lock and write-ahead journal prevent refreshes/tabs from subtracting an order twice. */
export async function reconcilePaidBag(order: Order): Promise<CleanupResult> {
  if (order.paymentStatus !== "paid") return "preserved";
  const key = `vela-order-cleared-v1:${order.userId}:${order.id}`;
  if (!navigator.locks) return "preserved";
  return navigator.locks.request(key, async () => {
    try {
      const bagKey = useCart.persist.getOptions().name;
      if (!bagKey) return "preserved";
      const readBag = () => {
        const raw = localStorage.getItem(bagKey);
        return raw ? sanitizeCartItems(JSON.parse(raw)?.state?.items) : useCart.getState().items;
      };
      const rawJournal = localStorage.getItem(key);
      const journal: CleanupJournal | null = rawJournal ? JSON.parse(rawJournal) : null;
      if (journal?.state === "done" || sessionStorage.getItem(key) === "done") {
        await useCart.persist.rehydrate();
        return "already-updated";
      }
      const attempts = readAttempts(order.userId);
      const snapshot = Object.values(attempts).find(
        (attempt) => attempt.requestKey === order.requestKey,
      );
      if (!snapshot || cartFingerprint(snapshot.items) !== cartFingerprint(order.lines))
        return "preserved";
      const current = readBag();
      let next: CartItem[];
      if (journal?.state === "applying") {
        if (cartFingerprint(current) === cartFingerprint(journal.after)) {
          localStorage.setItem(key, JSON.stringify({ ...journal, state: "done" }));
          sessionStorage.setItem(key, "done");
          await useCart.persist.rehydrate();
          return "already-updated";
        }
        if (cartFingerprint(current) !== cartFingerprint(journal.before)) return "preserved";
        next = sanitizeCartItems(journal.after);
      } else {
        next = subtractOrderedQuantities(current, snapshot.items);
        localStorage.setItem(
          key,
          JSON.stringify({
            state: "applying",
            before: current,
            after: next,
          } satisfies CleanupJournal),
        );
      }
      useCart.setState({ items: next });
      // Verify persistence before marking the operation complete.
      if (cartFingerprint(readBag()) !== cartFingerprint(next)) return "preserved";
      localStorage.setItem(
        key,
        JSON.stringify({ state: "done", before: current, after: next } satisfies CleanupJournal),
      );
      sessionStorage.setItem(key, "done");
      return "updated";
    } catch {
      return "preserved";
    }
  });
}
