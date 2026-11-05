"use client";

import { useState } from "react";
import { QuantitySelector } from "@/components/products/quantity-selector";
import { AddToCart } from "@/components/products/add-to-cart";
import type { Product } from "@/types/commerce";

export function PurchaseControls({ product }: { product: Product }) {
  const [quantity, setQuantity] = useState(1);
  const available = Math.max(0, product.stock - product.reserved);
  return (
    <div>
      <div className="flex flex-wrap items-stretch gap-3">
        <QuantitySelector
          name={product.name}
          quantity={quantity}
          onChange={setQuantity}
          max={Math.max(1, Math.min(10, available))}
        />
        <AddToCart product={product} quantity={quantity} />
      </div>
      <p className="mt-4 mb-0 flex items-center gap-2 text-[11px] text-olive/70">
        <span className={`h-1.5 w-1.5 rounded-full ${available > 0 ? "bg-sage" : "bg-olive/30"}`} />
        {available > 0
          ? available < 6
            ? `Only ${available} available for your ritual`
            : "In stock · Ready for your ritual"
          : "Currently out of stock"}
      </p>
    </div>
  );
}
