import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, ChevronDown, Check } from "lucide-react";
import { getCatalogRepository } from "@/server/repositories/catalog";
import { ProductGallery } from "@/components/products/product-gallery";
import { PurchaseControls } from "@/components/products/purchase-controls";
import { ProductCard } from "@/components/products/product-card";
import { money } from "@/lib/utils";

type Props = { params: Promise<{ slug: string }> };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getCatalogRepository().getBySlug(slug);
  if (!product || product.status !== "published") return { title: "Essential not found" };
  return {
    title: product.name,
    description: product.description,
    openGraph: {
      title: `${product.name} | VELA`,
      description: product.subtitle,
      images: product.images[0] ? [{ url: product.images[0].src, alt: product.images[0].alt }] : [],
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const repository = getCatalogRepository();
  const product = await repository.getBySlug(slug);
  if (!product || product.status !== "published") notFound();
  const allProducts = await repository.list();
  const related = allProducts
    .filter((candidate) => candidate.id !== product.id && candidate.status === "published")
    .sort(
      (a, b) =>
        Number(b.concerns.some((concern) => product.concerns.includes(concern))) -
          Number(a.concerns.some((concern) => product.concerns.includes(concern))) ||
        a.rank - b.rank,
    )
    .slice(0, 3);
  return (
    <>
      <section className="wrap pb-16 pt-7 md:pb-24 md:pt-9">
        <Link
          href="/shop"
          className="mb-7 inline-flex items-center gap-2 text-[10px] tracking-[.12em] text-olive/70 uppercase"
        >
          <ArrowLeft size={13} />
          Back to the essentials
        </Link>
        <div className="grid items-start gap-9 md:grid-cols-2 md:gap-12 lg:gap-20">
          <ProductGallery images={product.images} name={product.name} />
          <div className="md:py-6 lg:py-10">
            <p className="eyebrow mb-5 text-olive/65">
              {product.category.replaceAll("-", " ")} <span className="mx-2">/</span> The daily
              ritual
            </p>
            <h1 className="mb-4 text-[56px] sm:text-[68px] lg:text-[76px]">{product.name}</h1>
            <p className="mb-5 font-display text-[28px] italic leading-tight text-olive/75">
              {product.subtitle}
            </p>
            <p className="mb-7 flex items-center gap-4 text-sm">
              <span className="font-medium">{money(product.price)}</span>
              <span className="h-3 border-l border-olive/25" />
              <span className="text-xs text-olive/60">{product.size}</span>
            </p>
            <p className="mb-6 max-w-lg text-[13px] leading-7 text-olive/75">
              {product.description}
            </p>
            <ul className="mb-8 grid list-none gap-3 p-0">
              {product.benefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-3 text-xs leading-relaxed">
                  <Check size={14} strokeWidth={1.3} className="mt-0.5 shrink-0 text-sage" />
                  {benefit}
                </li>
              ))}
            </ul>
            <PurchaseControls product={product} />
            <div className="mt-9 border-t border-olive/20">
              <details open className="group border-b border-olive/20 py-5">
                <summary className="flex list-none items-center justify-between gap-4 text-[11px] font-semibold tracking-[.1em] uppercase">
                  The ritual
                  <ChevronDown size={15} className="transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-4 mb-0 text-xs leading-7 text-olive/75">{product.usage}</p>
              </details>
              <details className="group border-b border-olive/20 py-5">
                <summary className="flex list-none items-center justify-between gap-4 text-[11px] font-semibold tracking-[.1em] uppercase">
                  Ingredients
                  <ChevronDown size={15} className="transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-4 mb-0 text-xs leading-7 text-olive/75">
                  {product.ingredients.join(", ")}.
                </p>
              </details>
              <details className="group border-b border-olive/20 py-5">
                <summary className="flex list-none items-center justify-between gap-4 text-[11px] font-semibold tracking-[.1em] uppercase">
                  Made for your skin
                  <ChevronDown size={15} className="transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-4 mb-2 text-xs leading-7 text-olive/75">
                  Suited to {product.skinTypes.join(", ")} skin.{" "}
                  {product.fragranceFree
                    ? "Formulated without added fragrance."
                    : "Contains fragrance; patch test before use if your skin is sensitive."}
                </p>
                <p className="mb-0 text-xs leading-7 text-olive/75">
                  For cosmetic use. Introduce one new product at a time and discontinue use if
                  irritation occurs.
                </p>
              </details>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-[10px] tracking-[.05em] text-olive/65">
              <Link href="/shipping" className="underline underline-offset-4">
                Shipping details
              </Link>
              <Link href="/returns" className="underline underline-offset-4">
                Returns & care
              </Link>
              <Link href="/contact" className="underline underline-offset-4">
                A little guidance
              </Link>
            </div>
          </div>
        </div>
      </section>
      {related.length > 0 && (
        <section className="border-t border-olive/15 py-16 md:py-24">
          <div className="wrap">
            <div className="mb-9 flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="eyebrow mb-4">Good things go together</p>
                <h2 className="section-title mb-0">
                  Complete your <em>ritual.</em>
                </h2>
              </div>
              <Link href="/shop" className="text-link">
                Explore the collection
                <ArrowUpRight size={15} />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-7 lg:grid-cols-3">
              {related.map((candidate) => (
                <ProductCard key={candidate.id} product={candidate} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
