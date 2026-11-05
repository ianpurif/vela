import type { Metadata } from "next";
import { getCatalogRepository } from "@/server/repositories/catalog";
import { CartContent } from "@/components/cart/cart-content";

export const metadata: Metadata = {
  title: "Your bag",
  description: "Your VELA skincare essentials, all in one place.",
  robots: { index: false, follow: true },
};
export const dynamic = "force-dynamic";

export default async function CartPage() {
  const products = await getCatalogRepository().list();
  return (
    <main id="main" className="wrap py-12 pb-20 md:py-16 md:pb-28">
      <div className="mb-10 md:mb-14">
        <p className="eyebrow mb-5">A moment for yourself</p>
        <h1 className="mb-0 text-[64px] sm:text-[84px]">
          Your <em>bag.</em>
        </h1>
      </div>
      <CartContent products={products} />
    </main>
  );
}
