import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/server/auth";
import { listAdminCustomers } from "@/server/services/operations";
import { AdminPageHeading } from "@/components/admin/admin-ui";
import { CustomerSearch } from "@/components/admin/customer-search";
import { LimitNotice, operationDate } from "@/components/admin/operations-ui";

export const metadata: Metadata = { title: "Customers" };
export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  if (!(await getSession())?.admin) return null;
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim().slice(0, 100) : "";
  const result = await listAdminCustomers(query);
  return (
    <>
      <AdminPageHeading
        eyebrow="Customer care"
        title="The people behind the rituals."
        description="Find customer profiles and review their orders. Personal details are available only to authorized store administrators."
      />
      <CustomerSearch query={query} />
      <LimitNotice truncated={result.truncated} limit={result.limit} kind="customers" />
      <section className="min-w-0 border border-olive/10 bg-ivory">
        <div className="border-b border-olive/10 px-5 py-4">
          <p className="mb-0 text-[10px] text-olive/80">
            {result.customers.length} {result.customers.length === 1 ? "customer" : "customers"}
            {query ? ` matching “${query}”` : " in this view"}
          </p>
        </div>
        <div
          className="relative overflow-x-auto"
          role="region"
          aria-label="Customer profiles"
          tabIndex={0}
        >
          <table className="w-full min-w-[650px] border-collapse text-left text-xs">
            <thead className="border-b border-olive/10 bg-sand/15 text-[9px] tracking-wider text-olive/80 uppercase">
              <tr>
                <th className="px-5 py-3.5 font-medium">Customer</th>
                <th className="px-4 py-3.5 font-medium">Email</th>
                <th className="px-4 py-3.5 font-medium">Joined (UTC)</th>
                <th className="px-4 py-3.5 text-right font-medium">Saved addresses</th>
                <th className="sticky right-0 bg-ivory px-5 py-3.5">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-olive/10">
              {result.customers.map((customer) => (
                <tr key={customer.id} className="hover:bg-sand/15">
                  <td className="px-5 py-5 font-medium">
                    <Link href={`/admin/customers/${customer.id}`} className="hover:underline">
                      {customer.name}
                    </Link>
                  </td>
                  <td className="px-4 py-5 text-olive/80">{customer.email}</td>
                  <td className="whitespace-nowrap px-4 py-5 text-[10px] text-olive/80">
                    {operationDate(customer.createdAt)}
                  </td>
                  <td className="px-4 py-5 text-right tabular-nums">{customer.addresses.length}</td>
                  <td className="sticky right-0 bg-ivory px-5 py-5 text-right shadow-[-6px_0_8px_-8px_#343d31]">
                    <Link
                      href={`/admin/customers/${customer.id}`}
                      aria-label={`View profile for ${customer.name || customer.email}`}
                      className="text-[10px] underline underline-offset-4"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {result.customers.length === 0 && (
            <p className="mb-0 px-5 py-14 text-center text-xs text-olive/80">
              {query
                ? "No customers match that name or email prefix."
                : "Customer profiles will appear after the first account is created."}
            </p>
          )}
        </div>
      </section>
    </>
  );
}
