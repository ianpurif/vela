"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
                className="text-[10px] font-semibold tracking-[.09em] transition-opacity hover:opacity-60"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <Dialog.Root open={menu} onOpenChange={setMenu}>
            <Dialog.Trigger className="p-2 lg:hidden" aria-label="Open navigation">
              <Menu size={21} strokeWidth={1.3} />
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-charcoal/30" />
              <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-[min(88vw,420px)] flex-col bg-ivory p-8">
                <Dialog.Title className="font-display text-4xl tracking-[.22em]">VELA</Dialog.Title>
                <Dialog.Description className="sr-only">
                  Explore VELA skincare and daily rituals.
                </Dialog.Description>
                <Dialog.Close className="absolute right-5 top-7 p-2" aria-label="Close navigation">
                  <X size={22} />
                </Dialog.Close>
                <nav className="mt-16 flex flex-col gap-8" aria-label="Mobile navigation">
                  {navigation.map((link, i) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMenu(false)}
                      className="flex items-center justify-between font-display text-4xl"
                    >
                      <span>{link.label}</span>
                      <span className="font-sans text-[10px]">0{i + 1}</span>
                    </Link>
                  ))}
                </nav>
                <Link
                  href="/account"
                  onClick={() => setMenu(false)}
                  className="mt-auto flex gap-3 border-t border-olive/15 pt-6"
                >
                  <UserRound size={18} /> Your account
                </Link>
              </Dialog.Content>
            </Dialog.Portal>
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
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-charcoal/30" />
                <Dialog.Content className="fixed inset-x-0 top-0 z-50 bg-ivory px-6 py-14 shadow-lg">
                  <div className="mx-auto max-w-2xl">
                    <Dialog.Title className="font-display text-4xl">
                      A little something for your skin.
                    </Dialog.Title>
                    <Dialog.Description className="my-4 text-sm text-olive/70">
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
                        className="min-w-0 flex-1 bg-transparent py-4 outline-none"
                        autoFocus
                      />
                      <button aria-label="Submit search" className="p-4">
                        <ArrowRight size={20} />
                      </button>
                    </form>
                  </div>
                  <Dialog.Close className="absolute right-6 top-6 p-2" aria-label="Close search">
                    <X size={22} />
                  </Dialog.Close>
                </Dialog.Content>
              </Dialog.Portal>
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
