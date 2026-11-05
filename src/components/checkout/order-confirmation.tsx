"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Check, CircleCheck, Clock3, LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrderSummary } from "@/components/checkout/order-summary";
import {
  checkoutError,
  CheckoutRequestError,
  createCheckout,
  orderRequest,
} from "@/components/checkout/checkout-api";
import {
  getCheckoutAttempt,
  reconcilePaidBag,
  rememberCheckoutOrder,
  stripeCheckoutUrl,
} from "@/components/checkout/checkout-state";
import { useCart, useCartReady } from "@/stores/cart";
import type { Order } from "@/types/commerce";

const statusCopy = {
  pending: {
    eyebrow: "Awaiting payment confirmation",
    title: "One last moment.",
    description:
      "We’re waiting for Stripe to confirm your test payment. Reaching this page alone doesn’t confirm payment.",
  },
  paid: {
    eyebrow: "Test payment verified",
    title: "Your ritual, confirmed.",
    description:
      "Your test payment has been verified and your order is recorded. No real payment was taken.",
  },
  failed: {
    eyebrow: "Test payment unsuccessful",
    title: "Let’s try that again.",
    description:
      "Your test payment did not complete. Review your bag and start a new checkout when you’re ready.",
  },
  cancelled: {
    eyebrow: "Checkout cancelled",
    title: "A little room to pause.",
    description:
      "This checkout has been cancelled. Your essentials can wait in your bag until you’re ready.",
  },
  expired: {
    eyebrow: "Checkout expired",
    title: "A fresh start for your ritual.",
    description:
      "This test checkout has expired. Review current availability and begin a new checkout.",
  },
} as const;

function freshestOrder(previous: Order, next: Order): Order {
  if (previous.paymentStatus === "paid" && next.paymentStatus !== "paid") return previous;
  return next.updatedAt >= previous.updatedAt ? next : previous;
}

export function OrderConfirmation({
  initialOrder,
  review = false,
}: {
  initialOrder: Order;
  review?: boolean;
}) {
  const router = useRouter();
  const [order, setOrder] = useState(initialOrder);
  const [busy, setBusy] = useState<"check" | "resume" | "cancel" | "retry" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pollStopped, setPollStopped] = useState(false);
  const [bagNotice, setBagNotice] = useState("");
  const ready = useCartReady();
  const copy = statusCopy[order.paymentStatus];
  const stripeUrl = stripeCheckoutUrl(order.checkoutUrl);
  const terminal = ["failed", "cancelled", "expired"].includes(order.paymentStatus);

  useEffect(() => {
    if (order.paymentStatus !== "pending") return;
    let active = true;
    let attempts = 0;
    const deadline = Date.now() + 60000;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function poll() {
      if (!active) return;
      if (Date.now() >= deadline) {
        setPollStopped(true);
        return;
      }
      let keepPolling = true;
      try {
        const signal = AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(Math.max(1, Math.min(10000, deadline - Date.now()))),
        ]);
        const next = await orderRequest(`/api/orders/${encodeURIComponent(order.id)}`, { signal });
        if (!active) return;
        setOrder((previous) => freshestOrder(previous, next));
        keepPolling = next.paymentStatus === "pending";
      } catch (failure) {
        if (!active) return;
        if (failure instanceof CheckoutRequestError && [401, 403, 404].includes(failure.status)) {
          setError(checkoutError(failure));
          keepPolling = false;
        }
      }
      attempts += 1;
      if (!active) return;
      if (keepPolling && attempts < 20 && Date.now() < deadline)
        timer = setTimeout(poll, Math.min(3000, deadline - Date.now()));
      else setPollStopped(true);
    }
    timer = setTimeout(poll, 3000);
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [order.id, order.paymentStatus]);

  useEffect(() => {
    if (!ready || order.paymentStatus !== "paid") return;
    let active = true;
    async function finishBag() {
      try {
        rememberCheckoutOrder(order);
      } catch {
        /* The verified order remains valid if session storage is unavailable. */
      }
      const result = await reconcilePaidBag(order).catch(() => "preserved");
      if (active)
        setBagNotice(
          result === "preserved"
            ? "Your order is confirmed. We left your bag unchanged so any newer additions stay safe."
            : "Purchased quantities have been removed from your bag. Any additional essentials stay with you.",
        );
    }
    void finishBag();
    return () => {
      active = false;
    };
  }, [order, ready]);

  function acceptOrder(next: Order) {
    setOrder((previous) => freshestOrder(previous, next));
    try {
      rememberCheckoutOrder(next);
    } catch {
      /* Retain authoritative status even when browser storage is unavailable. */
    }
  }
  async function checkStatus() {
    if (busy) return;
    setBusy("check");
    setError("");
    setMessage("");
    try {
      const next = await orderRequest(`/api/orders/${encodeURIComponent(order.id)}`);
      acceptOrder(next);
      setMessage(
        next.paymentStatus === "pending"
          ? "Payment confirmation is still pending. You can check again shortly."
          : "Order status updated.",
      );
    } catch (failure) {
      setError(checkoutError(failure));
    } finally {
      setBusy(null);
    }
  }
  async function resumeCheckout() {
    if (busy || order.paymentStatus !== "pending") return;
    if (stripeUrl) {
      window.location.assign(stripeUrl);
      return;
    }
    setBusy("resume");
    setError("");
    setMessage("");
    try {
      const next = await createCheckout(
        order.lines.map(({ productId, quantity }) => ({ productId, quantity })),
        order.requestKey,
      );
      acceptOrder(next);
      const url = next.paymentStatus === "pending" ? stripeCheckoutUrl(next.checkoutUrl) : null;
      if (url) window.location.assign(url);
      else if (next.paymentStatus === "pending")
        setMessage("Your checkout is still being prepared. Check its status again in a moment.");
    } catch (failure) {
      setError(checkoutError(failure));
    } finally {
      setBusy(null);
    }
  }
  async function cancelCheckout() {
    if (busy || order.paymentStatus !== "pending") return;
    setBusy("cancel");
    setError("");
    setMessage("");
    try {
      const next = await orderRequest(`/api/orders/${encodeURIComponent(order.id)}/cancel`, {
        method: "POST",
      });
      acceptOrder(next);
      setMessage(
        next.paymentStatus === "cancelled"
          ? "Checkout cancelled. The stock reservation has been released."
          : "Your order status was updated. Review its current payment status above.",
      );
    } catch (failure) {
      setError(checkoutError(failure));
    } finally {
      setBusy(null);
    }
  }
  function startNewCheckout() {
    if (busy) return;
    setBusy("retry");
    setError("");
    try {
      if (!useCart.getState().items.length)
        for (const line of order.lines) useCart.getState().add(line.productId, line.quantity);
      getCheckoutAttempt(order.userId, useCart.getState().items, true);
      router.push("/checkout");
      router.refresh();
    } catch (failure) {
      setError(checkoutError(failure));
      setBusy(null);
    }
  }
  return (
    <div className="grid items-start gap-10 lg:grid-cols-[1fr_420px] lg:gap-16">
      <div>
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-olive/20">
          {order.paymentStatus === "paid" ? (
            <CircleCheck size={27} strokeWidth={1.2} className="text-sage" />
          ) : (
            <Clock3 size={26} strokeWidth={1.2} className="text-olive/80" />
          )}
        </div>
        <p className="eyebrow mb-5" role="status">
          {copy.eyebrow}
        </p>
        <h1 className="mb-6 text-[58px] sm:text-[72px]">
          {review && order.paymentStatus === "pending"
            ? "Your checkout is still open."
            : copy.title}
        </h1>
        <p className="mb-8 max-w-lg text-xs leading-7 text-olive/75">
          {review && order.paymentStatus === "pending"
            ? "Your reservation remains active while this checkout is open. Continue with Stripe, or cancel the checkout below. We’ll confirm payment before marking your order paid."
            : copy.description}
        </p>
        <dl className="mb-8 grid gap-4 border-y border-olive/20 py-6 text-xs">
          <div className="flex flex-wrap justify-between gap-3">
            <dt className="text-olive/80">Order reference</dt>
            <dd className="m-0 break-all font-mono text-[10px]">{order.id}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-3">
            <dt className="text-olive/80">Order email</dt>
            <dd className="m-0 break-all">{order.email}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-olive/80">Payment status</dt>
            <dd className="m-0 font-medium capitalize">
              {order.paymentStatus === "paid" ? "Verified test payment" : order.paymentStatus}
            </dd>
          </div>
          {order.paymentStatus === "paid" && (
            <div className="flex justify-between gap-3">
              <dt className="text-olive/80">Fulfillment</dt>
              <dd className="m-0 capitalize">
                {order.fulfillmentStatus === "unfulfilled"
                  ? "Awaiting preparation"
                  : order.fulfillmentStatus}
              </dd>
            </div>
          )}
          {order.trackingNumber && (
            <div className="flex flex-wrap justify-between gap-3">
              <dt className="text-olive/80">Tracking reference</dt>
              <dd className="m-0 break-all text-right">{order.trackingNumber}</dd>
            </div>
          )}
        </dl>
        {order.paymentStatus === "pending" && (
          <div className="mb-7">
            <p className="mb-5 flex items-start gap-2 text-[11px] leading-6 text-olive/80">
              {!pollStopped && <LoaderCircle size={13} className="mt-1 shrink-0 animate-spin" />}
              {pollStopped
                ? "Automatic checking has paused. Use Check payment status to refresh the latest confirmation."
                : "Checking for confirmation for up to one minute. You can safely keep this page open."}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button type="button" disabled={!!busy} onClick={resumeCheckout}>
                {busy === "resume"
                  ? "Preparing…"
                  : stripeUrl
                    ? "Continue to test checkout"
                    : "Retry this checkout"}
                <ArrowRight size={14} />
              </Button>
              <Button type="button" variant="outline" disabled={!!busy} onClick={checkStatus}>
                <RefreshCw size={13} />
                {busy === "check" ? "Checking…" : "Check payment status"}
              </Button>
            </div>
            <button
              type="button"
              disabled={!!busy}
              onClick={cancelCheckout}
              className="mt-5 py-2 text-[10px] text-olive/80 underline underline-offset-4 disabled:opacity-40"
            >
              {busy === "cancel" ? "Cancelling…" : "Cancel this checkout"}
            </button>
          </div>
        )}
        {terminal && (
          <div className="mb-7 flex flex-wrap gap-3">
            <Button type="button" disabled={!!busy} onClick={startNewCheckout}>
              Review a new checkout
              <ArrowRight size={14} />
            </Button>
            <Button asChild variant="outline">
              <Link href="/cart">Return to your bag</Link>
            </Button>
          </div>
        )}
        {error && (
          <p
            role="alert"
            className="mb-5 border-l-2 border-[#8c4b32] bg-[#8c4b32]/5 p-4 text-xs leading-6 text-[#74412e]"
          >
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="mb-5 border-l-2 border-sage bg-sage/10 p-4 text-xs leading-6">
            {message}
          </p>
        )}
        {order.paymentStatus === "paid" && (
          <>
            <p className="mb-6 flex items-start gap-2 text-[11px] leading-6 text-olive/80">
              <Check size={14} className="mt-1 shrink-0 text-sage" />
              {bagNotice || "Your verified test order is safely recorded in your account."}
            </p>
            <div className="mb-7 flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/account/orders">
                  View your orders
                  <ArrowRight size={14} />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/shop">Continue discovering</Link>
              </Button>
            </div>
          </>
        )}
        <p className="mb-0 text-[11px] leading-6 text-olive/80">
          Need a little help?{" "}
          <Link href="/contact" className="text-olive underline underline-offset-4">
            Contact VELA
          </Link>{" "}
          and include your order reference.
        </p>
      </div>
      <aside className="bg-sand/35 p-6 sm:p-8">
        <div className="mb-7 border-b border-olive/15 pb-5">
          <p className="eyebrow mb-2">Test order</p>
          <p className="mb-0 text-[10px] leading-6 text-olive/80">
            This is a demonstration purchase. No real charge or delivery is created.
          </p>
        </div>
        <OrderSummary order={order} showAddress />
      </aside>
    </div>
  );
}
