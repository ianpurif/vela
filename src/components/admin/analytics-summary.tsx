import { BadgeCheck, CreditCard, ShoppingBag, WalletCards } from "lucide-react";
import { money } from "@/lib/utils";
import { operationDate } from "@/components/admin/operations-ui";
import type { AdminAnalytics } from "@/types/operations";

export function AnalyticsMetrics({ analytics }: { analytics: AdminAnalytics }) {
  const { metrics } = analytics;
  const cards = [
    {
      label: "Verified revenue",
      value: money(metrics.revenue),
      detail: "Paid in this period · includes shipping",
      icon: CreditCard,
    },
    {
      label: "Paid orders",
      value: metrics.paidOrders.toLocaleString("en-US"),
      detail: "Verified Stripe test payments",
      icon: BadgeCheck,
    },
    {
      label: "Average order value",
      value: money(metrics.averageOrderValue),
      detail: "Verified revenue ÷ paid orders",
      icon: WalletCards,
    },
    {
      label: "Orders created",
      value: metrics.orders.toLocaleString("en-US"),
      detail: `${metrics.pendingOrders} still pending in this period`,
      icon: ShoppingBag,
    },
  ];
  return (
    <div className="mb-7 grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-5">
      {cards.map(({ label, value, detail, icon: Icon }) => (
        <section key={label} className="min-w-0 border border-olive/10 bg-ivory p-4 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-2">
            <h2 className="mb-0 font-sans text-[10px] font-medium tracking-normal text-olive/80">
              {label}
            </h2>
            <Icon size={16} strokeWidth={1.3} className="shrink-0 text-sage" />
          </div>
          <p className="mb-2 break-words text-[26px] font-medium leading-tight tracking-[-.04em] tabular-nums xl:text-[30px]">
            {value}
          </p>
          <p className="mb-0 text-[9px] leading-5 text-olive/80">{detail}</p>
        </section>
      ))}
    </div>
  );
}

export function AnalyticsScope({ analytics }: { analytics: AdminAnalytics }) {
  const { window, scope } = analytics;
  return (
    <div className="mb-7 space-y-3">
      <p className="mb-0 text-[10px] leading-6 text-olive/80">
        {operationDate(window.startAt)} – {operationDate(window.endAt)} UTC. Test-mode orders only.
        Revenue follows payment verification dates; orders created follows checkout creation dates.
      </p>
      {scope.truncated && (
        <p
          role="status"
          className="mb-0 border-l-2 border-champagne bg-champagne/15 p-4 text-[11px] leading-6 text-olive/75"
        >
          This report reached a query limit. Totals and rankings may be incomplete. Shorter periods
          can reduce order truncation; the catalog remains limited to 1,000 products.
        </p>
      )}
      <details className="text-[10px] leading-6 text-olive/80">
        <summary className="w-fit cursor-pointer underline underline-offset-4">
          Report scope and limits
        </summary>
        <p className="mt-2 mb-0">
          Reads up to {scope.orderLimit.toLocaleString("en-US")} orders created in the period,{" "}
          {scope.orderLimit.toLocaleString("en-US")} orders paid in the period, and{" "}
          {scope.productLimit.toLocaleString("en-US")} catalog products. This report read{" "}
          {scope.createdOrders.toLocaleString("en-US")} created orders,{" "}
          {scope.paidOrders.toLocaleString("en-US")} paid orders, and{" "}
          {scope.products.toLocaleString("en-US")} products. Bestseller totals exclude shipping.
          Stock is the current available quantity in the catalog sample.
        </p>
      </details>
    </div>
  );
}
