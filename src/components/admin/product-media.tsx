import Image from "next/image";
import type { Product } from "@/types/commerce";

/** Shared gallery extension point: Phase 5 adds signed Cloudinary operations here. */
export function ProductMedia({ product }: { product: Product }) {
  return (
    <section className="border border-olive/10 bg-ivory p-6">
      <h2 className="mb-2 font-sans text-sm font-medium tracking-normal">Product gallery</h2>
      <p className="mb-5 text-[11px] leading-6 text-olive/65">
        Images currently attached to this essential.
      </p>
      {product.images.length ? (
        <div className="grid grid-cols-3 gap-3">
          {product.images.map((image, index) => (
            <div
              key={`${image.src}-${index}`}
              className="relative aspect-[4/5] overflow-hidden bg-sand/40"
            >
              <Image
                src={image.src}
                alt={image.alt}
                fill
                sizes="(max-width: 768px) 30vw, 120px"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-0 border border-dashed border-olive/20 p-6 text-center text-xs text-olive/55">
          No product images attached.
        </p>
      )}
    </section>
  );
}
