import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Plus, TriangleAlert } from "lucide-react";
import { getSession } from "@/server/auth";
import { getAdminAnalytics } from "@/server/services/operations";
import { AdminPageHeading } from "@/components/admin/admin-ui";
import { AnalyticsMetrics, AnalyticsScope } from "@/components/admin/analytics-summary";
import { RevenueChart } from "@/components/admin/analytics-charts";
import { OrderTable } from "@/components/admin/order-table";
import { ReservationRecovery } from "@/components/admin/reservation-recovery";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Overview" };
export default async function AdminOverviewPage() {
  if (!(await getSession())?.admin) return null;
  const analytics = await getAdminAnalytics(30);
  return (
    <>
      <AdminPageHeading
        eyebrow="The daily overview"
        title="A clear view of your store."
        description="The last 30 UTC days of verified payments and order activity, with stock and checkout tasks that need your attention."
        action={
          <Button asChild>
            <Link href="/admin/products/new">
              <Plus size={15} />
              New product
            </Link>
          </Button>
        }
      />
      <AnalyticsMetrics analytics={analytics} />
      <AnalyticsScope analytics={analytics} />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
          <RevenueChart trend={analytics.trend} />
          <section className="min-w-0 border border-olive/10 bg-ivory">
            <div className="flex items-center justify-between gap-4 border-b border-olive/10 px-5 py-5">
              <div>
                <h2 className="mb-2 font-sans text-sm font-medium tracking-normal">
                  Recent orders
                </h2>
                <p className="mb-0 text-[10px] text-olive/55">
                  The ten most recent orders created in this period.
                </p>
              </div>
              <Link
                href="/admin/orders"
                className="inline-flex shrink-0 items-center gap-2 text-[10px] text-olive/65"
              >
                View all
                <ArrowUpRight size={13} />
              </Link>
            </div>
            <OrderTable orders={analytics.recentOrders} />
          </section>
        </div>
        <aside className="min-w-0 space-y-6">
          <section className="border border-olive/10 bg-ivory p-6">
            <div className="mb-4 flex items-center gap-2">
              <TriangleAlert size={16} strokeWidth={1.4} className="text-sage" />
              <h2 className="mb-0 font-sans text-sm font-medium tracking-normal">Stock to watch</h2>
            </div>
            <p className="mb-4 text-[10px] leading-6 text-olive/55">
              Up to ten published products with five or fewer units available.{" "}
              {analytics.metrics.products.toLocaleString("en-US")} catalog products included.
            </p>
            {analytics.lowStock.length ? (
              <ul className="m-0 list-none divide-y divide-olive/10 p-0">
                {analytics.lowStock.map((product) => (
                  <li
                    key={product.id}
                    className="flex items-center justify-between gap-3 py-3 text-[11px]"
                  >
                    <Link href={`/admin/products/${product.id}`} className="hover:underline">
                      {product.name}
                    </Link>
                    <span className="font-semibold tabular-nums text-[#8c4b32]">
                      {Math.max(0, product.stock - product.reserved)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-0 text-xs leading-6 text-olive/65">
                No low-stock published products in this catalog view.
              </p>
            )}
            <Link
              href="/admin/inventory"
              className="mt-5 inline-flex items-center gap-2 text-[10px] underline underline-offset-4"
            >
              Manage inventory
              <ArrowRight size={12} />
            </Link>
          </section>
          <ReservationRecovery />
          <section className="bg-olive p-6 text-ivory">
            <p className="eyebrow mb-4 text-ivory/55">A closer look</p>
            <h2 className="mb-4 text-4xl">Follow the details.</h2>
            <p className="mb-5 text-xs leading-6 text-ivory/70">
              Compare reporting periods, review daily sales, and see which essentials customers
              choose.
            </p>
            <Link
              href="/admin/analytics"
              className="inline-flex items-center gap-2 text-[10px] tracking-wider underline underline-offset-4 uppercase"
            >
              Explore analytics
              <ArrowUpRight size={13} />
            </Link>
          </section>
        </aside>
      </div>
    </>
  );
}
