"use client";

import Image from "next/image";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import type { ProductImage } from "@/types/commerce";
import { cloudinaryDeliveryUrl } from "@/lib/cloudinary/delivery";

export function ProductGallery({ images, name }: { images: ProductImage[]; name: string }) {
  const [selected, setSelected] = useState(0);
  const reducedMotion = useReducedMotion();
  const image = images[selected] ?? images[0];
  return (
    <div>
      <div className="relative aspect-[4/5] overflow-hidden bg-sand/50">
        {image ? (
          <motion.div
            key={image.src}
            initial={{ opacity: reducedMotion ? 1 : 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0"
          >
            <Image
              src={cloudinaryDeliveryUrl(image.src, 1600)}
              alt={image.alt}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              preload={selected === 0}
              className="object-cover"
            />
          </motion.div>
        ) : (
          <div className="flex h-full items-center justify-center font-display text-7xl tracking-widest text-olive/45">
            VELA
          </div>
        )}
      </div>
      {images.length > 1 && (
        <div
          role="group"
          aria-label={`Images of ${name}`}
          className="mt-3 flex gap-3 overflow-x-auto pb-2"
        >
          {images.map((photo, index) => (
            <button
              key={`${photo.src}-${index}`}
              type="button"
              onClick={() => setSelected(index)}
              aria-label={`View image ${index + 1} of ${name}`}
              aria-pressed={selected === index}
              className={cn(
                "relative aspect-square w-20 shrink-0 overflow-hidden border-2 transition-opacity sm:w-24",
                selected === index
                  ? "border-olive"
                  : "border-transparent opacity-65 hover:opacity-100",
              )}
            >
              <Image
                src={cloudinaryDeliveryUrl(photo.src, 200)}
                alt={photo.alt}
                fill
                sizes="96px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
