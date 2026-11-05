import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { documentId } from "@/lib/validation/commerce";
import { getSession } from "@/server/auth";
import { getAdminCustomer } from "@/server/services/operations";
import { AdminPageHeading } from "@/components/admin/admin-ui";
import { operationDate } from "@/components/admin/operations-ui";
import { OrderTable } from "@/components/admin/order-table";

export const metadata: Metadata = { title: "Customer profile" };
export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await getSession())?.admin) return null;
  const { id } = await params;
  if (!documentId.safeParse(id).success) notFound();
  const result = await getAdminCustomer(id);
  if (!result) notFound();
  const { profile, orders } = result;
  return (
    <>
      <AdminPageHeading
        eyebrow="Customers / Profile"
        title={profile.name}
        description={profile.email}
        action={
          <Link
            href="/admin/customers"
            className="inline-flex items-center gap-2 text-xs underline underline-offset-4"
          >
            <ArrowLeft size={13} />
            All customers
          </Link>
        }
      />
      <div className="mb-7 grid items-start gap-6 xl:grid-cols-[300px_1fr]">
        <section className="min-w-0 border border-olive/10 bg-ivory p-6">
          <h2 className="mb-5 font-sans text-sm font-medium tracking-normal">Account details</h2>
          <dl className="mb-0 space-y-5 text-xs">
            <div>
              <dt className="mb-2 text-[10px] text-olive/80">Name</dt>
              <dd className="m-0">{profile.name}</dd>
            </div>
            <div>
              <dt className="mb-2 text-[10px] text-olive/80">Email</dt>
              <dd className="m-0 break-all">{profile.email}</dd>
            </div>
            <div>
              <dt className="mb-2 text-[10px] text-olive/80">Joined (UTC)</dt>
              <dd className="m-0 text-[11px]">{operationDate(profile.createdAt)}</dd>
            </div>
            <div>
              <dt className="mb-2 text-[10px] text-olive/80">Profile updated (UTC)</dt>
              <dd className="m-0 text-[11px]">{operationDate(profile.updatedAt)}</dd>
            </div>
          </dl>
        </section>
        <section className="min-w-0 border border-olive/10 bg-ivory p-6">
          <h2 className="mb-5 font-sans text-sm font-medium tracking-normal">Saved addresses</h2>
          {profile.addresses.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {profile.addresses.map((address, index) => (
                <div key={address.id} className="border border-olive/15 p-4">
                  <p className="mb-3 text-[9px] tracking-wider text-olive/80 uppercase">
                    Address {index + 1}
                  </p>
                  <address className="text-xs not-italic leading-7 text-olive/75">
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
                </div>
              ))}
            </div>
          ) : (
            <p className="mb-0 text-xs leading-6 text-olive/80">
              This customer hasn’t saved any addresses.
            </p>
          )}
        </section>
      </div>
      <section className="min-w-0 border border-olive/10 bg-ivory">
        <div className="border-b border-olive/10 px-5 py-5">
          <h2 className="mb-2 font-sans text-sm font-medium tracking-normal">Customer orders</h2>
          <p className="mb-0 text-[10px] text-olive/80">
            Recent orders recorded for this customer. Payment and fulfillment remain separate.
          </p>
        </div>
        <OrderTable orders={orders} showCustomer={false} />
        {result.ordersTruncated && (
          <p
            role="status"
            className="m-5 border-l-2 border-champagne bg-champagne/15 p-4 text-[11px] leading-6"
          >
            Showing the latest {result.ordersLimit} orders for this customer.{" "}
            <Link href="/admin/orders" className="underline underline-offset-4">
              Browse all orders
            </Link>{" "}
            to reach older records.
          </p>
        )}
      </section>
    </>
  );
}
