"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { money } from "@/lib/utils";
import type { AnalyticsDay, Bestseller } from "@/types/operations";

const tooltipStyle = {
  backgroundColor: "#faf8f3",
  border: "1px solid #343d3120",
  borderRadius: 0,
  fontSize: 11,
  padding: "12px 16px",
};
function dayLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}
function compactMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    notation: "compact",
  }).format(cents / 100);
}

export function RevenueChart({ trend }: { trend: AnalyticsDay[] }) {
  const revenue = trend.reduce((total, day) => total + day.revenue, 0);
  const paid = trend.reduce((total, day) => total + day.paidOrders, 0);
  return (
    <section className="min-w-0 border border-olive/10 bg-ivory p-5 sm:p-6">
      <div className="mb-6">
        <h2 className="mb-2 font-sans text-sm font-medium tracking-normal">Revenue over time</h2>
        <p className="mb-0 text-[10px] leading-6 text-olive/80">
          {money(revenue)} across {paid} verified paid {paid === 1 ? "order" : "orders"}. Daily USD
          revenue includes shipping.
        </p>
      </div>
      {!paid && (
        <p className="mb-4 text-[11px] text-olive/80">
          No verified payments in this reporting period.
        </p>
      )}
      <div className="h-[260px] min-w-0" aria-hidden="true">
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          initialDimension={{ width: 600, height: 260 }}
        >
          <AreaChart
            data={trend}
            margin={{ top: 8, right: 10, left: 0, bottom: 4 }}
            accessibilityLayer={false}
          >
            <CartesianGrid stroke="#343d3112" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={dayLabel}
              tick={{ fontSize: 10, fill: "#343d31cc" }}
              axisLine={false}
              tickLine={false}
              minTickGap={32}
              dy={8}
            />
            <YAxis
              tickFormatter={compactMoney}
              tick={{ fontSize: 9, fill: "#343d31cc" }}
              axisLine={false}
              tickLine={false}
              width={50}
              domain={[0, "auto"]}
            />
            <Tooltip
              labelFormatter={(label) => dayLabel(String(label))}
              formatter={(value) => [money(Number(value ?? 0)), "Verified revenue"]}
              contentStyle={tooltipStyle}
              cursor={{ stroke: "#343d3140" }}
            />
            <Area
              type="linear"
              dataKey="revenue"
              stroke="#67765b"
              strokeWidth={2}
              fill="#b5bca1"
              fillOpacity={0.25}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-6 border-t border-olive/10 pt-4">
        <summary className="w-fit cursor-pointer text-[10px] underline underline-offset-4">
          View daily data
        </summary>
        <div
          className="relative mt-4 overflow-x-auto"
          role="region"
          aria-label="Daily analytics data"
          tabIndex={0}
        >
          <table className="w-full min-w-[400px] border-collapse text-left text-[10px]">
            <caption className="sr-only">
              Daily created orders, verified paid orders and revenue in UTC
            </caption>
            <thead className="border-b border-olive/10 text-olive/80">
              <tr>
                <th className="py-3 pr-3 font-medium">Date (UTC)</th>
                <th className="px-3 py-3 text-right font-medium">Created</th>
                <th className="px-3 py-3 text-right font-medium">Paid</th>
                <th className="py-3 pl-3 text-right font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-olive/10">
              {trend.map((day) => (
                <tr key={day.date}>
                  <th className="py-3 pr-3 font-normal">{day.date}</th>
                  <td className="px-3 py-3 text-right tabular-nums">{day.orders}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{day.paidOrders}</td>
                  <td className="py-3 pl-3 text-right tabular-nums">{money(day.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

export function BestsellersChart({ products }: { products: Bestseller[] }) {
  return (
    <section className="min-w-0 border border-olive/10 bg-ivory p-5 sm:p-6">
      <h2 className="mb-2 font-sans text-sm font-medium tracking-normal">Bestsellers</h2>
      <p className="mb-5 text-[10px] leading-6 text-olive/80">
        Up to ten products ranked by units in verified payments during this period. Product revenue
        excludes shipping.
      </p>
      {products.length ? (
        <>
          <div
            className="min-w-0"
            style={{ height: Math.max(180, products.length * 40 + 30) }}
            aria-hidden="true"
          >
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
              initialDimension={{ width: 480, height: Math.max(180, products.length * 40 + 30) }}
            >
              <BarChart
                data={products}
                layout="vertical"
                margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                accessibilityLayer={false}
              >
                <CartesianGrid stroke="#343d3112" horizontal={false} />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 9, fill: "#343d31cc" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  tickFormatter={(name: string) =>
                    name.length > 20 ? `${name.slice(0, 19)}…` : name
                  }
                  width={125}
                  tick={{ fontSize: 9, fill: "#343d31" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value) => [Number(value ?? 0), "Units sold"]}
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "#343d3108" }}
                />
                <Bar dataKey="quantity" fill="#879377" barSize={16} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div
            className="relative mt-6 overflow-x-auto"
            role="region"
            aria-label="Bestselling products"
            tabIndex={0}
          >
            <table className="w-full min-w-[370px] border-collapse text-left text-[10px]">
              <caption className="sr-only">
                Bestselling products by units, with product revenue
              </caption>
              <thead className="border-y border-olive/10 text-olive/80">
                <tr>
                  <th className="py-3 pr-3 font-medium">Product</th>
                  <th className="px-3 py-3 text-right font-medium">Units</th>
                  <th className="py-3 pl-3 text-right font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-olive/10">
                {products.map((product) => (
                  <tr key={product.productId}>
                    <th className="py-3 pr-3 font-normal">{product.name}</th>
                    <td className="px-3 py-3 text-right tabular-nums">{product.quantity}</td>
                    <td className="py-3 pl-3 text-right tabular-nums">{money(product.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="flex min-h-[220px] items-center justify-center border-t border-olive/10 text-center">
          <p className="mb-0 max-w-xs text-xs leading-7 text-olive/80">
            Bestsellers will appear after a verified payment contains products in this reporting
            period.
          </p>
        </div>
      )}
    </section>
  );
}
