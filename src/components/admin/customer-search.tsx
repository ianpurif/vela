"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type FormEvent } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CustomerSearch({ query }: { query: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = String(new FormData(event.currentTarget).get("q") || "").trim();
    startTransition(() =>
      router.push(`/admin/customers${query ? `?q=${encodeURIComponent(query)}` : ""}`, {
        scroll: false,
      }),
    );
  }
  return (
    <form
      action="/admin/customers"
      method="get"
      onSubmit={submit}
      aria-busy={pending}
      className="mb-6 flex flex-wrap items-end gap-3"
    >
      <div className="min-w-[220px] flex-1 sm:max-w-md">
        <label htmlFor="customer-search" className="label">
          Find a customer
        </label>
        <input
          id="customer-search"
          key={query}
          name="q"
          type="search"
          defaultValue={query}
          maxLength={100}
          placeholder="Start of a name or email address"
          className="field text-xs"
        />
        <p className="mt-2 mb-0 text-[10px] text-olive/55">
          Search is case-insensitive and matches the beginning of a name or email.
        </p>
      </div>
      <Button type="submit" disabled={pending} className="mb-6">
        <Search size={14} />
        {pending ? "Searching…" : "Search customers"}
      </Button>
      {query && (
        <Link
          href="/admin/customers"
          className="mb-6 py-3 text-[10px] underline underline-offset-4"
        >
          Clear search
        </Link>
      )}
    </form>
  );
}
