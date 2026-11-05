"use client";

import Link from "next/link";
import { useState } from "react";
import { Search } from "lucide-react";
import { FulfillmentBadge, operationDate, PaymentBadge } from "@/components/admin/operations-ui";
import { money } from "@/lib/utils";
import type { Order } from "@/types/commerce";

export function OrderTable({
  orders,
  searchable = false,
  showCustomer = true,
}: {
  orders: Order[];
  searchable?: boolean;
  showCustomer?: boolean;
}) {
  const [query, setQuery] = useState("");
  const filtered = orders.filter((order) =>
    `${order.id} ${order.email}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <div className="min-w-0">
      {searchable && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-olive/10 p-5">
          <div className="relative w-full max-w-sm">
            <label htmlFor="order-search" className="sr-only">
              Search these orders
            </label>
            <Search size={15} className="absolute left-3 top-3.5 text-olive/50" />
            <input
              id="order-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Order reference or customer email"
              className="field py-3 pl-9 text-xs"
            />
          </div>
          <p aria-live="polite" className="mb-0 text-[10px] text-olive/55">
            {filtered.length} of {orders.length} loaded orders
          </p>
        </div>
      )}
      <div
        className="relative overflow-x-auto"
        role="region"
        aria-label="Orders table"
        tabIndex={0}
      >
        <table className="w-full min-w-[760px] border-collapse text-left text-xs">
          <thead className="border-b border-olive/10 bg-sand/15 text-[9px] tracking-wider text-olive/55 uppercase">
            <tr>
              <th className="px-5 py-3.5 font-medium">Order</th>
              {showCustomer && <th className="px-4 py-3.5 font-medium">Customer</th>}
              <th className="px-4 py-3.5 font-medium">Payment</th>
              <th className="px-4 py-3.5 font-medium">Fulfillment</th>
              <th className="px-4 py-3.5 text-right font-medium">Total</th>
              <th className="sticky right-0 bg-ivory px-5 py-3.5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-olive/10">
            {filtered.map((order) => (
              <tr key={order.id} className="hover:bg-sand/15">
                <td className="px-5 py-4">
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="font-mono text-[11px] font-medium hover:underline"
                    title={order.id}
                  >
                    #{order.id.slice(-10)}
                  </Link>
                  <p className="mt-1.5 mb-0 whitespace-nowrap text-[9px] text-olive/55">
                    {operationDate(order.createdAt)} UTC
                  </p>
                </td>
                {showCustomer && (
                  <td className="max-w-[240px] truncate px-4 py-4">
                    <Link
                      href={`/admin/customers/${order.userId}`}
                      className="text-[11px] hover:underline"
                    >
                      {order.email}
                    </Link>
                  </td>
                )}
                <td className="px-4 py-4">
                  <PaymentBadge status={order.paymentStatus} />
                </td>
                <td className="px-4 py-4">
                  <FulfillmentBadge status={order.fulfillmentStatus} />
                </td>
                <td className="px-4 py-4 text-right tabular-nums">{money(order.total)}</td>
                <td className="sticky right-0 bg-ivory px-5 py-4 text-right shadow-[-6px_0_8px_-8px_#343d31]">
                  <Link
                    href={`/admin/orders/${order.id}`}
                    aria-label={`View order ${order.id}`}
                    className="text-[10px] underline underline-offset-4"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="px-6 py-14 text-center">
            <p className="mb-2 text-sm">No orders to show.</p>
            <p className="mb-0 text-xs leading-6 text-olive/60">
              {query
                ? "Try another reference or email in these loaded results."
                : "Orders will appear here after a customer starts a test checkout."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
