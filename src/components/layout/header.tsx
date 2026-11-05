"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRight, Menu, Search, UserRound, X } from "lucide-react";
import { CartDrawer } from "@/components/cart/cart-drawer";
import type { Product } from "@/types/commerce";

const navigation = [
  { href: "/shop", label: "The collection" },
  { href: "/about", label: "Our philosophy" },
  { href: "/routine", label: "Find your ritual" },
];
export function Header({ products, announcement }: { products: Product[]; announcement: string }) {
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const reducedMotion = useReducedMotion();
  const pathname = usePathname();
  return (
    <>
      <div className="bg-olive px-5 py-2.5 text-center text-[10px] tracking-[.09em] text-ivory">
        {announcement}
      </div>
      <header className="sticky top-0 z-40 border-b border-olive/10 bg-ivory/95 backdrop-blur-md">
        <div className="wrap relative flex h-[88px] items-center justify-between max-md:h-[72px]">
          <nav aria-label="Main navigation" className="hidden items-center gap-7 lg:flex">
            {navigation.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={pathname === link.href ? "page" : undefined}
                className="text-[10px] font-semibold tracking-[.09em] transition-colors hover:text-olive/80"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <Dialog.Root open={menu} onOpenChange={setMenu}>
            <Dialog.Trigger className="p-2 lg:hidden" aria-label="Open navigation">
              <Menu size={21} strokeWidth={1.3} />
            </Dialog.Trigger>
            <AnimatePresence>
              {menu && (
                <Dialog.Portal forceMount>
                  <Dialog.Overlay asChild forceMount>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: reducedMotion ? 0 : 0.2 }}
                      className="fixed inset-0 z-50 bg-charcoal/30"
                    />
                  </Dialog.Overlay>
                  <Dialog.Content asChild forceMount>
                    <motion.div
                      initial={{ x: reducedMotion ? 0 : "-100%" }}
                      animate={{ x: 0 }}
                      exit={{ x: reducedMotion ? 0 : "-100%" }}
                      transition={{ duration: reducedMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="fixed inset-y-0 left-0 z-50 flex w-[min(88vw,420px)] flex-col overflow-y-auto overscroll-contain bg-ivory p-8"
                    >
                      <Dialog.Title className="font-display text-4xl tracking-[.22em]">
                        VELA
                      </Dialog.Title>
                      <Dialog.Description className="sr-only">
                        Explore VELA skincare and daily rituals.
                      </Dialog.Description>
                      <Dialog.Close
                        className="absolute right-5 top-7 p-2"
                        aria-label="Close navigation"
                      >
                        <X size={22} />
                      </Dialog.Close>
                      <nav
                        className="mb-10 mt-16 flex flex-col gap-8"
                        aria-label="Mobile navigation"
                      >
                        {navigation.map((link, i) => (
                          <motion.div
                            key={link.href}
                            initial={{ opacity: reducedMotion ? 1 : 0, x: reducedMotion ? 0 : -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{
                              duration: reducedMotion ? 0 : 0.25,
                              delay: reducedMotion ? 0 : 0.1 + i * 0.05,
                            }}
                          >
                            <Link
                              href={link.href}
                              onClick={() => setMenu(false)}
                              className="flex items-center justify-between font-display text-4xl"
                            >
                              <span>{link.label}</span>
                              <span className="font-sans text-[10px]">0{i + 1}</span>
                            </Link>
                          </motion.div>
                        ))}
                      </nav>
                      <Link
                        href="/account"
                        onClick={() => setMenu(false)}
                        className="mt-auto flex gap-3 border-t border-olive/15 pt-6"
                      >
                        <UserRound size={18} /> Your account
                      </Link>
                    </motion.div>
                  </Dialog.Content>
                </Dialog.Portal>
              )}
            </AnimatePresence>
          </Dialog.Root>
          <Link
            href="/"
            aria-label="VELA home"
            className="absolute left-1/2 -translate-x-1/2 font-display text-[43px] leading-none tracking-[.2em] max-md:text-4xl"
          >
            VELA
          </Link>
          <div className="flex items-center gap-4 max-md:gap-1">
            <Dialog.Root open={search} onOpenChange={setSearch}>
              <Dialog.Trigger aria-label="Search products" className="p-2">
                <Search size={19} strokeWidth={1.4} />
              </Dialog.Trigger>
              <AnimatePresence>
                {search && (
                  <Dialog.Portal forceMount>
                    <Dialog.Overlay asChild forceMount>
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: reducedMotion ? 0 : 0.2 }}
                        className="fixed inset-0 z-50 bg-charcoal/30"
                      />
                    </Dialog.Overlay>
                    <Dialog.Content asChild forceMount>
                      <motion.div
                        initial={{ y: reducedMotion ? 0 : -24, opacity: reducedMotion ? 1 : 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: reducedMotion ? 0 : -24, opacity: reducedMotion ? 1 : 0 }}
                        transition={{
                          duration: reducedMotion ? 0 : 0.25,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                        className="fixed inset-x-0 top-0 z-50 max-h-dvh overflow-y-auto bg-ivory px-6 py-14 shadow-lg"
                      >
                        <div className="mx-auto max-w-2xl">
                          <Dialog.Title className="font-display text-4xl">
                            A little something for your skin.
                          </Dialog.Title>
                          <Dialog.Description className="my-4 text-sm text-olive/80">
                            Find a product, ingredient, or moment of care.
                          </Dialog.Description>
                          <form
                            action="/shop"
                            onSubmit={() => setSearch(false)}
                            className="mt-7 flex border-b border-olive/40"
                          >
                            <input
                              name="q"
                              aria-label="Search the collection"
                              placeholder="Search the collection"
                              className="min-w-0 flex-1 bg-transparent py-4"
                              autoFocus
                            />
                            <button aria-label="Submit search" className="p-4">
                              <ArrowRight size={20} />
                            </button>
                          </form>
                        </div>
                        <Dialog.Close
                          className="absolute right-6 top-6 p-2"
                          aria-label="Close search"
                        >
                          <X size={22} />
                        </Dialog.Close>
                      </motion.div>
                    </Dialog.Content>
                  </Dialog.Portal>
                )}
              </AnimatePresence>
            </Dialog.Root>
            <Link href="/account" aria-label="Your account" className="hidden p-2 sm:block">
              <UserRound size={19} strokeWidth={1.4} />
            </Link>
            <CartDrawer products={products} />
          </div>
        </div>
      </header>
    </>
  );
}
