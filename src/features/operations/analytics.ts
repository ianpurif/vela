import type { Order, Product } from "@/types/commerce";
import type { AdminAnalytics, AnalyticsDay, Bestseller } from "@/types/operations";

const DAY = 24 * 60 * 60 * 1000;
export function analyticsWindow(days: number, now: number) {
  const current = new Date(now);
  const today = Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate());
  return { days, startAt: today - (days - 1) * DAY, endAt: now, timezone: "UTC" as const };
}

/** No storage, clocks, authentication, or generated sales: aggregate supplied records only. */
export function buildAdminAnalytics(input: {
  createdOrders: Order[];
  paidOrders: Order[];
  products: Product[];
  days: number;
  now: number;
}): AdminAnalytics {
  const window = analyticsWindow(input.days, input.now);
  const inWindow = (timestamp: number | null) =>
    typeof timestamp === "number" && timestamp >= window.startAt && timestamp <= window.endAt;
  const created = input.createdOrders
    .slice(0, 1000)
    .filter((order) => order.testMode === true && inWindow(order.createdAt));
  const paid = input.paidOrders
    .slice(0, 1000)
    .filter(
      (order) =>
        order.testMode === true && order.paymentStatus === "paid" && inWindow(order.paidAt),
    );
  const products = input.products.slice(0, 1000);
  const trend: AnalyticsDay[] = Array.from({ length: input.days }, (_, index) => ({
    date: new Date(window.startAt + index * DAY).toISOString().slice(0, 10),
    orders: 0,
    paidOrders: 0,
    revenue: 0,
  }));
  const byDate = new Map(trend.map((day) => [day.date, day]));
  const bestsellers = new Map<string, Bestseller>();
  for (const order of created)
    byDate.get(new Date(order.createdAt).toISOString().slice(0, 10))!.orders += 1;
  for (const order of [...paid].sort((a, b) => (b.paidAt ?? 0) - (a.paidAt ?? 0))) {
    const day = byDate.get(new Date(order.paidAt!).toISOString().slice(0, 10))!;
    day.paidOrders += 1;
    day.revenue += order.total;
    for (const line of order.lines) {
      const item = bestsellers.get(line.productId) ?? {
        productId: line.productId,
        name: line.name,
        quantity: 0,
        revenue: 0,
      };
      item.quantity += line.quantity;
      item.revenue += line.quantity * line.unitPrice;
      bestsellers.set(line.productId, item);
    }
  }
  const revenue = paid.reduce((total, order) => total + order.total, 0);
  const createdOrdersTruncated = input.createdOrders.length >= 1000;
  const paidOrdersTruncated = input.paidOrders.length >= 1000;
  const productsTruncated = input.products.length >= 1000;
  return {
    window,
    metrics: {
      revenue,
      paidOrders: paid.length,
      orders: created.length,
      pendingOrders: created.filter((order) => order.paymentStatus === "pending").length,
      averageOrderValue: paid.length ? Math.round(revenue / paid.length) : 0,
      products: products.length,
    },
    trend,
    bestsellers: [...bestsellers.values()]
      .sort(
        (a, b) =>
          b.quantity - a.quantity ||
          b.revenue - a.revenue ||
          a.productId.localeCompare(b.productId),
      )
      .slice(0, 10),
    recentOrders: [...created]
      .sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id))
      .slice(0, 10),
    lowStock: products
      .filter((product) => product.status === "published" && product.stock - product.reserved <= 5)
      .sort((a, b) => a.stock - a.reserved - (b.stock - b.reserved) || a.name.localeCompare(b.name))
      .slice(0, 10),
    scope: {
      orderLimit: 1000,
      productLimit: 1000,
      createdOrders: Math.min(input.createdOrders.length, 1000),
      paidOrders: Math.min(input.paidOrders.length, 1000),
      products: products.length,
      createdOrdersTruncated,
      paidOrdersTruncated,
      productsTruncated,
      truncated: createdOrdersTruncated || paidOrdersTruncated || productsTruncated,
    },
  };
}
