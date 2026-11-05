"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type FormEvent } from "react";
import { fulfillmentLabels, paymentLabels } from "@/components/admin/operations-ui";
import { Button } from "@/components/ui/button";

export function OrderFilters({
  paymentStatus,
  fulfillmentStatus,
}: {
  paymentStatus: string;
  fulfillmentStatus: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const field of ["paymentStatus", "fulfillmentStatus"]) {
      const value = String(data.get(field) || "");
      if (value) params.set(field, value);
    }
    startTransition(() =>
      router.push(`/admin/orders${params.size ? `?${params}` : ""}`, { scroll: false }),
    );
  }
  return (
    <form
      action="/admin/orders"
      method="get"
      onSubmit={submit}
      aria-label="Filter orders"
      aria-busy={pending}
      className="mb-6 flex flex-wrap items-end gap-4"
    >
      <div className="min-w-[180px] flex-1 sm:max-w-[240px]">
        <label htmlFor="order-payment-filter" className="label">
          Payment status
        </label>
        <select
          id="order-payment-filter"
          key={paymentStatus}
          name="paymentStatus"
          defaultValue={paymentStatus}
          className="field py-3 text-xs"
        >
          <option value="">All payment states</option>
          {Object.entries(paymentLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-[180px] flex-1 sm:max-w-[240px]">
        <label htmlFor="order-fulfillment-filter" className="label">
          Fulfillment status
        </label>
        <select
          id="order-fulfillment-filter"
          key={fulfillmentStatus}
          name="fulfillmentStatus"
          defaultValue={fulfillmentStatus}
          className="field py-3 text-xs"
        >
          <option value="">All fulfillment states</option>
          {Object.entries(fulfillmentLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Applying…" : "Apply filters"}
      </Button>
      {(paymentStatus || fulfillmentStatus) && (
        <Link href="/admin/orders" className="py-3 text-[10px] underline underline-offset-4">
          Clear filters
        </Link>
      )}
      {pending && (
        <p role="status" className="mb-0 py-3 text-[10px] text-olive/80">
          Loading orders…
        </p>
      )}
    </form>
  );
}
