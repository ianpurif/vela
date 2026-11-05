"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function AnalyticsPeriod({ days }: { days: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div aria-busy={pending} className="min-w-[180px]">
      <label htmlFor="analytics-period" className="label">
        Reporting period
      </label>
      <select
        id="analytics-period"
        value={days}
        disabled={pending}
        onChange={(event) => {
          const value = event.target.value;
          startTransition(() => router.push(`/admin/analytics?days=${value}`, { scroll: false }));
        }}
        className="field bg-ivory py-3 text-xs"
      >
        <option value={7}>Last 7 UTC days</option>
        <option value={30}>Last 30 UTC days</option>
        <option value={90}>Last 90 UTC days</option>
      </select>
      {pending && (
        <span className="sr-only" role="status">
          Updating report…
        </span>
      )}
    </div>
  );
}
