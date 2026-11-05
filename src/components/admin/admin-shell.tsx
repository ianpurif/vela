"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowUpRight,
  Boxes,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  UserRound,
  X,
} from "lucide-react";
import { signOutCustomer } from "@/features/auth/client";
import { authErrorMessage } from "@/features/auth/schemas";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
];

function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Store administration" className="space-y-1.5">
      {links.map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-sm px-4 py-3.5 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-champagne",
              active ? "bg-ivory/12 text-ivory" : "text-ivory/65 hover:bg-ivory/5 hover:text-ivory",
            )}
          >
            <Icon size={17} strokeWidth={1.5} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminShell({
  children,
  name,
  email,
}: {
  children: ReactNode;
  name: string;
  email: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const section =
    links.find((link) => link.href !== "/admin" && pathname.startsWith(link.href))?.label ||
    "Overview";
  async function logout() {
    setLogoutPending(true);
    setLogoutError("");
    try {
      await signOutCustomer();
      router.replace("/sign-in");
      router.refresh();
    } catch (error) {
      setLogoutError(authErrorMessage(error));
      setLogoutPending(false);
    }
  }
  return (
    <div className="min-h-screen bg-[#f4f1eb]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[236px] flex-col bg-olive px-5 py-8 text-ivory lg:flex">
        <Link
          href="/admin"
          aria-label="VELA administration"
          className="mb-1 px-4 font-display text-4xl tracking-[.2em]"
        >
          VELA
        </Link>
        <p className="mb-12 px-4 text-[9px] tracking-[.2em] text-ivory/45 uppercase">
          Store administration
        </p>
        <AdminNav />
        <div className="mt-auto border-t border-ivory/15 pt-5">
          <Link
            href="/"
            className="mb-3 flex items-center justify-between px-4 py-3 text-xs text-ivory/75 focus-visible:ring-2 focus-visible:ring-champagne"
          >
            Visit storefront
            <ArrowUpRight size={15} />
          </Link>
          <button
            type="button"
            onClick={logout}
            disabled={logoutPending}
            className="flex w-full items-center gap-3 px-4 py-3 text-xs text-ivory/60 focus-visible:ring-2 focus-visible:ring-champagne disabled:opacity-40"
          >
            <LogOut size={15} />
            {logoutPending ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>
      <div className="min-w-0 lg:ml-[236px]">
        <header className="sticky top-0 z-30 flex min-h-[76px] items-center justify-between gap-4 border-b border-olive/10 bg-ivory/95 px-5 backdrop-blur-sm sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
              <Dialog.Trigger asChild>
                <button
                  type="button"
                  aria-label="Open administration menu"
                  className="-ml-2 flex h-10 w-10 items-center justify-center lg:hidden"
                >
                  <Menu size={21} strokeWidth={1.3} />
                </button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-[70] bg-charcoal/40" />
                <Dialog.Content className="fixed inset-y-0 left-0 z-[71] flex w-[min(88vw,300px)] flex-col bg-olive px-5 py-9 text-ivory">
                  <Dialog.Title className="mb-2 px-4 font-display text-4xl tracking-[.2em]">
                    VELA
                  </Dialog.Title>
                  <Dialog.Description className="mb-10 px-4 text-[10px] tracking-wider text-ivory/60">
                    Store administration
                  </Dialog.Description>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      aria-label="Close administration menu"
                      className="absolute right-4 top-8 flex h-10 w-10 items-center justify-center focus-visible:ring-2 focus-visible:ring-champagne"
                    >
                      <X size={20} />
                    </button>
                  </Dialog.Close>
                  <AdminNav onNavigate={() => setMenuOpen(false)} />
                  <div className="mt-auto border-t border-ivory/15 pt-6">
                    <Link
                      href="/"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center justify-between px-4 py-4 text-xs"
                    >
                      Visit storefront
                      <ArrowUpRight size={15} />
                    </Link>
                    <button
                      type="button"
                      onClick={logout}
                      disabled={logoutPending}
                      className="flex items-center gap-3 px-4 py-4 text-xs"
                    >
                      <LogOut size={15} />
                      {logoutPending ? "Signing out…" : "Sign out"}
                    </button>
                  </div>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
            <p className="mb-0 text-xs text-olive/55">
              <span className="hidden sm:inline">
                Store <span className="mx-2 text-olive/30">/</span>
              </span>
              <span className="font-medium text-olive">{section}</span>
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="rounded-full border border-champagne/70 bg-champagne/15 px-3 py-1.5 text-[9px] tracking-wider uppercase">
              Test store
            </span>
            <Link
              href="/account"
              className="flex items-center gap-2"
              aria-label="Your administrator account"
            >
              <div className="hidden max-w-[180px] sm:block">
                <p className="mb-1 truncate text-[11px] font-medium">{name || "Administrator"}</p>
                <p className="mb-0 truncate text-[9px] text-olive/55">{email}</p>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sand/70">
                <UserRound size={16} strokeWidth={1.4} />
              </span>
            </Link>
          </div>
        </header>
        <main
          id="main"
          className="mx-auto min-w-0 max-w-[1500px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10"
        >
          {logoutError && (
            <p
              role="alert"
              className="mb-5 border-l-2 border-[#8c4b32] bg-[#8c4b32]/5 p-4 text-xs text-[#74412e]"
            >
              {logoutError}
            </p>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
