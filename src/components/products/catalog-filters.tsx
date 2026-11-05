"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { useTransition, type FormEvent } from "react";
import {
  catalogHref,
  concernLabels,
  sortLabels,
  type CatalogFilters,
} from "@/features/catalog/filter";
import { cn } from "@/lib/utils";
import type { Category } from "@/types/commerce";

export function CatalogFilterBar({
  categories,
  filters,
  count,
}: {
  categories: Category[];
  filters: CatalogFilters;
  count: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const hasFilters = filters.q || filters.category || filters.concern || filters.available;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = catalogHref(filters, {
      q: String(data.get("q") ?? "")
        .trim()
        .slice(0, 100),
      concern: String(data.get("concern") ?? ""),
      sort: String(data.get("sort") ?? "featured") as CatalogFilters["sort"],
      available: data.get("available") === "1",
    });
    startTransition(() => router.push(next, { scroll: false }));
  }
  return (
    <div className="mb-9">
      <nav
        aria-label="Product categories"
        className="mb-7 flex flex-wrap gap-x-7 gap-y-2 border-b border-olive/15"
      >
        {[{ id: "", name: "All essentials" }, ...categories].map((category) => (
          <Link
            key={category.id}
            href={catalogHref(filters, { category: category.id })}
            scroll={false}
            aria-current={filters.category === category.id ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 py-4 text-[11px] tracking-[.06em] transition-colors",
              filters.category === category.id
                ? "border-olive text-olive"
                : "border-transparent text-olive/65 hover:border-olive/30 hover:text-olive",
            )}
          >
            {category.name}
          </Link>
        ))}
      </nav>
      <form
        onSubmit={submit}
        action="/shop"
        method="get"
        aria-label="Filter products"
        aria-busy={pending}
        className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-[1.25fr_1fr_1fr_auto]"
      >
        <input type="hidden" name="category" value={filters.category} />
        <div>
          <label htmlFor="product-search" className="label">
            Find your essential
          </label>
          <div className="relative">
            <input
              id="product-search"
              key={filters.q}
              type="search"
              name="q"
              defaultValue={filters.q}
              placeholder="Search products or ingredients"
              maxLength={100}
              className="field pr-12 text-xs"
            />
            <button
              type="submit"
              aria-label="Search products"
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center hover:bg-olive/5"
            >
              <Search size={17} strokeWidth={1.4} />
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="product-concern" className="label">
            Skin concern
          </label>
          <select
            id="product-concern"
            name="concern"
            key={filters.concern}
            defaultValue={filters.concern}
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
            className="field text-xs"
          >
            <option value="">Every concern</option>
            {Object.entries(concernLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="product-sort" className="label">
            Sort by
          </label>
          <select
            id="product-sort"
            name="sort"
            key={filters.sort}
            defaultValue={filters.sort}
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
            className="field text-xs"
          >
            {Object.entries(sortLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <label className="flex min-h-12 items-center gap-3 text-xs lg:pl-4">
          <input
            type="checkbox"
            name="available"
            value="1"
            key={String(filters.available)}
            defaultChecked={filters.available}
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
            className="h-4 w-4 accent-olive"
          />
          In stock only
        </label>
      </form>
      <div className="mt-6 flex min-h-6 items-center justify-between gap-4 text-xs text-olive/65">
        <p className="mb-0" aria-live="polite" aria-atomic="true">
          {pending
            ? "Finding your essentials…"
            : `${count} ${count === 1 ? "essential" : "essentials"}${filters.q ? ` for “${filters.q}”` : " for your everyday ritual"}`}
        </p>
        {hasFilters && (
          <Link
            href="/shop"
            scroll={false}
            className="inline-flex shrink-0 items-center gap-2 border-b border-olive/40 pb-1 text-olive"
          >
            <X size={12} />
            Clear filters
          </Link>
        )}
      </div>
    </div>
  );
}
