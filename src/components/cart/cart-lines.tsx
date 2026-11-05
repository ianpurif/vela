"use client";

import Image from "next/image";
import Link from "next/link";
import { QuantitySelector } from "@/components/products/quantity-selector";
import { money } from "@/lib/utils";
import { useCart, resolveCart } from "@/stores/cart";
import type { Product } from "@/types/commerce";

export function CartLines({
  products,
  onNavigate,
}: {
  products: Product[];
  onNavigate?: () => void;
}) {
  const items = useCart((state) => state.items);
  const setQuantity = useCart((state) => state.setQuantity);
  const remove = useCart((state) => state.remove);
  const { lines } = resolveCart(items, products);
  return (
    <ul className="m-0 list-none divide-y divide-olive/15 p-0">
      {lines.map(({ productId, quantity, product }) => (
        <li key={productId} className="flex gap-4 py-6 sm:gap-5">
          {product ? (
            <>
              <Link
                href={`/products/${product.slug}`}
                onClick={onNavigate}
                tabIndex={-1}
                aria-hidden="true"
                className="relative block aspect-[4/5] w-[82px] shrink-0 overflow-hidden bg-sand/50 sm:w-24"
              >
                {product.images[0] && (
                  <Image
                    src={product.images[0].src}
                    alt=""
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                )}
              </Link>
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="mb-0 font-display text-[23px] leading-tight">
                    <Link href={`/products/${product.slug}`} onClick={onNavigate}>
                      {product.name}
                    </Link>
                  </h3>
                  <span className="pt-1 text-xs font-medium tabular-nums">
                    {money(product.price * quantity)}
                  </span>
                </div>
                <p className="mb-4 text-[10px] text-olive/80">
                  {product.size} <span className="mx-2">·</span> {money(product.price)} each
                </p>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <QuantitySelector
                    quantity={quantity}
                    onChange={(value) => setQuantity(productId, value)}
                    max={Math.max(1, Math.min(10, product.stock - product.reserved))}
                    name={product.name}
                    compact
                  />
                  <button
                    type="button"
                    onClick={() => remove(productId)}
                    aria-label={`Remove ${product.name} from bag`}
                    className="py-2 text-[10px] text-olive/80 underline underline-offset-4 hover:text-olive"
                  >
                    Remove
                  </button>
                </div>
                {quantity > Math.max(0, product.stock - product.reserved) && (
                  <p role="status" className="mt-3 mb-0 text-[11px] leading-relaxed text-[#8c4b32]">
                    {product.stock - product.reserved > 0
                      ? `Only ${product.stock - product.reserved} available. Please reduce the quantity.`
                      : "This essential is currently out of stock. Please remove it to continue."}
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-between gap-5">
              <div>
                <p className="mb-2 font-display text-2xl">An essential is unavailable.</p>
                <p className="mb-0 text-xs text-olive/80">Please remove it before continuing.</p>
              </div>
              <button
                type="button"
                onClick={() => remove(productId)}
                aria-label="Remove unavailable product"
                className="text-xs underline underline-offset-4"
              >
                Remove
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
