import Link from "next/link";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyCart({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex flex-col items-center px-4 py-20 text-center">
      <ShoppingBag size={35} strokeWidth={1} className="mb-8 text-sage" />
      <p className="eyebrow mb-4">A little space for self-care</p>
      <h2 className="mb-4 text-5xl">Your ritual starts here.</h2>
      <p className="mb-8 max-w-xs text-xs leading-7 text-olive/70">
        Your bag is waiting for something good. Discover a few everyday essentials.
      </p>
      <Button asChild>
        <Link href="/shop" onClick={onNavigate}>
          Explore the essentials
          <ArrowRight size={14} />
        </Link>
      </Button>
    </div>
  );
}
