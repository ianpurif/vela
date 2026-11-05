import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getSession } from "@/server/auth";
import { listAdminOrders } from "@/server/services/operations";
import { documentId } from "@/lib/validation/commerce";
import { AdminPageHeading } from "@/components/admin/admin-ui";
import { fulfillmentLabels, paymentLabels } from "@/components/admin/operations-ui";
import { OrderTable } from "@/components/admin/order-table";
import { OrderFilters } from "@/components/admin/order-filters";
import type { FulfillmentStatus, PaymentStatus } from "@/types/commerce";

export const metadata: Metadata = { title: "Orders" };
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    paymentStatus?: string | string[];
    fulfillmentStatus?: string | string[];
    after?: string | string[];
  }>;
}) {
  if (!(await getSession())?.admin) return null;
  const params = await searchParams;
  const paymentStatus =
    typeof params.paymentStatus === "string" && Object.hasOwn(paymentLabels, params.paymentStatus)
      ? (params.paymentStatus as PaymentStatus)
      : undefined;
  const fulfillmentStatus =
    typeof params.fulfillmentStatus === "string" &&
    Object.hasOwn(fulfillmentLabels, params.fulfillmentStatus)
      ? (params.fulfillmentStatus as FulfillmentStatus)
      : undefined;
  const after =
    typeof params.after === "string" && documentId.safeParse(params.after).success
      ? params.after
      : undefined;
  const result = await listAdminOrders({ paymentStatus, fulfillmentStatus, after });
  function pageUrl(cursor?: string | null) {
    const query = new URLSearchParams();
    if (paymentStatus) query.set("paymentStatus", paymentStatus);
    if (fulfillmentStatus) query.set("fulfillmentStatus", fulfillmentStatus);
    if (cursor) query.set("after", cursor);
    return `/admin/orders${query.size ? `?${query}` : ""}`;
  }
  return (
    <>
      <AdminPageHeading
        eyebrow="Customer orders"
        title="From ritual to doorstep."
        description="Review verified test payments and manage fulfillment separately. Payment status is set only by verified Stripe events."
      />
      <OrderFilters
        paymentStatus={paymentStatus || ""}
        fulfillmentStatus={fulfillmentStatus || ""}
      />
      <section className="min-w-0 border border-olive/10 bg-ivory">
        <OrderTable key={pageUrl(after)} orders={result.orders} searchable />
      </section>
      <nav
        aria-label="Order pages"
        className="mt-6 flex flex-wrap items-center justify-between gap-4 text-[11px]"
      >
        <div>
          {after && (
            <Link
              href={pageUrl()}
              className="inline-flex items-center gap-2 underline underline-offset-4"
            >
              <ArrowLeft size={13} />
              Most recent
            </Link>
          )}
        </div>
        <p className="mb-0 text-[10px] text-olive/55">
          Up to {result.limit} orders per page{result.next ? " · More orders available" : ""}
        </p>
        {result.next ? (
          <Link
            href={pageUrl(result.next)}
            className="inline-flex items-center gap-2 underline underline-offset-4"
          >
            Older orders
            <ArrowRight size={13} />
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </>
  );
}
