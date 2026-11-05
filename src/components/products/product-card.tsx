import Image from "next/image";
import Link from "next/link";
import { AddToCart } from "@/components/products/add-to-cart";
import { money, cn } from "@/lib/utils";
import type { Product } from "@/types/commerce";

export function ProductCard({ product, className }: { product: Product; className?: string }) {
  const image = product.images[0];
  const available = product.stock - product.reserved > 0;
  return (
    <article className={cn("group min-w-0", className)}>
      <Link
        href={`/products/${product.slug}`}
        className="relative block aspect-[4/5] overflow-hidden bg-sand/55"
        aria-label={`Discover ${product.name}`}
      >
        {image ? (
          <Image
            src={image.src}
            alt={image.alt}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 45vw, 30vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.035] motion-reduce:transition-none"
          />
        ) : (
          <div className="flex h-full items-center justify-center font-display text-5xl tracking-[.15em] text-olive/50">
            VELA
          </div>
        )}
        {!available && (
          <span className="absolute left-4 top-4 bg-ivory/95 px-3 py-2 text-[9px] tracking-[.13em] uppercase">
            Currently unavailable
          </span>
        )}
        {available && product.featured && (
          <span className="absolute left-4 top-4 bg-ivory/90 px-3 py-2 text-[9px] tracking-[.13em] uppercase">
            The VELA edit
          </span>
        )}
        <span className="absolute bottom-0 left-0 right-0 translate-y-full bg-ivory/90 py-4 text-center text-[10px] font-semibold tracking-[.15em] uppercase backdrop-blur-sm transition-transform duration-300 group-hover:translate-y-0 group-focus-within:translate-y-0 motion-reduce:transition-none">
          A closer look
        </span>
      </Link>
      <div className="flex items-start justify-between gap-3 pt-5">
        <div className="min-w-0">
          <p className="mb-2 text-[9px] tracking-[.16em] text-olive/65 uppercase">
            {product.category.replaceAll("-", " ")} <span className="px-1">/</span> {product.size}
          </p>
          <h3 className="mb-1 font-display text-[26px] leading-tight tracking-[-.02em] sm:text-[30px]">
            <Link href={`/products/${product.slug}`} className="hover:text-olive/70">
              {product.name}
            </Link>
          </h3>
          <p className="mb-3 text-[11px] leading-relaxed text-olive/70">{product.subtitle}</p>
          <p className="mb-0 text-xs font-medium">{money(product.price)}</p>
        </div>
        <AddToCart product={product} compact />
      </div>
    </article>
  );
}
