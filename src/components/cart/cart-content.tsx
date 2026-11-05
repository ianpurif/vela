"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CartLines } from "@/components/cart/cart-lines";
import { EmptyCart } from "@/components/cart/empty-cart";
import { useCart, useCartReady, resolveCart } from "@/stores/cart";
import { money } from "@/lib/utils";
import type { Product } from "@/types/commerce";

export function CartContent({ products }: { products: Product[] }) {
  const items = useCart((state) => state.items);
  const ready = useCartReady();
  const cart = resolveCart(items, products);
  if (!ready)
    return (
      <div className="min-h-80 py-20 text-center text-xs text-olive/60" role="status">
        Opening your bag…
      </div>
    );
  if (!cart.count) return <EmptyCart />;
  return (
    <div className="grid items-start gap-10 lg:grid-cols-[1fr_370px] lg:gap-16">
      <div>
        <div className="flex justify-between border-b border-olive/20 pb-4 text-[10px] tracking-[.15em] text-olive/65 uppercase">
          <span>Your essentials</span>
          <span>
            {cart.count} {cart.count === 1 ? "item" : "items"}
          </span>
        </div>
        <CartLines products={products} />
        <Link
          href="/shop"
          className="mt-5 inline-flex items-center gap-3 py-3 text-[10px] tracking-[.1em] uppercase"
        >
          <ArrowLeft size={14} />
          Continue discovering
        </Link>
      </div>
      <aside className="bg-sand/40 p-7 sm:p-9">
        <p className="eyebrow mb-7">Your ritual, considered</p>
        <h2 className="mb-7 text-4xl">The little details.</h2>
        <dl className="mb-7 grid grid-cols-2 gap-y-5 text-xs">
          <dt className="text-olive/75">Subtotal</dt>
          <dd className="m-0 text-right">{money(cart.subtotal)}</dd>
          <dt className="text-olive/75">US shipping</dt>
          <dd className="m-0 text-right text-olive/60">
            {cart.shipping ? money(cart.shipping) : "Complimentary"}
          </dd>
        </dl>
        <div className="mb-7 flex items-baseline justify-between border-t border-olive/20 pt-6">
          <span className="text-xs">Estimated total</span>
          <span className="font-display text-4xl">{money(cart.total)}</span>
        </div>
        {cart.unavailable ? (
          <>
            <p role="status" className="text-xs leading-relaxed text-[#8c4b32]">
              Please adjust the unavailable items in your bag before continuing.
            </p>
            <Button disabled className="w-full">
              Adjust your bag to continue
            </Button>
          </>
        ) : (
          <Button asChild className="w-full justify-between">
            <Link href="/checkout">
              Continue to checkout
              <ArrowRight size={15} />
            </Link>
          </Button>
        )}
        <p className="mt-5 mb-0 flex items-center justify-center gap-2 text-[10px] text-olive/65">
          <LockKeyhole size={12} />
          Secure Stripe test checkout
        </p>
        <p className="mt-6 mb-0 text-[10px] leading-5 text-olive/60">
          Prices and availability are confirmed when you check out. Your bag doesn’t reserve stock.
        </p>
      </aside>
    </div>
  );
}
