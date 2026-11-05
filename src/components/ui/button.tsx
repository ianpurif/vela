import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const styles = cva("inline-flex min-h-12 items-center justify-center gap-3 px-7 py-3 text-[11px] font-semibold tracking-[.14em] uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-olive disabled:pointer-events-none disabled:opacity-50", {
  variants: { variant: { default: "bg-olive text-ivory hover:bg-charcoal", outline: "border border-olive/35 text-olive hover:bg-olive/5", ghost: "px-3 text-olive hover:bg-olive/5", light: "bg-ivory text-olive hover:bg-sand" } },
  defaultVariants: { variant: "default" },
});
export function Button({ className, variant, asChild = false, ...props }: ComponentProps<"button"> & VariantProps<typeof styles> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(styles({ variant }), className)} {...props} />;
}
