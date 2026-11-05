import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getCatalogRepository } from "@/server/repositories/catalog";
import { ProductCard } from "@/components/products/product-card";
import { CatalogFilterBar } from "@/components/products/catalog-filters";
import { filterProducts, parseCatalogFilters, type SearchValues } from "@/features/catalog/filter";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  alternates: { canonical: "/shop" },
  title: "The essentials",
  description:
    "Thoughtful skincare for an everyday ritual. Explore VELA cleansers, serums, creams, oils and essences.",
};
export const dynamic = "force-dynamic";

export default async function ShopPage({ searchParams }: { searchParams: Promise<SearchValues> }) {
  const repository = getCatalogRepository();
  const [products, categories, values] = await Promise.all([
    repository.list(),
    repository.categories(),
    searchParams,
  ]);
  const filters = parseCatalogFilters(values);
  const visible = filterProducts(products, filters);
  return (
    <main id="main">
      <section className="border-b border-olive/10 bg-sand/30">
        <div className="wrap grid gap-8 py-12 md:grid-cols-[1fr_.7fr] md:items-center md:py-16">
          <div>
            <p className="eyebrow mb-5">Considered care. Everyday ease.</p>
            <h1 className="mb-5 text-[60px] sm:text-[80px]">
              The <em className="font-normal">essentials.</em>
            </h1>
            <p className="mb-0 max-w-md text-[13px] leading-7 text-olive/75">
              A little less noise. A little more intention. Discover the formulas that make taking
              care of your skin feel like taking care of yourself.
            </p>
          </div>
          <div className="relative hidden aspect-[2.4/1] overflow-hidden md:block">
            <Image
              src="/images/collection-sunlight.webp"
              alt="VELA skincare arranged in warm botanical light"
              fill
              sizes="40vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>
      <section className="wrap py-10 pb-20 md:py-12 md:pb-28" aria-label="Shop skincare">
        <CatalogFilterBar categories={categories} filters={filters} count={visible.length} />
        {visible.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-7 lg:grid-cols-3 lg:gap-y-14">
            {visible.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="border-y border-olive/15 px-5 py-20 text-center">
            <p className="eyebrow mb-4">A fresh start</p>
            <h2 className="mb-4 text-5xl">No essentials found.</h2>
            <p className="mb-7 text-sm text-olive/70">
              Try a different ingredient or give your filters a little room.
            </p>
            <Button asChild>
              <Link href="/shop">Explore all essentials</Link>
            </Button>
          </div>
        )}
        <div className="mt-16 flex flex-col justify-between gap-6 border-t border-olive/20 pt-8 sm:flex-row sm:items-center">
          <p className="mb-0 font-display text-3xl">
            A ritual that feels like <em>you.</em>
          </p>
          <Link href="/routine" className="text-link self-start">
            Find your routine <ArrowUpRight size={16} />
          </Link>
        </div>
      </section>
    </main>
  );
}
