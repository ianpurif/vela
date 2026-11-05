"use client";

import type { CartItem, Order } from "@/types/commerce";

export class CheckoutRequestError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
  ) {
    super(message);
    this.name = "CheckoutRequestError";
  }
}

export async function orderRequest(
  url: string,
  options: { method?: "GET" | "POST"; body?: unknown; signal?: AbortSignal } = {},
): Promise<Order> {
  const response = await fetch(url, {
    method: options.method || "GET",
    credentials: "same-origin",
    cache: "no-store",
    signal: options.signal,
    ...(options.body
      ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(options.body) }
      : {}),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new CheckoutRequestError(
      typeof result.error === "string"
        ? result.error
        : "Your checkout couldn’t be updated. Please try again.",
      typeof result.code === "string" ? result.code : "REQUEST_FAILED",
      response.status,
    );
  if (
    !result.order ||
    typeof result.order.id !== "string" ||
    !["pending", "paid", "failed", "cancelled", "expired"].includes(result.order.paymentStatus)
  )
    throw new CheckoutRequestError(
      "We couldn’t confirm your order status. Please refresh before trying again.",
      "INVALID_RESPONSE",
      502,
    );
  return result.order as Order;
}

export function createCheckout(items: CartItem[], requestKey: string) {
  return orderRequest("/api/checkout", {
    method: "POST",
    body: { items: items.map(({ productId, quantity }) => ({ productId, quantity })), requestKey },
  });
}

export function checkoutError(error: unknown) {
  if (error instanceof CheckoutRequestError) return error.message;
  if (error instanceof Error && error.message.includes("browser")) return error.message;
  return "We couldn’t confirm that request. Your bag is safe. Please retry; we’ll use the same checkout attempt.";
}
