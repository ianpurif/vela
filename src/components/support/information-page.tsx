import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

const links = [
  ["/faq", "Common questions"],
  ["/shipping", "Shipping & delivery"],
  ["/returns", "Returns & care"],
  ["/privacy", "Privacy policy"],
  ["/terms", "Terms of use"],
] as const;

export function InformationPage({
  title,
  description,
  path,
  children,
}: {
  title: string;
  description: string;
  path: string;
  children: ReactNode;
}) {
  return (
    <main id="main" className="wrap pb-24 pt-14 md:pb-32 md:pt-20">
      <header className="max-w-3xl pb-12 md:pb-16">
        <p className="eyebrow mb-6 text-olive/80">A little clarity</p>
        <h1 className="display mb-7">{title}</h1>
        <p className="mb-0 max-w-xl text-sm leading-7 text-olive/80">{description}</p>
      </header>
      <div className="grid gap-10 border-t border-olive/20 pt-10 md:grid-cols-[210px_minmax(0,720px)] md:gap-16 lg:gap-24">
        <aside>
          <nav
            aria-label="Customer care"
            className="flex flex-wrap gap-x-7 gap-y-2 md:flex-col md:items-start md:gap-3"
          >
            {links.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                aria-current={path === href ? "page" : undefined}
                className={`py-2 text-xs ${path === href ? "font-semibold underline underline-offset-8" : "text-olive/80 hover:underline"}`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </aside>
        <div>
          <div className="prose-vela text-sm leading-7 [&_a]:underline [&_a]:underline-offset-4 [&_h2:first-child]:mt-0 [&_li]:mb-2 [&_ul]:list-disc [&_ul]:pl-5">
            {children}
          </div>
          <div className="mt-14 border-t border-olive/20 pt-8">
            <p className="mb-2 font-display text-3xl">Still wondering?</p>
            <Link href="/contact" className="text-link">
              Leave us a note <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
