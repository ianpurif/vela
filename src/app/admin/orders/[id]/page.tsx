import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/server/auth";
import { getAdminOrder } from "@/server/services/operations";
import { documentId } from "@/lib/validation/commerce";
import { AdminPageHeading } from "@/components/admin/admin-ui";
import { FulfillmentForm } from "@/components/admin/fulfillment-form";
import { operationDate, PaymentBadge } from "@/components/admin/operations-ui";
import { money } from "@/lib/utils";

export const metadata: Metadata = { title: "Order details" };
export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await getSession())?.admin) return null;
  const { id } = await params;
  if (!documentId.safeParse(id).success) notFound();
  const order = await getAdminOrder(id);
  if (!order) notFound();
  const address = order.shippingAddress;
  return (
    <>
      <AdminPageHeading
        eyebrow="Orders / Detail"
        title={`Order ${order.id.slice(-10)}`}
        description={`Created ${operationDate(order.createdAt)} UTC. All amounts are USD.`}
        action={
          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-2 text-xs underline underline-offset-4"
          >
            <ArrowLeft size={13} />
            All orders
          </Link>
        }
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <section className="border border-olive/10 bg-ivory">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-olive/10 p-5">
              <h2 className="mb-0 font-sans text-sm font-medium tracking-normal">Order items</h2>
              <span className="text-[10px] text-olive/55">
                {order.lines.reduce((sum, line) => sum + line.quantity, 0)} items
              </span>
            </div>
            <div
              className="relative overflow-x-auto"
              role="region"
              aria-label="Order items and prices"
              tabIndex={0}
            >
              <table className="w-full min-w-[500px] border-collapse text-left text-xs">
                <thead className="border-b border-olive/10 text-[9px] text-olive/55 uppercase">
                  <tr>
                    <th className="px-5 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 text-right font-medium">Unit price</th>
                    <th className="px-4 py-3 text-right font-medium">Qty</th>
                    <th className="px-5 py-3 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-olive/10">
                  {order.lines.map((line) => (
                    <tr key={line.productId}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {line.image && (
                            <Image
                              src={line.image}
                              alt=""
                              width={48}
                              height={60}
                              className="h-[60px] w-12 bg-sand/20 object-cover"
                            />
                          )}
                          <span className="max-w-[180px] font-medium">{line.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums">{money(line.unitPrice)}</td>
                      <td className="px-4 py-4 text-right tabular-nums">{line.quantity}</td>
                      <td className="px-5 py-4 text-right tabular-nums">
                        {money(line.unitPrice * line.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="ml-auto mb-0 max-w-[310px] space-y-3 px-5 py-6 text-xs">
              <div className="flex justify-between gap-5">
                <dt className="text-olive/60">Subtotal</dt>
                <dd className="m-0 tabular-nums">{money(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-5">
                <dt className="text-olive/60">Shipping</dt>
                <dd className="m-0 tabular-nums">{money(order.shipping)}</dd>
              </div>
              <div className="flex justify-between gap-5 border-t border-olive/15 pt-4 font-semibold">
                <dt>Total</dt>
                <dd className="m-0 tabular-nums">{money(order.total)}</dd>
              </div>
            </dl>
          </section>
          <div className="grid gap-6 sm:grid-cols-2">
            <section className="min-w-0 border border-olive/10 bg-ivory p-6">
              <h2 className="mb-4 font-sans text-sm font-medium tracking-normal">Customer</h2>
              <p className="mb-3 break-all text-xs leading-6">{order.email}</p>
              <Link
                href={`/admin/customers/${order.userId}`}
                className="text-[10px] underline underline-offset-4"
              >
                View customer profile
              </Link>
            </section>
            <section className="min-w-0 border border-olive/10 bg-ivory p-6">
              <h2 className="mb-4 font-sans text-sm font-medium tracking-normal">
                Shipping address
              </h2>
              {address ? (
                <address className="break-words text-xs not-italic leading-7 text-olive/75">
                  {address.name}
                  <br />
                  {address.line1}
                  <br />
                  {address.line2 && (
                    <>
                      {address.line2}
                      <br />
                    </>
                  )}
                  {address.city}, {address.state} {address.postalCode}
                  <br />
                  {address.country}
                </address>
              ) : (
                <p className="mb-0 text-xs leading-6 text-olive/60">
                  A shipping address has not been confirmed for this order.
                </p>
              )}
            </section>
          </div>
        </div>
        <aside className="min-w-0 space-y-6">
          <section className="border border-olive/10 bg-ivory p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="mb-0 font-sans text-sm font-medium tracking-normal">Payment</h2>
              <PaymentBadge status={order.paymentStatus} />
            </div>
            <p className="mb-4 text-[11px] leading-6 text-olive/65">
              {order.paymentStatus === "paid"
                ? "Payment was verified through Stripe. This test order is ready for fulfillment."
                : order.paymentStatus === "pending"
                  ? "Waiting for payment confirmation. Starting or returning from checkout does not confirm a payment."
                  : "This checkout did not complete a verified payment. Fulfillment is unavailable."}
            </p>
            {order.paidAt && (
              <p className="mb-4 text-[10px] leading-5 text-olive/60">
                Verified {operationDate(order.paidAt)} UTC
              </p>
            )}
            <p className="mb-0 border-t border-olive/10 pt-4 text-[9px] tracking-wider text-olive/55 uppercase">
              Stripe test mode
            </p>
          </section>
          <FulfillmentForm key={`${order.id}:${order.paymentStatus}`} order={order} />
          <section className="border border-olive/10 bg-ivory p-6">
            <h2 className="mb-4 font-sans text-sm font-medium tracking-normal">Order reference</h2>
            <p className="mb-3 break-all font-mono text-[10px] leading-6 text-olive/65">
              {order.id}
            </p>
            <p className="mb-0 text-[10px] leading-5 text-olive/55">
              Updated {operationDate(order.updatedAt)} UTC
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
