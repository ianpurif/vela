"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function QuantitySelector({
  quantity,
  onChange,
  max = 10,
  name,
  compact = false,
}: {
  quantity: number;
  onChange: (quantity: number) => void;
  max?: number;
  name: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn("inline-flex items-center border border-olive/25", compact ? "h-9" : "h-12")}
      role="group"
      aria-label={`Quantity of ${name}`}
    >
      <button
        type="button"
        aria-label={`Decrease quantity of ${name}`}
        disabled={quantity <= 1}
        onClick={() => onChange(quantity - 1)}
        className="flex h-full w-10 items-center justify-center transition-colors hover:bg-olive/5 disabled:opacity-30"
      >
        <Minus size={13} />
      </button>
      <span aria-live="polite" aria-atomic="true" className="w-8 text-center text-xs tabular-nums">
        {quantity}
      </span>
      <button
        type="button"
        aria-label={`Increase quantity of ${name}`}
        disabled={quantity >= max}
        onClick={() => onChange(quantity + 1)}
        className="flex h-full w-10 items-center justify-center transition-colors hover:bg-olive/5 disabled:opacity-30"
      >
        <Plus size={13} />
      </button>
    </div>
  );
}
