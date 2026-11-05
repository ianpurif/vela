import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUpRight, Droplets, Leaf, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/products/product-card";
import { NewsletterForm } from "@/components/support/newsletter-form";
import { HomeMotion } from "@/components/animation/home-motion";
import { getCatalogRepository } from "@/server/repositories/catalog";

export default async function Home() {
  const repo = getCatalogRepository();
  const [products, content, categories] = await Promise.all([
    repo.list(),
    repo.content(),
    repo.categories(),
  ]);
  const featured = products
    .filter((p) =>
      content.featuredCategory ? p.category === content.featuredCategory : p.featured,
    )
    .slice(0, 3);
  const categoryImages = ["cleanser-texture", "serum-texture", "cream-texture", "evening-tide-oil"];
  return (
    <HomeMotion>
      <section className="hero-section relative grid min-h-[660px] grid-cols-[44%_56%] overflow-hidden max-md:grid-cols-1">
        <div className="relative z-10 flex flex-col justify-center py-16 pl-[max(48px,calc((100vw-1440px)/2))] pr-8 max-md:px-6 max-md:pb-12 max-md:pt-14">
          <p data-hero-detail className="eyebrow mb-8 text-olive/80">
            {content.heroEyebrow}
          </p>
          <h1 className="display max-w-xl">
            <span className="block overflow-hidden pb-1">
              <span data-hero-line className="block">
                {content.heroTitle}
              </span>
            </span>
            <span className="block overflow-hidden pb-2">
              <em data-hero-line className="block font-normal text-olive">
                {content.heroItalic}
              </em>
            </span>
          </h1>
          <p
            data-hero-detail
            className="mb-8 mt-7 max-w-[330px] text-[13px] leading-[1.9] text-olive/80"
          >
            {content.heroDescription}
          </p>
          <div data-hero-detail className="flex flex-wrap gap-4">
            <Button asChild>
              <Link href="/shop">
                Explore the collection <ArrowUpRight size={15} />
              </Link>
            </Button>
          </div>
          <a
            href="#essentials"
            className="mt-16 flex w-fit items-center gap-3 text-[9px] font-semibold uppercase tracking-[.18em] text-olive/65 max-md:mt-9"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-olive/20">
              <ArrowDown size={13} />
            </span>
            Less, but better.
          </a>
        </div>
        <div className="relative min-h-[660px] overflow-hidden max-md:min-h-[430px]">
          <Image
            data-hero-image
            src="/images/hero-ritual.webp"
            alt="Warm sunlight, botanical shadows, and a quiet skincare moment"
            fill
            priority
            sizes="(max-width: 768px) 100vw, 60vw"
            className="object-cover object-[62%_center]"
          />
          <div className="absolute bottom-7 left-7 right-7 flex justify-between border-t border-ivory/45 pt-4 text-[9px] uppercase tracking-[.18em] text-white">
            <span>The everyday collection</span>
            <span>Made for your moments</span>
          </div>
        </div>
      </section>
      <section className="border-y border-olive/10">
        <div className="wrap flex flex-wrap items-center justify-between gap-6 py-7 max-sm:justify-center">
          {[
            [Leaf, "Thoughtfully chosen ingredients"],
            [Droplets, "Skin-first essentials"],
            [Sun, "Simple, everyday rituals"],
          ].map(([Icon, label]) => {
            const Mark = Icon as typeof Leaf;
            return (
              <div
                key={String(label)}
                className="flex items-center gap-3 text-[10px] tracking-[.05em] text-olive/80"
              >
                <Mark size={17} strokeWidth={1.1} />
                {String(label)}
              </div>
            );
          })}
          <span className="font-display text-xl italic max-lg:hidden">
            A little less. A little better.
          </span>
        </div>
      </section>
      <section id="essentials" className="wrap section-space">
        <div className="mb-10 flex items-end justify-between gap-6">
          <div data-reveal>
            <p className="eyebrow mb-4 text-olive/70">Your daily essentials</p>
            <h2 className="section-title mb-0">
              The art of <em>less.</em>
            </h2>
          </div>
          <Link href="/shop" className="text-link shrink-0 max-sm:text-[9px]">
            Shop all <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-x-7 gap-y-10 sm:grid-cols-3">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
        {!featured.length && (
          <p className="text-sm text-olive/75">
            A new edit is taking shape.{" "}
            <Link className="underline underline-offset-4" href="/shop">
              Explore the full collection.
            </Link>
          </p>
        )}
      </section>
      <section className="bg-sand/50">
        <div className="wrap grid items-center gap-14 py-20 md:grid-cols-2 md:gap-24">
          <div data-parallax className="relative aspect-[4/4.6] overflow-hidden">
            <Image
              src="/images/cream-ritual.webp"
              alt="Taking a quiet moment to gently apply face cream"
              fill
              sizes="(max-width:768px) 100vw, 45vw"
              className="object-cover"
            />
            <span className="absolute bottom-5 left-5 text-[9px] uppercase tracking-[.16em] text-white">
              The beauty of taking your time.
            </span>
          </div>
          <div data-reveal className="max-w-lg">
            <p className="eyebrow mb-6 text-olive/70">Our philosophy</p>
            <h2 className="section-title">
              More than skincare.
              <br />
              <em>A moment for you.</em>
            </h2>
            <p className="mb-5 mt-7 max-w-sm text-[13px] leading-7 text-olive/80">
              In a world that asks for more, we believe in a little less. Fewer steps. Thoughtful
              ingredients. A ritual that fits your life, beautifully.
            </p>
            <p className="mb-8 max-w-sm text-[13px] leading-7 text-olive/80">
              VELA is an invitation to slow down, listen to your skin, and find joy in the everyday.
            </p>
            <Link href="/about" className="text-link">
              The VELA philosophy <ArrowUpRight size={15} />
            </Link>
            <div className="mt-14 flex items-center gap-4 border-t border-olive/20 pt-6">
              <span className="font-display text-[38px] italic text-olive">With care, always.</span>
            </div>
          </div>
        </div>
      </section>
      <section className="wrap section-space">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div data-reveal>
            <p className="eyebrow mb-4 text-olive/70">Meet your next ritual</p>
            <h2 className="section-title mb-0">
              A little care, <em>every step.</em>
            </h2>
          </div>
          <p className="max-w-[240px] text-xs leading-6 text-olive/70">
            From a fresh beginning to your evening exhale. Find what feels right.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
          {categories.map((category, i) => (
            <Link key={category.id} href={`/shop?category=${category.id}`} className="group">
              <div className="relative aspect-[4/5] overflow-hidden bg-sand">
                <Image
                  src={`/images/${categoryImages[i % categoryImages.length]}.webp`}
                  alt={category.description}
                  fill
                  sizes="(max-width:1024px) 45vw, 23vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <span className="absolute left-4 top-4 text-[9px] tracking-widest">0{i + 1}</span>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <h3 className="font-display text-2xl">{category.name}</h3>
                <ArrowUpRight size={17} strokeWidth={1.2} />
              </div>
            </Link>
          ))}
        </div>
      </section>
      <section className="relative isolate overflow-hidden bg-[#d9d7c9]">
        <div className="wrap grid min-h-[430px] items-center gap-12 py-16 md:grid-cols-[1.1fr_1fr]">
          <div data-reveal className="relative z-10">
            <p className="eyebrow mb-5 text-olive/70">The VELA ritual finder</p>
            <h2 className="section-title">{content.promotionTitle}</h2>
            <p className="my-6 max-w-sm text-[13px] leading-7 text-olive/80">
              {content.promotionText}
            </p>
            <Button asChild>
              <Link href="/routine">
                Find my ritual <ArrowRight size={15} />
              </Link>
            </Button>
            <p className="mt-4 text-[10px] text-olive/65">Two minutes, a little self-discovery.</p>
          </div>
          <div data-parallax className="relative aspect-[1.4] overflow-hidden">
            <Image
              src="/images/collection-travertine.webp"
              alt="A considered collection of VELA skincare on warm stone"
              fill
              sizes="(max-width:768px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>
      <section data-reveal className="wrap py-20 text-center">
        <p className="eyebrow mb-5 text-olive/70">A softer kind of beauty</p>
        <h2 className="mx-auto max-w-3xl font-display text-[clamp(36px,4vw,58px)] leading-[1.1]">
          Not another thing to do.
          <br />
          <em>A little thing to look forward to.</em>
        </h2>
        <Link href="/shop" className="text-link mt-6">
          Make it your ritual <ArrowUpRight size={15} />
        </Link>
      </section>
      <section className="border-t border-olive/15 bg-sand/35">
        <div className="wrap grid items-start gap-10 py-16 md:grid-cols-2 md:gap-24 md:py-20">
          <div data-reveal>
            <p className="eyebrow mb-5 text-olive/80">A little letter, now and then</p>
            <h2 className="section-title mb-6">
              Stay a little
              <br />
              <em>closer.</em>
            </h2>
            <p className="max-w-sm text-sm leading-7 text-olive/80">
              Save your interest in future collection notes and thoughtful everyday rituals.
              Newsletter delivery is not enabled in this test store.
            </p>
          </div>
          <div className="md:pt-6">
            <NewsletterForm />
          </div>
        </div>
      </section>
    </HomeMotion>
  );
}
