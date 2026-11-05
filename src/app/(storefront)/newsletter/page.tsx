import type { Metadata } from "next";
import Image from "next/image";
import { NewsletterForm } from "@/components/support/newsletter-form";

export const metadata: Metadata = {
  title: "Newsletter preferences",
  description:
    "Save or withdraw your interest in future VELA notes. Email delivery is not enabled in this test store.",
  robots: { index: false, follow: true },
};

export default function NewsletterPage() {
  return (
    <main
      id="main"
      className="wrap grid items-center gap-12 py-16 md:grid-cols-2 md:gap-24 md:py-24"
    >
      <div className="relative hidden aspect-[4/5] bg-sand md:block">
        <Image
          src="/images/botanical-still-life.webp"
          alt="A quiet botanical still life with skincare, blossoms, and warm stone"
          fill
          sizes="45vw"
          className="object-cover"
        />
      </div>
      <div className="max-w-lg">
        <p className="eyebrow mb-7 text-olive/80">At your own pace</p>
        <h1 className="display mb-8">
          A note
          <br />
          <em>from VELA.</em>
        </h1>
        <p className="mb-9 text-sm leading-7 text-olive/80">
          Save your interest in future collection notes and everyday rituals, or manage a signup you
          have already saved. Newsletter emails are not being sent from this test store.
        </p>
        <NewsletterForm />
      </div>
    </main>
  );
}
