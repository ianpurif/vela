"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, LockKeyhole, LoaderCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyCart } from "@/components/cart/empty-cart";
import { resolveCart, useCart, useCartReady } from "@/stores/cart";
import { createCheckout, checkoutError } from "@/components/checkout/checkout-api";
import {
  getCheckoutAttempt,
  rememberCheckoutOrder,
  stripeCheckoutUrl,
} from "@/components/checkout/checkout-state";
import { money } from "@/lib/utils";
import type { Order, Product } from "@/types/commerce";

export function CheckoutReview({
  products,
  uid,
  email,
  emailVerified,
}: {
  products: Product[];
  uid: string;
  email: string;
  emailVerified: boolean;
}) {
  const router = useRouter();
  const items = useCart((state) => state.items);
  const ready = useCartReady();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [completedAttempt, setCompletedAttempt] = useState<Order | null>(null);
  const cart = resolveCart(items, products);
  async function startCheckout(startNew = false) {
    if (pending || !emailVerified || !items.length) return;
    setPending(true);
    setError("");
    try {
      const attempt = getCheckoutAttempt(uid, items, startNew);
      const order = await createCheckout(attempt.items, attempt.requestKey);
      rememberCheckoutOrder(order);
      if (order.paymentStatus === "paid") {
        setCompletedAttempt(order);
        return;
      }
      const url = order.paymentStatus === "pending" ? stripeCheckoutUrl(order.checkoutUrl) : null;
      if (url) {
        window.location.assign(url);
        return;
      }
      router.push(`/checkout?order=${encodeURIComponent(order.id)}`);
      router.refresh();
    } catch (failure) {
      setError(checkoutError(failure));
    } finally {
      setPending(false);
    }
  }
  if (!ready)
    return (
      <p role="status" className="min-h-64 py-20 text-center text-xs text-olive/60">
        Preparing your ritual…
      </p>
    );
  if (!cart.count) return <EmptyCart />;
  return (
    <div className="grid items-start gap-10 lg:grid-cols-[1fr_420px] lg:gap-16">
      <div>
        <div className="mb-8 border-l-2 border-champagne bg-champagne/15 p-5">
          <p className="mb-2 text-[10px] font-semibold tracking-[.12em] uppercase">
            Stripe test mode
          </p>
          <p className="mb-0 text-xs leading-6 text-olive/75">
            This is a test purchase. No real payment will be taken. Payment and delivery details are
            entered on Stripe’s secure checkout.
          </p>
        </div>
        <div className="mb-8 flex items-start gap-4 border-b border-olive/20 pb-8">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-olive/20 text-xs">
            01
          </span>
          <div>
            <h2 className="mb-3 font-display text-4xl">A place for your ritual.</h2>
            <p className="mb-3 text-xs leading-6 text-olive/70">
              You’re signed in as <strong className="font-medium text-olive">{email}</strong>.
            </p>
            {emailVerified ? (
              <p className="mb-0 inline-flex items-center gap-2 text-[10px] text-olive/65">
                <Check size={13} className="text-sage" />
                Email verified
              </p>
            ) : (
              <div>
                <p role="status" className="mb-4 text-xs leading-6 text-[#8c4b32]">
                  Please verify your email before starting a test checkout.
                </p>
                <Button asChild variant="outline">
                  <Link href="/account">Verify your email</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
        <div className="mb-9 flex items-start gap-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-olive/20 text-xs">
            02
          </span>
          <div>
            <h2 className="mb-3 font-display text-4xl">One thoughtful last step.</h2>
            <p className="mb-5 max-w-lg text-xs leading-7 text-olive/70">
              Review your essentials. We’ll confirm current prices and reserve available stock
              before you continue to Stripe.
            </p>
            <ul className="m-0 list-none space-y-3 p-0 text-[11px] text-olive/65">
              <li className="flex items-center gap-3">
                <LockKeyhole size={14} strokeWidth={1.4} />
                Card details stay with Stripe.
              </li>
              <li className="flex items-center gap-3">
                <ShieldCheck size={14} strokeWidth={1.4} />
                Your order is confirmed after payment verification.
              </li>
            </ul>
          </div>
        </div>
        <Link
          href="/cart"
          className="inline-flex items-center gap-2 py-3 text-[10px] tracking-wider underline underline-offset-4 uppercase"
        >
          <ArrowLeft size={13} />
          Return to your bag
        </Link>
      </div>
      <aside className="min-w-0 bg-sand/35 p-6 sm:p-8">
        <p className="eyebrow mb-6">The little details</p>
        <ul className="m-0 list-none divide-y divide-olive/15 p-0">
          {cart.lines.map(({ productId, quantity, product }) => (
            <li key={productId} className="flex items-center gap-3 py-4 first:pt-0">
              <div className="relative h-20 w-16 shrink-0 overflow-hidden bg-sand/60">
                {product?.images[0] && (
                  <Image
                    src={product.images[0].src}
                    alt=""
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="mb-2 font-display text-[23px] leading-tight">
                  {product?.name || "Unavailable essential"}
                </p>
                <p className="mb-0 text-[10px] text-olive/65">Quantity {quantity}</p>
              </div>
              <span className="text-xs tabular-nums">
                {product ? money(product.price * quantity) : "—"}
              </span>
            </li>
          ))}
        </ul>
        <dl className="mt-5 mb-6 grid grid-cols-2 gap-y-4 border-t border-olive/20 pt-6 text-xs">
          <dt className="text-olive/65">Subtotal</dt>
          <dd className="m-0 text-right">{money(cart.subtotal)}</dd>
          <dt className="text-olive/65">US shipping</dt>
          <dd className="m-0 text-right">
            {cart.shipping ? money(cart.shipping) : "Complimentary"}
          </dd>
          <dt className="mt-2 border-t border-olive/15 pt-5">Estimated total</dt>
          <dd className="m-0 mt-2 border-t border-olive/15 pt-4 text-right font-display text-4xl">
            {money(cart.total)}
          </dd>
        </dl>
        {cart.unavailable && (
          <p role="alert" className="mb-5 text-xs leading-6 text-[#8c4b32]">
            Some essentials have changed availability. Review your bag before continuing. An
            existing checkout reservation may also be holding stock.
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mb-5 border-l-2 border-[#8c4b32] bg-[#8c4b32]/5 p-4 text-xs leading-6 text-[#74412e]"
          >
            {error}
          </p>
        )}
        {completedAttempt ? (
          <div>
            <p role="status" className="mb-5 text-xs leading-6 text-olive/75">
              This checkout was already paid. View the confirmation, or explicitly begin another
              purchase with these essentials.
            </p>
            <Button asChild className="mb-3 w-full">
              <Link href={`/checkout/success?order=${encodeURIComponent(completedAttempt.id)}`}>
                View confirmed order
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => startCheckout(true)}
              className="w-full px-3 text-[10px]"
            >
              Start a new test checkout
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            disabled={pending || !emailVerified}
            onClick={() => startCheckout()}
            className="w-full justify-between px-5 text-[10px]"
          >
            {pending ? "Preparing checkout…" : "Continue to test checkout"}
            {pending ? (
              <LoaderCircle size={15} className="animate-spin" />
            ) : (
              <ArrowRight size={15} />
            )}
          </Button>
        )}
        <p className="mt-5 mb-0 text-center text-[9px] leading-5 text-olive/55">
          By continuing, you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-2">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </p>
      </aside>
    </div>
  );
}
