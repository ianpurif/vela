import "server-only";
import { z } from "zod";
import { requireAdmin } from "@/server/auth";
import { firestoreStore } from "@/server/repositories/firestore-store";
import { readHomeContent } from "@/server/repositories/catalog";
import type { CommerceStore, Filter } from "@/server/repositories/store";
import { audit } from "./admin";
import { AppError } from "@/lib/errors";
import { documentId } from "@/lib/validation/commerce";
import {
  contentInputSchema,
  fulfillmentInputSchema,
  orderFiltersSchema,
} from "@/lib/validation/operations";
import { analyticsWindow, buildAdminAnalytics } from "@/features/operations/analytics";
import type {
  Category,
  HomepagePromotion,
  Order,
  Product,
  SiteContent,
  UserProfile,
} from "@/types/commerce";
import type {
  AdminAnalytics,
  AdminContent,
  AdminCustomerDetail,
  AdminCustomerList,
  AdminOrderFilters,
  AdminOrderList,
} from "@/types/operations";

export async function listAdminOrders(
  filters: AdminOrderFilters = {},
  store: CommerceStore = firestoreStore,
): Promise<AdminOrderList> {
  await requireAdmin();
  const data = orderFiltersSchema.parse(filters);
  const query: Filter[] = [];
  if (data.paymentStatus)
    query.push({ field: "paymentStatus", op: "==", value: data.paymentStatus });
  if (data.fulfillmentStatus)
    query.push({ field: "fulfillmentStatus", op: "==", value: data.fulfillmentStatus });
  const cursor = data.after ? await store.get<Order>("orders", data.after) : null;
  if (data.after && !cursor)
    throw new AppError(
      400,
      "This order cursor is no longer available. Restart the list.",
      "ORDER_CURSOR_INVALID",
    );
  const orders = await store.list<Order>("orders", query, {
    orderBy: "createdAt",
    direction: "desc",
    limit: 201,
    ...(cursor ? { startAfter: { value: cursor.createdAt, id: cursor.id } } : {}),
  });
  const page = orders.slice(0, 200);
  return {
    orders: page,
    limit: 200,
    truncated: orders.length > 200,
    next: orders.length > 200 ? page.at(-1)!.id : null,
  };
}

export async function getAdminOrder(
  id: string,
  store: CommerceStore = firestoreStore,
): Promise<Order | null> {
  await requireAdmin();
  return store.get<Order>("orders", documentId.parse(id));
}

function prefixEnd(prefix: string) {
  const points = Array.from(prefix);
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index].codePointAt(0)!;
    if (point < 0x10ffff) {
      const next = point + 1;
      return (
        points.slice(0, index).join("") +
        String.fromCodePoint(next >= 0xd800 && next <= 0xdfff ? 0xe000 : next)
      );
    }
  }
  return null;
}

export async function listAdminCustomers(
  query = "",
  store: CommerceStore = firestoreStore,
): Promise<AdminCustomerList> {
  await requireAdmin();
  const prefix = z.string().trim().max(100).parse(query).normalize("NFKC").toLowerCase();
  if (!prefix) {
    const customers = await store.list<UserProfile>("users", [], {
      orderBy: "createdAt",
      direction: "desc",
      limit: 101,
    });
    return { customers: customers.slice(0, 100), limit: 100, truncated: customers.length > 100 };
  }
  const end = prefixEnd(prefix);
  const fields = ["searchName", "searchEmail"] as const;
  const matches = await Promise.all(
    fields.map(async (field) => {
      const filters: Filter[] = [{ field, op: ">=", value: prefix }];
      if (end) filters.push({ field, op: "<=", value: end });
      const rows = await store.list<UserProfile>("users", filters, { orderBy: field, limit: 101 });
      // The inclusive upper bound can contain the first nonmatching value.
      return rows.filter((row) => row[field]?.startsWith(prefix));
    }),
  );
  const unique = [...new Map(matches.flat().map((profile) => [profile.id, profile])).values()].sort(
    (a, b) => (a.searchName ?? "").localeCompare(b.searchName ?? "") || a.id.localeCompare(b.id),
  );
  return {
    customers: unique.slice(0, 100),
    limit: 100,
    truncated: unique.length > 100 || matches.some((rows) => rows.length > 100),
  };
}

export async function getAdminCustomer(
  id: string,
  store: CommerceStore = firestoreStore,
): Promise<AdminCustomerDetail | null> {
  await requireAdmin();
  const uid = documentId.parse(id);
  const profile = await store.get<UserProfile>("users", uid);
  if (!profile) return null;
  const orders = await store.list<Order>("orders", [{ field: "userId", op: "==", value: uid }], {
    orderBy: "createdAt",
    direction: "desc",
    limit: 201,
  });
  return {
    profile,
    orders: orders.slice(0, 200),
    ordersLimit: 200,
    ordersTruncated: orders.length > 200,
  };
}

export async function getAdminAnalytics(
  days = 30,
  store: CommerceStore = firestoreStore,
  now = Date.now(),
): Promise<AdminAnalytics> {
  await requireAdmin();
  const count = z.number().int().min(1).max(90).parse(days);
  const window = analyticsWindow(count, now);
  const [createdOrders, paidOrders, products] = await Promise.all([
    store.list<Order>(
      "orders",
      [
        { field: "createdAt", op: ">=", value: window.startAt },
        { field: "createdAt", op: "<=", value: window.endAt },
      ],
      { orderBy: "createdAt", direction: "desc", limit: 1000 },
    ),
    store.list<Order>(
      "orders",
      [
        { field: "paymentStatus", op: "==", value: "paid" },
        { field: "paidAt", op: ">=", value: window.startAt },
        { field: "paidAt", op: "<=", value: window.endAt },
      ],
      { orderBy: "paidAt", direction: "desc", limit: 1000 },
    ),
    store.list<Product>("products", [], { orderBy: "rank", limit: 1000 }),
  ]);
  return buildAdminAnalytics({ createdOrders, paidOrders, products, days: count, now });
}

export async function getAdminContent(
  store: CommerceStore = firestoreStore,
): Promise<AdminContent> {
  await requireAdmin();
  const [content, categories] = await Promise.all([
    readHomeContent(store),
    store.list<Category>("categories", [], { orderBy: "rank", limit: 100 }),
  ]);
  return { content, categories };
}

export async function updateFulfillment(
  input: unknown,
  actorId: string,
  store: CommerceStore = firestoreStore,
): Promise<Order> {
  const data = fulfillmentInputSchema.parse(input);
  return store.transaction(async (tx) => {
    const order = await tx.get<Order>("orders", data.id);
    if (!order) throw new AppError(404, "Order not found.", "ORDER_NOT_FOUND");
    if (order.paymentStatus !== "paid")
      throw new AppError(409, "Only paid orders can be fulfilled.", "ORDER_NOT_PAID");
    const steps = ["unfulfilled", "processing", "shipped", "delivered"];
    const previous = steps.indexOf(order.fulfillmentStatus);
    const next = steps.indexOf(data.fulfillmentStatus);
    if (previous < 0 || next < previous || next > previous + 1) {
      throw new AppError(
        409,
        "Move to the next fulfillment step without skipping or reversing steps.",
        "FULFILLMENT_TRANSITION_INVALID",
      );
    }
    if (
      order.fulfillmentStatus === data.fulfillmentStatus &&
      order.trackingNumber === data.trackingNumber
    )
      return order;
    const updated: Order = {
      ...order,
      fulfillmentStatus: data.fulfillmentStatus,
      trackingNumber: data.trackingNumber,
      updatedAt: Date.now(),
    };
    const log = audit(actorId, "order.fulfillment.updated", order.id, {
      from: order.fulfillmentStatus,
      to: data.fulfillmentStatus,
      trackingNumber: data.trackingNumber,
      previousTrackingNumber: order.trackingNumber,
    });
    tx.set("orders", order.id, updated);
    tx.set("auditLogs", log.id, log);
    return updated;
  });
}

export async function saveHomeContent(
  input: unknown,
  actorId: string,
  store: CommerceStore = firestoreStore,
): Promise<SiteContent> {
  const data = contentInputSchema.parse(input);
  return store.transaction(async (tx) => {
    const [previous, category] = await Promise.all([
      tx.get<SiteContent>("settings", "home"),
      data.featuredCategory
        ? tx.get<Category>("categories", data.featuredCategory)
        : Promise.resolve(null),
    ]);
    if (data.featuredCategory && !category)
      throw new AppError(400, "Choose an existing featured collection.", "CATEGORY_NOT_FOUND");
    const now = Date.now();
    const { promotionTitle, promotionText, ...fields } = data;
    const settings = { ...fields, id: "home" as const, updatedAt: now };
    const promotion: HomepagePromotion = {
      id: "home",
      title: promotionTitle,
      text: promotionText,
      updatedAt: now,
    };
    const log = audit(actorId, "content.home.updated", "home", {
      featuredCategory: data.featuredCategory,
      previousFeaturedCategory: previous?.featuredCategory ?? null,
      promotionUpdated: true,
    });
    tx.set("settings", "home", settings);
    tx.set("promotions", "home", promotion);
    tx.set("auditLogs", log.id, log);
    return { ...settings, promotionTitle, promotionText };
  });
}
