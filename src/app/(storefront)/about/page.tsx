import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  alternates: { canonical: "/about" },
  title: "Our philosophy",
  description: "A considered collection. A quieter daily ritual. Discover the idea behind VELA.",
};

export default function AboutPage() {
  return (
    <main id="main">
      <section className="wrap grid items-center gap-12 py-14 md:grid-cols-2 md:gap-20 md:py-20">
        <div>
          <p className="eyebrow mb-7 text-olive/80">The VELA philosophy</p>
          <h1 className="display mb-8">
            Room for <em>a little care.</em>
          </h1>
          <p className="max-w-md text-sm leading-8 text-olive/80">
            The water is warm. The world can wait a moment. We imagine skincare as a small, familiar
            pleasure — something that belongs to you.
          </p>
          <p className="mt-5 max-w-md text-sm leading-8 text-olive/80">
            VELA brings together a considered collection and an uncomplicated way to find your daily
            ritual. A fresh beginning, a soft finish, and only the steps you want in between.
          </p>
          <Link href="/routine" className="text-link mt-5">
            Find your ritual <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="relative aspect-[4/5] overflow-hidden bg-sand">
          <Image
            src="/images/ritual-flatlay.webp"
            alt="VELA skincare arranged with soft linen and a handwritten thank-you card"
            fill
            sizes="(max-width:768px) 100vw, 45vw"
            loading="eager"
            className="object-cover"
          />
        </div>
      </section>
      <section className="border-y border-olive/15 bg-sand/35">
        <div className="wrap grid gap-10 py-16 md:grid-cols-3 md:gap-16 md:py-20">
          {[
            [
              "01",
              "A considered edit.",
              "Six fictional essentials, each with a clear place in a routine. Explore textures, ingredients, and the details that matter to you.",
            ],
            [
              "02",
              "Your pace, always.",
              "Two steps or a slower ritual. Our finder starts with your preferences and explains why each product makes the edit.",
            ],
            [
              "03",
              "Clarity is care.",
              "Straightforward product details, visible availability, and understandable choices. No invented reviews or promises of perfect skin.",
            ],
          ].map(([number, title, copy]) => (
            <div key={number}>
              <p className="eyebrow mb-8 text-olive/80">{number}</p>
              <h2 className="mb-5 font-display text-4xl">{title}</h2>
              <p className="mb-0 text-sm leading-7 text-olive/80">{copy}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="wrap grid items-center gap-12 py-16 md:grid-cols-[1.1fr_1fr] md:gap-24 md:py-24">
        <div className="relative aspect-[4/3] bg-sand">
          <Image
            src="/images/golden-hour-portrait.webp"
            alt="A quiet skincare moment in warm golden light"
            fill
            sizes="(max-width:768px) 100vw, 50vw"
            className="object-cover"
          />
        </div>
        <div>
          <p className="eyebrow mb-6 text-olive/80">A better ritual for everyday skin</p>
          <h2 className="section-title mb-7">
            Less hurry.
            <br />
            <em>More here.</em>
          </h2>
          <p className="mb-8 max-w-sm text-sm leading-7 text-olive/80">
            Discover the collection, read the details, and make a little space for yourself.
          </p>
          <Button asChild>
            <Link href="/shop">
              Explore the collection <ArrowUpRight size={15} />
            </Link>
          </Button>
        </div>
      </section>
      <div className="wrap border-t border-olive/15 py-8 text-xs leading-6 text-olive/80">
        VELA is a fictional skincare storefront built for test purchases. Products are not
        manufactured or dispatched. Product imagery is a packaging concept; the written catalog
        describes each fictional item.{" "}
        <Link href="/terms" className="underline underline-offset-4">
          About this test store
        </Link>
        .
      </div>
    </main>
  );
}
