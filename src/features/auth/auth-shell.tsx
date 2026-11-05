import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

export function AuthShell({
  children,
  eyebrow,
  title,
  description,
}: {
  children: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <main
      id="main"
      className="wrap grid gap-12 py-10 md:min-h-[760px] md:grid-cols-2 md:items-center md:gap-16 md:py-14 lg:gap-24"
    >
      <div className="relative hidden h-full min-h-[640px] overflow-hidden bg-sand md:block">
        <Image
          src="/images/cream-ritual.webp"
          alt="A quiet moment of daily skincare"
          fill
          loading="eager"
          sizes="45vw"
          className="object-cover"
        />
        <div className="absolute inset-x-5 bottom-5 bg-olive/85 p-8 text-ivory">
          <p className="eyebrow mb-4">A little care, every day.</p>
          <p className="mb-0 max-w-xs font-display text-5xl leading-none">
            A softer pace.
            <br />
            <em>A space for you.</em>
          </p>
        </div>
      </div>
      <div className="mx-auto w-full max-w-md py-3 md:py-8">
        <Link
          href="/shop"
          className="mb-9 inline-flex items-center gap-2 text-[10px] tracking-[.1em] text-olive/80 uppercase"
        >
          <ArrowLeft size={13} />
          Back to the essentials
        </Link>
        <p className="eyebrow mb-5">{eyebrow}</p>
        <h1 className="mb-5 text-[58px] sm:text-[68px]">{title}</h1>
        <p className="mb-8 text-xs leading-7 text-olive/80">{description}</p>
        {children}
      </div>
    </main>
  );
}
