import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
export function Footer() {
  return (
    <footer className="bg-olive text-ivory">
      <div className="wrap grid gap-14 pb-16 pt-20 md:grid-cols-[1.8fr_1fr_1fr_1fr]">
        <div>
          <Link href="/" className="font-display text-6xl tracking-[.18em]" aria-label="VELA home">
            VELA
          </Link>
          <p className="mt-5 max-w-[240px] text-sm leading-7 text-ivory/70">
            A better ritual for everyday skin.
            <br />A little care, just for you.
          </p>
          <Link href="/routine" className="text-link mt-5 text-ivory/90">
            Find your ritual <ArrowUpRight size={15} />
          </Link>
        </div>
        <div>
          <h3 className="eyebrow mb-6 text-ivory/55">Discover</h3>
          <div className="flex flex-col items-start gap-4 text-xs">
            <Link href="/shop">The collection</Link>
            <Link href="/shop?category=cleansers">Cleansers</Link>
            <Link href="/shop?category=serums">Serums & essences</Link>
            <Link href="/shop?category=moisturizers">Moisturizers</Link>
            <Link href="/shop?category=oils">Face oils</Link>
          </div>
        </div>
        <div>
          <h3 className="eyebrow mb-6 text-ivory/55">Here to help</h3>
          <div className="flex flex-col items-start gap-4 text-xs">
            <Link href="/contact">Contact us</Link>
            <Link href="/faq">Common questions</Link>
            <Link href="/shipping">Shipping & delivery</Link>
            <Link href="/returns">Returns & care</Link>
            <Link href="/account/orders">Your orders</Link>
          </div>
        </div>
        <div>
          <h3 className="eyebrow mb-6 text-ivory/55">A closer look</h3>
          <div className="flex flex-col items-start gap-4 text-xs">
            <Link href="/about">Our philosophy</Link>
            <Link href="/routine">The ritual finder</Link>
            <Link href="/newsletter">Newsletter preferences</Link>
            <Link href="/privacy">Privacy policy</Link>
            <Link href="/terms">Terms of use</Link>
          </div>
        </div>
      </div>
      <div className="wrap flex flex-wrap justify-between gap-4 border-t border-ivory/20 py-6 text-[10px] tracking-wide text-ivory/60">
        <span>© 2026 VELA. Thoughtfully, every day.</span>
        <span>United States · USD $</span>
        <span>Fictional skincare collection · Test purchases only</span>
      </div>
    </footer>
  );
}
