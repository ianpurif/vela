import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSession } from "@/server/auth";
import { listCustomerOrderPage } from "@/server/services/orders";
import { AppError } from "@/lib/errors";
import { money } from "@/lib/utils";

export const metadata: Metadata = { title: "Your orders", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ after?: string | string[] }>;
}) {
  const user = await getSession();
  if (!user) redirect("/sign-in?returnTo=%2Faccount%2Forders");
  const { after } = await searchParams;
  const page = await listCustomerOrderPage(
    user.uid,
    typeof after === "string" ? after : undefined,
  ).catch((error: unknown) => {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  });
  return (
    <main id="main" className="wrap py-12 pb-24 md:py-16 md:pb-28">
      <Link
        href="/account"
        className="mb-10 inline-flex items-center gap-2 text-xs underline-offset-4 hover:underline"
      >
        <ArrowLeft size={14} />
        Your account
      </Link>
      <div className="mb-12 flex flex-wrap items-end justify-between gap-5 border-b border-olive/20 pb-8">
        <div>
          <p className="eyebrow mb-5">A little care, on record</p>
          <h1 className="section-title mb-0">
            Your <em>orders.</em>
          </h1>
        </div>
        <p className="mb-0 max-w-xs text-xs leading-6 text-olive/75">
          Every purchase here is a test order. No real charge or delivery is created.
        </p>
      </div>
      {!page.orders.length ? (
        <div className="py-12 text-center">
          <Package size={38} strokeWidth={1} className="mx-auto mb-6" />
          <h2 className="mb-5 font-display text-4xl">Your first ritual is waiting.</h2>
          <p className="mb-8 text-sm text-olive/75">
            Your test purchases will appear here, from checkout to their final step.
          </p>
          <Button asChild>
            <Link href="/shop">
              Discover your essentials
              <ArrowRight size={15} />
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="m-0 list-none divide-y divide-olive/15 p-0">
          {page.orders.map((order) => (
            <li key={order.id} className="grid gap-5 py-7 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <h2 className="mb-0 font-display text-3xl">
                    Order {order.id.slice(-8).toUpperCase()}
                  </h2>
                  <span className="rounded-full bg-sand/55 px-3 py-1 text-[11px] capitalize">
                    {order.paymentStatus === "paid" ? "Verified test payment" : order.paymentStatus}
                  </span>
                </div>
                <p className="mb-2 text-xs leading-6 text-olive/75">
                  <time dateTime={new Date(order.createdAt).toISOString()}>
                    {new Intl.DateTimeFormat("en-US", {
                      dateStyle: "long",
                      timeZone: "UTC",
                    }).format(order.createdAt)}
                  </time>
                  <span className="mx-3">·</span>
                  {order.lines.reduce((sum, line) => sum + line.quantity, 0)} essentials
                  <span className="mx-3">·</span>
                  {money(order.total)}
                </p>
                <p className="mb-0 max-w-2xl text-xs leading-6 text-olive/75">
                  {order.lines.map((line) => line.name).join(" · ")}
                </p>
                {order.paymentStatus === "paid" && (
                  <p className="mt-2 mb-0 text-xs capitalize">
                    {order.fulfillmentStatus === "unfulfilled"
                      ? "Awaiting preparation"
                      : order.fulfillmentStatus}
                    {order.trackingNumber && ` · Tracking: ${order.trackingNumber}`}
                  </p>
                )}
              </div>
              <Button asChild variant="outline">
                <Link
                  href={`/account/orders/${order.id}`}
                  aria-label={`View order ${order.id.slice(-8).toUpperCase()}`}
                >
                  View order
                  <ArrowRight size={14} />
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
      {(page.next || after) && (
        <nav
          aria-label="Order history pages"
          className="mt-10 flex flex-wrap justify-between gap-4 border-t border-olive/15 pt-7"
        >
          {after ? (
            <Link href="/account/orders" className="text-link">
              <ArrowLeft size={14} />
              Most recent orders
            </Link>
          ) : (
            <span />
          )}
          {page.next && (
            <Link
              href={`/account/orders?after=${encodeURIComponent(page.next)}`}
              className="text-link"
            >
              Older orders
              <ArrowRight size={14} />
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}
