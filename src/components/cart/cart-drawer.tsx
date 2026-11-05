"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { ArrowRight, ShoppingBag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CartLines } from "@/components/cart/cart-lines";
import { EmptyCart } from "@/components/cart/empty-cart";
import { useCart, useCartReady, resolveCart } from "@/stores/cart";
import { money } from "@/lib/utils";
import type { Product } from "@/types/commerce";

export function CartDrawer({ products }: { products: Product[] }) {
  const items = useCart((state) => state.items);
  const open = useCart((state) => state.open);
  const setOpen = useCart((state) => state.setOpen);
  const ready = useCartReady();
  const reducedMotion = useReducedMotion();
  const cart = resolveCart(items, products);
  const close = () => setOpen(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label={`Shopping bag${ready && cart.count ? `, ${cart.count} items` : ""}`}
          className="relative inline-flex min-h-11 min-w-11 items-center justify-center gap-2 text-olive"
        >
          <ShoppingBag size={19} strokeWidth={1.3} />
          <span className="hidden text-[10px] tracking-[.06em] sm:inline">
            Bag ({ready ? cart.count : 0})
          </span>
          {ready && cart.count > 0 && (
            <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-olive px-1 text-[8px] text-ivory sm:hidden">
              {cart.count}
            </span>
          )}
        </button>
      </Dialog.Trigger>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reducedMotion ? 0 : 0.2 }}
                className="fixed inset-0 z-[70] bg-charcoal/35 backdrop-blur-[3px]"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.aside
                initial={{ x: reducedMotion ? 0 : "100%" }}
                animate={{ x: 0 }}
                exit={{ x: reducedMotion ? 0 : "100%" }}
                transition={{ duration: reducedMotion ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="fixed inset-y-0 right-0 z-[71] flex w-full max-w-[510px] flex-col bg-ivory shadow-2xl"
              >
                <div className="border-b border-olive/15 px-6 py-7 sm:px-9">
                  <div className="flex items-center justify-between gap-4">
                    <Dialog.Title className="mb-0 font-display text-4xl">
                      Your bag{" "}
                      <span className="font-sans text-xs text-olive/80">({cart.count})</span>
                    </Dialog.Title>
                    <Dialog.Close asChild>
                      <button
                        type="button"
                        aria-label="Close shopping bag"
                        className="flex h-10 w-10 items-center justify-center hover:bg-olive/5"
                      >
                        <X size={20} strokeWidth={1.3} />
                      </button>
                    </Dialog.Close>
                  </div>
                  <Dialog.Description className="mt-2 mb-0 text-[11px] text-olive/80">
                    A better ritual is taking shape.
                  </Dialog.Description>
                </div>
                <div className="flex-1 overflow-y-auto overscroll-contain px-6 sm:px-9">
                  {cart.count ? (
                    <CartLines products={products} onNavigate={close} />
                  ) : (
                    <EmptyCart onNavigate={close} />
                  )}
                </div>
                {cart.count > 0 && (
                  <div className="border-t border-olive/15 bg-ivory px-6 py-6 sm:px-9">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs">Subtotal</span>
                      <span className="font-display text-3xl">{money(cart.subtotal)}</span>
                    </div>
                    <p className="mb-5 text-[10px] leading-5 text-olive/80">
                      Shipping and final availability are confirmed at checkout.
                    </p>
                    {cart.unavailable ? (
                      <Button disabled className="w-full">
                        Adjust your bag to continue
                      </Button>
                    ) : (
                      <Button asChild className="w-full justify-between">
                        <Link href="/checkout" onClick={close}>
                          Continue to checkout
                          <ArrowRight size={15} />
                        </Link>
                      </Button>
                    )}
                    <Link
                      href="/cart"
                      onClick={close}
                      className="mt-4 block py-2 text-center text-[10px] tracking-[.1em] underline underline-offset-4 uppercase"
                    >
                      View your bag
                    </Link>
                  </div>
                )}
              </motion.aside>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
