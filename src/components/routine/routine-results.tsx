"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, PencilLine, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { concernLabels } from "@/features/catalog/filter";
import {
  fragranceLabels,
  lengthLabels,
  sensitivityLabels,
  skinTypeLabels,
  type RoutineAnswers,
  type RoutineResult,
} from "@/features/routine/matching";
import { prepareRoutineCart } from "@/features/routine/cart";
import { cloudinaryDeliveryUrl } from "@/lib/cloudinary/delivery";
import { cn, money } from "@/lib/utils";
import { useCart, useCartReady } from "@/stores/cart";

export function RoutineResults({
  answers,
  result,
  onEdit,
}: {
  answers: RoutineAnswers;
  result: RoutineResult;
  onEdit: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const ready = useCartReady();
  const items = useCart((state) => state.items);
  const addRoutine = useCart((state) => state.addRoutine);
  const setOpen = useCart((state) => state.setOpen);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState("");
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const products = result.recommendations.map((item) => item.product);
  const preview = ready ? prepareRoutineCart(items, products) : null;
  const issue = error || (!added && preview && !preview.ok ? preview.message : "");
  function add() {
    setError("");
    const outcome = addRoutine(products);
    if (!outcome.ok) {
      setError(outcome.message);
      return;
    }
    setAdded(true);
    setOpen(true);
  }
  const preferences = [
    skinTypeLabels[answers.skinType],
    answers.concerns.length
      ? answers.concerns.map((concern) => concernLabels[concern]).join(" + ")
      : "No particular focus",
    sensitivityLabels[answers.sensitivity],
    lengthLabels[answers.length],
    fragranceLabels[answers.fragrance],
  ];
  return (
    <motion.section
      initial={{ opacity: 0, y: reducedMotion ? 0 : 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.25 }}
      className="wrap py-12 pb-20 sm:py-16 sm:pb-28"
    >
      <div className="mb-10 flex flex-col justify-between gap-6 border-b border-olive/15 pb-8 lg:flex-row lg:items-end">
        <div className="max-w-3xl">
          <p className="eyebrow mb-4 text-olive/80">An edit, just for your preferences</p>
          <h1
            ref={heading}
            tabIndex={-1}
            className="mb-5 text-[52px] leading-[.95] outline-offset-8 sm:text-[76px]"
          >
            Your considered <em className="font-normal">ritual.</em>
          </h1>
          <p className="mb-6 max-w-xl text-xs leading-7 text-olive/80">
            {products.length
              ? "A few essentials, placed in a sensible order. Each choice below explains how it connects to your answers."
              : "We couldn’t find available products that match your choices in the current collection. You can revisit your answers or explore the collection at your own pace."}
          </p>
          <ul aria-label="Your preferences" className="m-0 flex list-none flex-wrap gap-2 p-0">
            {preferences.map((preference) => (
              <li
                key={preference}
                className="border border-olive/15 px-3 py-2 text-[11px] text-olive/80"
              >
                {preference}
              </li>
            ))}
          </ul>
        </div>
        <Button type="button" variant="outline" onClick={onEdit} className="self-start lg:self-end">
          <PencilLine size={13} />
          Edit answers
        </Button>
      </div>
      {result.missing.length > 0 && products.length > 0 && (
        <div role="status" className="mb-9 border-l-2 border-champagne bg-sand/35 px-5 py-4">
          <p className="mb-1 text-xs font-medium">
            {products.length} of {result.requestedSteps} requested steps matched.
          </p>
          <p className="mb-0 text-[11px] leading-6 text-olive/80">
            No available {result.missing.map((item) => item.name).join(" or ")} matched your
            preferences. Your edit includes only the {products.length}{" "}
            {products.length === 1 ? "product" : "products"} shown below.
          </p>
        </div>
      )}
      {products.length ? (
        <>
          <div
            className={cn(
              "grid gap-x-6 gap-y-10 sm:grid-cols-2",
              products.length === 3 && "lg:grid-cols-3",
              products.length === 4 && "xl:grid-cols-4",
              products.length <= 2 && "mx-auto max-w-4xl",
            )}
          >
            {result.recommendations.map((recommendation, index) => {
              const { product } = recommendation;
              const image = product.images[0];
              return (
                <article
                  key={product.id}
                  aria-label={`Step ${index + 1}: ${product.name}`}
                  className="min-w-0"
                >
                  <div className="mb-4 flex items-center justify-between border-b border-olive/20 pb-3">
                    <p className="mb-0 text-[11px] tracking-[.13em] uppercase">
                      {String(index + 1).padStart(2, "0")} / {recommendation.label}
                    </p>
                    <span className="text-[11px] tabular-nums">{money(product.price)}</span>
                  </div>
                  <div className="relative aspect-[4/5] overflow-hidden bg-sand/45">
                    {image ? (
                      <Image
                        src={cloudinaryDeliveryUrl(image.src, 900)}
                        alt={image.alt}
                        fill
                        sizes="(max-width: 640px) 90vw, (max-width: 1024px) 44vw, 30vw"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center font-display text-5xl tracking-[.15em] text-olive/80">
                        VELA
                      </div>
                    )}
                  </div>
                  <p className="mt-5 mb-2 text-[11px] tracking-[.12em] text-olive/80 uppercase">
                    {product.size}
                  </p>
                  <h2 className="mb-3 text-[32px] leading-tight">
                    <Link href={`/products/${product.slug}`} className="hover:underline">
                      {product.name}
                    </Link>
                  </h2>
                  <p className="mb-5 text-[11px] leading-6 text-olive/80">
                    {recommendation.description}
                  </p>
                  <ul aria-label={`Why ${product.name}`} className="m-0 list-none space-y-3 p-0">
                    {recommendation.reasons.map((reason) => (
                      <li
                        key={reason}
                        className="flex items-start gap-2 text-[11px] leading-6 text-olive/80"
                      >
                        <Check size={12} className="mt-1.5 shrink-0 text-sage" strokeWidth={1.6} />
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                  <details className="mt-5 border-t border-olive/15 pt-4">
                    <summary className="w-fit cursor-pointer text-[11px] underline underline-offset-4">
                      How to use
                    </summary>
                    <p className="mt-3 mb-0 text-[11px] leading-7 text-olive/80">{product.usage}</p>
                  </details>
                </article>
              );
            })}
          </div>
          <section
            aria-label="Add your routine"
            className="mt-12 grid items-center gap-6 border-y border-olive/20 py-7 lg:grid-cols-[1fr_auto]"
          >
            <div>
              <p className="eyebrow mb-3 text-olive/80">
                {products.length} considered {products.length === 1 ? "step" : "steps"}
              </p>
              <div className="mb-2 flex items-baseline gap-5">
                <h2 className="mb-0 text-[34px]">Routine subtotal</h2>
                <p className="mb-0 font-display text-4xl">{money(result.subtotal)}</p>
              </div>
              <p className="mb-0 text-[11px] leading-6 text-olive/80">
                Adds one of each product shown. Shipping and final availability are confirmed at
                checkout.
              </p>
            </div>
            <div className="max-w-md">
              <Button
                type="button"
                onClick={add}
                disabled={!ready || added || !preview?.ok}
                className="w-full"
              >
                <ShoppingBag size={14} />
                {added ? "Added to bag" : !ready ? "Loading your bag…" : "Add routine to bag"}
              </Button>
              {added && (
                <p role="status" className="mt-3 mb-0 text-center text-[11px] text-olive/80">
                  Your ritual is in the bag.
                </p>
              )}
              {issue && (
                <p role="alert" className="mt-3 mb-0 text-[11px] leading-6 text-[#8c4b32]">
                  {issue}
                </p>
              )}
              <Link
                href="/cart"
                className="mt-3 block text-center text-[11px] underline underline-offset-4"
              >
                View your bag
              </Link>
            </div>
          </section>
          <details className="mt-7 text-[11px] leading-7 text-olive/80">
            <summary className="w-fit cursor-pointer underline underline-offset-4">
              How this edit is chosen
            </summary>
            <p className="mt-3 mb-0 max-w-3xl">
              Each step uses an available product listed for your skin type. Matches to your
              selected concerns come first, with extra weight for skin comfort when you choose
              sometimes or often sensitive. Those sensitivity choices and a fragrance-free
              preference limit the edit to fragrance-free products. Equal matches follow the
              catalog’s order. These are catalog-based preferences, not an assessment of skin
              conditions.
            </p>
          </details>
        </>
      ) : (
        <div className="flex min-h-[220px] items-center justify-center border border-olive/15 bg-sand/20 p-8 text-center">
          <div>
            <h2 className="mb-5 text-4xl">A little space to reconsider.</h2>
            <Button asChild>
              <Link href="/shop">
                Explore all essentials
                <ArrowRight size={14} />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </motion.section>
  );
}
