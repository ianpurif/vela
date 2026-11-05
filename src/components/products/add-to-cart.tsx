"use client";

import { Plus, ShoppingBag } from "lucide-react";
import { useCart } from "@/stores/cart";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/utils";
import type { Product } from "@/types/commerce";

export function AddToCart({
  product,
  quantity = 1,
  compact = false,
}: {
  product: Product;
  quantity?: number;
  compact?: boolean;
}) {
  const add = useCart((state) => state.add);
  const setOpen = useCart((state) => state.setOpen);
  const inBag = useCart(
    (state) => state.items.find((item) => item.productId === product.id)?.quantity ?? 0,
  );
  const available = Math.max(0, product.stock - product.reserved);
  const allowed =
    product.status === "published" &&
    quantity <= available &&
    inBag + quantity <= Math.min(10, available);
  const label = available < 1 ? "Out of stock" : !allowed ? "Bag limit reached" : "Add to bag";
  const handleAdd = () => {
    add(product.id, quantity);
    setOpen(true);
  };

  if (compact)
    return (
      <button
        type="button"
        disabled={!allowed}
        onClick={handleAdd}
        aria-label={`${label}: ${product.name}`}
        className="flex h-11 w-11 shrink-0 items-center justify-center border border-olive/25 text-olive transition-colors hover:bg-olive hover:text-ivory disabled:cursor-not-allowed disabled:opacity-30"
      >
        <Plus size={18} strokeWidth={1.3} />
      </button>
    );
  return (
    <Button
      type="button"
      disabled={!allowed}
      onClick={handleAdd}
      className="w-full flex-1"
      aria-label={`${label}: ${product.name}`}
    >
      <ShoppingBag size={15} strokeWidth={1.4} />
      {label}
      {allowed && (
        <span className="ml-auto border-l border-ivory/25 pl-4">
          {money(product.price * quantity)}
        </span>
      )}
    </Button>
  );
}
