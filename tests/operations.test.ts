import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { contentInputSchema } from "@/lib/validation/operations";
import { demoCategories, demoProducts, defaultContent } from "@/features/catalog/fixtures";
import { analyticsWindow, buildAdminAnalytics } from "@/features/operations/analytics";
import { requireAdmin, type SessionUser } from "@/server/auth";
import { firestoreStore } from "@/server/repositories/firestore-store";
import { readHomeContent } from "@/server/repositories/catalog";
import { getProfile, updateProfile } from "@/server/services/accounts";
import {
  getAdminAnalytics,
  getAdminContent,
  getAdminCustomer,
  getAdminOrder,
  listAdminCustomers,
  listAdminOrders,
  saveHomeContent,
  updateFulfillment,
} from "@/server/services/operations";
import { rateLimit } from "@/server/services/rate-limit";
import { GET as ordersGet, PATCH as ordersPatch } from "@/app/api/admin/orders/route";
import { GET as customersGet } from "@/app/api/admin/customers/route";
import { GET as contentGet, PATCH as contentPatch } from "@/app/api/admin/content/route";
import { GET as analyticsGet } from "@/app/api/admin/analytics/route";
import type { Order, Product, SiteContent, UserProfile } from "@/types/commerce";
import { MemoryStore } from "./helpers/memory-store";

vi.mock("@/server/auth", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/server/services/rate-limit", () => ({ rateLimit: vi.fn() }));

const now = Date.UTC(2026, 10, 6, 12);
const DAY = 86_400_000;
const admin: SessionUser = {
  uid: "admin",
  email: "admin@example.test",
  name: "Admin",
  admin: true,
  emailVerified: true,
};
const customer: SessionUser = {
  uid: "customer",
  email: "Ada@example.test",
  name: "Ａda Customer",
  admin: false,
  emailVerified: true,
};
function order(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-one",
    userId: customer.uid,
    email: customer.email,
    lines: [
      {
        productId: "serum",
        name: "Snapshot serum",
        image: "/images/serum.jpg",
        quantity: 2,
        unitPrice: 1300,
      },
    ],
    subtotal: 2600,
    shipping: 600,
    total: 3200,
    currency: "usd",
    paymentStatus: "paid",
    paidAt: now - 1000,
    fulfillmentStatus: "unfulfilled",
    testMode: true,
    sessionId: "cs_test_fixture",
    checkoutUrl: null,
    requestKey: "request-fixture",
    expiresAt: now + 1000,
    shippingAddress: null,
    trackingNumber: "",
    createdAt: now - DAY,
    updatedAt: now - 1000,
    ...overrides,
  };
}
function profile(
  id: string,
  name: string,
  email = `${id}@example.test`,
  createdAt = now,
): UserProfile {
  return {
    id,
    name,
    email,
    searchName: name.normalize("NFKC").trim().toLowerCase(),
    searchEmail: email.normalize("NFKC").trim().toLowerCase(),
    addresses: [],
    createdAt,
    updatedAt: createdAt,
  };
}
function contentInput() {
  return Object.fromEntries(
    Object.keys(contentInputSchema.shape).map((key) => [
      key,
      defaultContent[key as keyof SiteContent],
    ]),
  );
}
function seeded() {
  return new MemoryStore({
    orders: { "order-one": order() },
    users: { customer: profile(customer.uid, customer.name, customer.email) },
    categories: Object.fromEntries(demoCategories.map((category) => [category.id, category])),
    settings: { home: defaultContent },
    products: Object.fromEntries(demoProducts.map((product) => [product.id, product])),
  });
}
let routeStore: MemoryStore;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://127.0.0.1:3000");
  vi.mocked(requireAdmin).mockReset().mockResolvedValue(admin);
  vi.mocked(rateLimit).mockReset().mockResolvedValue(undefined);
  routeStore = seeded();
  vi.spyOn(firestoreStore, "get").mockImplementation(routeStore.get.bind(routeStore));
  vi.spyOn(firestoreStore, "list").mockImplementation(routeStore.list.bind(routeStore));
  vi.spyOn(firestoreStore, "set").mockImplementation(routeStore.set.bind(routeStore));
  vi.spyOn(firestoreStore, "transaction").mockImplementation(
    routeStore.transaction.bind(routeStore),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("admin reader authorization and bounded queries", () => {
  const readers: Array<[string, (store: MemoryStore) => Promise<unknown>]> = [
    ["orders", (store) => listAdminOrders({}, store)],
    ["order detail", (store) => getAdminOrder("order-one", store)],
    ["customers", (store) => listAdminCustomers("ada", store)],
    ["customer detail", (store) => getAdminCustomer("customer", store)],
    ["analytics", (store) => getAdminAnalytics(30, store, now)],
    ["content", (store) => getAdminContent(store)],
  ];
  it.each(readers)("independently authorizes %s before reading data", async (_name, read) => {
    const store = seeded();
    const get = vi.spyOn(store, "get");
    const list = vi.spyOn(store, "list");
    vi.mocked(requireAdmin).mockRejectedValue(
      new AppError(403, "Administrator access is required."),
    );
    await expect(read(store)).rejects.toMatchObject({ status: 403 });
    expect(get).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
  });

  it("paginates orders without gaps at equal timestamps while preserving combined filters", async () => {
    const rows = Array.from({ length: 202 }, (_, index) =>
      order({ id: `order-${String(index).padStart(3, "0")}`, fulfillmentStatus: "processing" }),
    );
    rows.push(
      order({
        id: "excluded",
        paymentStatus: "pending",
        paidAt: null,
        fulfillmentStatus: "processing",
      }),
    );
    const store = new MemoryStore({ orders: Object.fromEntries(rows.map((row) => [row.id, row])) });
    const first = await listAdminOrders(
      { paymentStatus: "paid", fulfillmentStatus: "processing" },
      store,
    );
    expect(first).toMatchObject({ limit: 200, truncated: true });
    expect(first.orders).toHaveLength(200);
    const second = await listAdminOrders(
      { paymentStatus: "paid", fulfillmentStatus: "processing", after: first.next! },
      store,
    );
    expect(second.orders).toHaveLength(2);
    expect(second).toMatchObject({ truncated: false, next: null });
    expect(new Set([...first.orders, ...second.orders].map((row) => row.id)).size).toBe(202);
    expect(first.orders.some((row) => row.id === "excluded")).toBe(false);
  });

  it("rejects nonexistent cursors and unrecognized order filters", async () => {
    await expect(listAdminOrders({ after: "missing" }, seeded())).rejects.toMatchObject({
      code: "ORDER_CURSOR_INVALID",
    });
    await expect(listAdminOrders({ paymentStatus: "refund" } as never, seeded())).rejects.toThrow();
  });

  it("scopes customer details to that user and discloses its history limit", async () => {
    const rows = Array.from({ length: 201 }, (_, index) =>
      order({ id: `order-${index}`, createdAt: now - index }),
    );
    const store = new MemoryStore({
      users: { customer: profile("customer", "Customer") },
      orders: Object.fromEntries(
        [...rows, order({ id: "foreign", userId: "someone-else" })].map((row) => [row.id, row]),
      ),
    });
    const result = await getAdminCustomer("customer", store);
    expect(result?.orders).toHaveLength(200);
    expect(result).toMatchObject({ ordersLimit: 200, ordersTruncated: true });
    expect(result?.orders.every((row) => row.userId === "customer")).toBe(true);
    expect(await getAdminCustomer("missing", store)).toBeNull();
    expect(await getAdminOrder("missing", store)).toBeNull();
  });
});

describe("indexed customer prefix search", () => {
  it("finds an old account by case-insensitive normalized name and email without scanning recent users", async () => {
    const older = profile("older", "Ａda Lovelace", "Contact@example.test", now - 500 * DAY);
    const recent = Array.from({ length: 150 }, (_, index) =>
      profile(`new-${index}`, `Recent ${index}`, undefined, now - index),
    );
    const store = new MemoryStore({
      users: Object.fromEntries([older, ...recent].map((row) => [row.id, row])),
    });
    const list = vi.spyOn(store, "list");
    expect((await listAdminCustomers("  ADA ", store)).customers.map((row) => row.id)).toEqual([
      "older",
    ]);
    expect((await listAdminCustomers("CONTACT@", store)).customers.map((row) => row.id)).toEqual([
      "older",
    ]);
    expect(
      list.mock.calls.every(
        ([, , options]) => options?.orderBy === "searchName" || options?.orderBy === "searchEmail",
      ),
    ).toBe(true);
    expect(list.mock.calls.every(([, , options]) => options?.limit === 101)).toBe(true);
    expect((await listAdminCustomers("Lovelace", store)).customers).toHaveLength(0);
  });

  it("deduplicates dual-field matches and discloses search truncation", async () => {
    const rows = Array.from({ length: 101 }, (_, index) =>
      profile(`ada-${index}`, `Ada ${index}`, `ada${index}@example.test`),
    );
    const store = new MemoryStore({ users: Object.fromEntries(rows.map((row) => [row.id, row])) });
    const result = await listAdminCustomers("ada", store);
    expect(result).toMatchObject({ limit: 100, truncated: true });
    expect(result.customers).toHaveLength(100);
    expect(new Set(result.customers.map((row) => row.id)).size).toBe(100);
  });

  it("excludes the inclusive upper bound and handles supplementary Unicode names", async () => {
    const store = new MemoryStore({
      users: {
        emoji: profile("emoji", "Zo😀 Customer"),
        boundary: profile("boundary", "Zp"),
      },
    });
    const result = await listAdminCustomers("zo", store);
    expect(result.customers.map((row) => row.id)).toEqual(["emoji"]);
    expect(result.truncated).toBe(false);
  });

  it("caps the unfiltered recent-customer list explicitly", async () => {
    const rows = Array.from({ length: 101 }, (_, index) =>
      profile(`user-${index}`, `User ${index}`, undefined, now - index),
    );
    const result = await listAdminCustomers(
      "",
      new MemoryStore({ users: Object.fromEntries(rows.map((row) => [row.id, row])) }),
    );
    expect(result.customers).toHaveLength(100);
    expect(result.customers[0].id).toBe("user-0");
    expect(result.truncated).toBe(true);
  });

  it("maintains search fields on profile creation, update, and legacy profile reads", async () => {
    const fresh = { ...customer, uid: "fresh" };
    const created = await getProfile(fresh);
    expect(created).toMatchObject({ searchName: "ada customer", searchEmail: "ada@example.test" });
    const updated = await updateProfile(fresh, { name: "  Grace Hopper  ", addresses: [] });
    expect(updated).toMatchObject({ name: "Grace Hopper", searchName: "grace hopper" });
    const legacy = profile("legacy", "Older Customer", "OLD@example.test");
    delete legacy.searchName;
    delete legacy.searchEmail;
    await routeStore.set("users", "legacy", legacy);
    expect((await listAdminCustomers("older", routeStore)).customers).toHaveLength(0);
    const migrated = await getProfile({ ...customer, uid: "legacy" });
    expect(migrated).toMatchObject({
      searchName: "older customer",
      searchEmail: "old@example.test",
      updatedAt: legacy.updatedAt,
    });
    expect((await listAdminCustomers("older", routeStore)).customers.map((row) => row.id)).toEqual([
      "legacy",
    ]);
  });
});

describe("paid order fulfillment", () => {
  it("moves through each forward step, preserves payment/inventory data, and audits changes", async () => {
    const store = seeded();
    const original = await store.get<Order>("orders", "order-one");
    for (const fulfillmentStatus of ["processing", "shipped", "delivered"]) {
      await updateFulfillment(
        {
          id: "order-one",
          fulfillmentStatus,
          trackingNumber: fulfillmentStatus === "processing" ? "" : "TEST-TRACKING-1",
        },
        admin.uid,
        store,
      );
    }
    const result = await store.get<Order>("orders", "order-one");
    expect(result).toMatchObject({
      paymentStatus: "paid",
      paidAt: original?.paidAt,
      total: original?.total,
      fulfillmentStatus: "delivered",
      trackingNumber: "TEST-TRACKING-1",
    });
    expect(result?.lines).toEqual(original?.lines);
    expect(await store.list("auditLogs")).toHaveLength(3);
    expect(await store.get<Product>("products", demoProducts[0].id)).toEqual(demoProducts[0]);
  });

  it.each(["pending", "failed", "cancelled", "expired"] as const)(
    "refuses fulfillment for %s orders",
    async (paymentStatus) => {
      const store = new MemoryStore({
        orders: { "order-one": order({ paymentStatus, paidAt: null }) },
      });
      await expect(
        updateFulfillment(
          { id: "order-one", fulfillmentStatus: "processing", trackingNumber: "" },
          admin.uid,
          store,
        ),
      ).rejects.toMatchObject({ code: "ORDER_NOT_PAID" });
      expect(await store.list("auditLogs")).toHaveLength(0);
    },
  );

  it("rejects skipped/backward transitions, missing tracking, and payment field injection", async () => {
    const store = seeded();
    await expect(
      updateFulfillment(
        { id: "order-one", fulfillmentStatus: "shipped", trackingNumber: "TRACK" },
        admin.uid,
        store,
      ),
    ).rejects.toMatchObject({ code: "FULFILLMENT_TRANSITION_INVALID" });
    await updateFulfillment(
      { id: "order-one", fulfillmentStatus: "processing", trackingNumber: "" },
      admin.uid,
      store,
    );
    await expect(
      updateFulfillment(
        { id: "order-one", fulfillmentStatus: "unfulfilled", trackingNumber: "" },
        admin.uid,
        store,
      ),
    ).rejects.toMatchObject({ code: "FULFILLMENT_TRANSITION_INVALID" });
    await expect(
      updateFulfillment(
        { id: "order-one", fulfillmentStatus: "shipped", trackingNumber: "  " },
        admin.uid,
        store,
      ),
    ).rejects.toThrow();
    await expect(
      updateFulfillment(
        {
          id: "order-one",
          fulfillmentStatus: "processing",
          trackingNumber: "",
          paymentStatus: "paid",
        },
        admin.uid,
        store,
      ),
    ).rejects.toThrow();
  });

  it("allows tracking correction in the same state and avoids duplicate no-op audit writes", async () => {
    const store = new MemoryStore({
      orders: { "order-one": order({ fulfillmentStatus: "shipped", trackingNumber: "OLD" }) },
    });
    await updateFulfillment(
      { id: "order-one", fulfillmentStatus: "shipped", trackingNumber: "NEW" },
      admin.uid,
      store,
    );
    await updateFulfillment(
      { id: "order-one", fulfillmentStatus: "shipped", trackingNumber: "NEW" },
      admin.uid,
      store,
    );
    expect((await store.get<Order>("orders", "order-one"))?.trackingNumber).toBe("NEW");
    expect(await store.list("auditLogs")).toHaveLength(1);
  });

  it("serializes concurrent duplicate transitions into one effective change", async () => {
    const store = seeded();
    const input = { id: "order-one", fulfillmentStatus: "processing", trackingNumber: "" };
    await Promise.all([
      updateFulfillment(input, admin.uid, store),
      updateFulfillment(input, admin.uid, store),
    ]);
    expect(await store.list("auditLogs")).toHaveLength(1);
  });
});

describe("homepage settings and promotion transactions", () => {
  it("writes separate private promotion and public settings documents with one audit", async () => {
    const store = seeded();
    const input = {
      ...contentInput(),
      featuredCategory: demoCategories[0].id,
      promotionTitle: "Updated promotion",
    };
    const result = await saveHomeContent(input, admin.uid, store);
    const settings = await store.get<Record<string, unknown>>("settings", "home");
    expect(settings).not.toHaveProperty("promotionTitle");
    expect(settings).not.toHaveProperty("promotionText");
    expect(await store.get("promotions", "home")).toEqual({
      id: "home",
      title: "Updated promotion",
      text: defaultContent.promotionText,
      updatedAt: now,
    });
    expect(await readHomeContent(store)).toEqual(result);
    expect((await getAdminContent(store)).content).toEqual(result);
    expect(await store.list("auditLogs")).toHaveLength(1);
  });

  it("supports legacy settings promotion fields until migration, then prefers the promotion document", async () => {
    const store = seeded();
    expect(await readHomeContent(store)).toEqual(defaultContent);
    await store.set("promotions", "home", {
      id: "home",
      title: "New source title",
      text: "New source text",
      updatedAt: now,
    });
    expect(await readHomeContent(store)).toMatchObject({
      promotionTitle: "New source title",
      promotionText: "New source text",
      updatedAt: now,
    });
    await expect(readHomeContent(new MemoryStore())).rejects.toMatchObject({
      code: "CONTENT_UNAVAILABLE",
    });
  });

  it("rejects unknown categories and unsupported fields without changing either content document", async () => {
    const store = seeded();
    await expect(
      saveHomeContent(
        { ...contentInput(), featuredCategory: "missing-category" },
        admin.uid,
        store,
      ),
    ).rejects.toMatchObject({ code: "CATEGORY_NOT_FOUND" });
    await expect(
      saveHomeContent({ ...contentInput(), id: "another-page" }, admin.uid, store),
    ).rejects.toThrow();
    expect(await store.get("settings", "home")).toEqual(defaultContent);
    expect(await store.get("promotions", "home")).toBeNull();
    expect(await store.list("auditLogs")).toHaveLength(0);
  });

  it("rolls back both content documents when the audit write fails", async () => {
    const store = seeded();
    const transaction = store.transaction.bind(store);
    vi.spyOn(store, "transaction").mockImplementation((work) =>
      transaction((tx) =>
        work({
          ...tx,
          set(collection, id, value) {
            if (collection === "auditLogs") throw new Error("Audit unavailable");
            tx.set(collection, id, value);
          },
        }),
      ),
    );
    await expect(
      saveHomeContent({ ...contentInput(), heroTitle: "Changed headline" }, admin.uid, store),
    ).rejects.toThrow("Audit unavailable");
    expect(await store.get("settings", "home")).toEqual(defaultContent);
    expect(await store.get("promotions", "home")).toBeNull();
  });
});

describe("actual UTC analytics", () => {
  it("returns useful empty metrics and every requested date without inventing sales", () => {
    const result = buildAdminAnalytics({
      createdOrders: [],
      paidOrders: [],
      products: [],
      days: 3,
      now,
    });
    expect(result.metrics).toEqual({
      revenue: 0,
      paidOrders: 0,
      orders: 0,
      pendingOrders: 0,
      averageOrderValue: 0,
      products: 0,
    });
    expect(result.trend.map((day) => day.date)).toEqual(["2026-11-04", "2026-11-05", "2026-11-06"]);
    expect(result.bestsellers).toEqual([]);
    expect(result.scope.truncated).toBe(false);
  });

  it("uses paidAt for revenue independently of createdAt, excluding unpaid/future/old payments", () => {
    const late = order({ id: "late-paid", createdAt: now - 10 * DAY, paidAt: now });
    const pending = order({
      id: "pending",
      paymentStatus: "pending",
      paidAt: null,
      createdAt: now,
    });
    const paidBefore = order({ id: "old-payment", paidAt: now - 10 * DAY, updatedAt: now });
    const future = order({ id: "future", paidAt: now + 1 });
    const result = buildAdminAnalytics({
      createdOrders: [pending, late],
      paidOrders: [late, pending, paidBefore, future],
      products: [],
      days: 3,
      now,
    });
    expect(result.metrics).toMatchObject({
      orders: 1,
      pendingOrders: 1,
      paidOrders: 1,
      revenue: 3200,
      averageOrderValue: 3200,
    });
    expect(result.trend.at(-1)).toEqual({
      date: "2026-11-06",
      orders: 1,
      paidOrders: 1,
      revenue: 3200,
    });
    expect(result.bestsellers).toEqual([
      { productId: "serum", name: "Snapshot serum", quantity: 2, revenue: 2600 },
    ]);
  });

  it("counts the exact UTC boundary and uses sold line snapshots for bestsellers", () => {
    const startAt = analyticsWindow(3, now).startAt;
    const first = order({ id: "first", createdAt: startAt, paidAt: startAt });
    const second = order({
      id: "second",
      paidAt: now,
      subtotal: 1000,
      total: 1000,
      shipping: 0,
      lines: [{ ...first.lines[0], name: "Latest snapshot", quantity: 1, unitPrice: 1000 }],
    });
    const before = order({ id: "before", createdAt: startAt - 1, paidAt: startAt - 1 });
    const result = buildAdminAnalytics({
      createdOrders: [first, before],
      paidOrders: [first, second, before],
      products: [],
      days: 3,
      now,
    });
    expect(result.metrics).toMatchObject({
      orders: 1,
      paidOrders: 2,
      revenue: 4200,
      averageOrderValue: 2100,
    });
    expect(result.bestsellers[0]).toEqual({
      productId: "serum",
      name: "Latest snapshot",
      quantity: 3,
      revenue: 3600,
    });
    expect(result.trend[0]).toMatchObject({ orders: 1, paidOrders: 1, revenue: 3200 });
  });

  it("computes low stock from published available units, including reservations", () => {
    const products = [
      { ...demoProducts[0], id: "reserved", stock: 10, reserved: 8, status: "published" as const },
      { ...demoProducts[0], id: "draft", stock: 0, reserved: 0, status: "draft" as const },
      { ...demoProducts[0], id: "plenty", stock: 20, reserved: 0, status: "published" as const },
    ];
    const result = buildAdminAnalytics({
      createdOrders: [],
      paidOrders: [],
      products,
      days: 3,
      now,
    });
    expect(result.metrics.products).toBe(3);
    expect(result.lowStock.map((product) => product.id)).toEqual(["reserved"]);
  });

  it("exposes every scan bound instead of presenting capped results as complete totals", () => {
    const rows = Array.from({ length: 1000 }, (_, index) => order({ id: `order-${index}` }));
    const products = Array.from({ length: 1000 }, (_, index) => ({
      ...demoProducts[0],
      id: `product-${index}`,
    }));
    const result = buildAdminAnalytics({
      createdOrders: rows,
      paidOrders: rows,
      products,
      days: 3,
      now,
    });
    expect(result.scope).toEqual({
      orderLimit: 1000,
      productLimit: 1000,
      createdOrders: 1000,
      paidOrders: 1000,
      products: 1000,
      createdOrdersTruncated: true,
      paidOrdersTruncated: true,
      productsTruncated: true,
      truncated: true,
    });
    expect(result.recentOrders).toHaveLength(10);
  });

  it("queries the paidAt index separately so older newly-paid orders reach aggregation", async () => {
    const late = order({ createdAt: now - 100 * DAY, paidAt: now });
    const store = new MemoryStore({ orders: { [late.id]: late } });
    const list = vi.spyOn(store, "list");
    const result = await getAdminAnalytics(3, store, now);
    expect(result.metrics).toMatchObject({ orders: 0, paidOrders: 1, revenue: late.total });
    expect(
      list.mock.calls.some(
        ([collection, filters, options]) =>
          collection === "orders" &&
          options?.orderBy === "paidAt" &&
          filters?.some((filter) => filter.field === "paymentStatus" && filter.value === "paid"),
      ),
    ).toBe(true);
    expect(list.mock.calls.every(([, , options]) => options?.limit === 1000)).toBe(true);
    await expect(getAdminAnalytics(91, store, now)).rejects.toThrow();
  });
});

function request(path: string, body: unknown, origin: string | null = "http://127.0.0.1:3000") {
  return new Request(`http://127.0.0.1:3000${path}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", ...(origin ? { origin } : {}) },
    body: JSON.stringify(body),
  });
}

describe("operations API boundaries", () => {
  it("rejects cross-origin writes, customers, payment injection, and unpaid fulfillment", async () => {
    const body = { id: "order-one", fulfillmentStatus: "processing", trackingNumber: "" };
    expect(
      (await ordersPatch(request("/api/admin/orders", body, "https://untrusted.example.test")))
        .status,
    ).toBe(403);
    vi.mocked(requireAdmin).mockRejectedValueOnce(
      new AppError(403, "Administrator access is required."),
    );
    expect((await ordersPatch(request("/api/admin/orders", body))).status).toBe(403);
    expect(
      (await ordersPatch(request("/api/admin/orders", { ...body, paymentStatus: "paid" }))).status,
    ).toBe(400);
    await routeStore.set("orders", "order-one", order({ paymentStatus: "pending", paidAt: null }));
    expect((await ordersPatch(request("/api/admin/orders", body))).status).toBe(409);
    expect(await routeStore.list("auditLogs")).toHaveLength(0);
  });

  it("guards every reader and sends successful results with no-store", async () => {
    for (const [path, handler] of [
      ["orders", ordersGet],
      ["customers?q=ada", customersGet],
      ["content", contentGet],
      ["analytics?days=7", analyticsGet],
    ] as const) {
      vi.mocked(requireAdmin).mockRejectedValueOnce(
        new AppError(403, "Administrator access is required."),
      );
      expect((await handler(new Request(`http://127.0.0.1:3000/api/admin/${path}`))).status).toBe(
        403,
      );
      const response = await handler(new Request(`http://127.0.0.1:3000/api/admin/${path}`));
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("rate-limits successful content and fulfillment writes and returns persisted shapes", async () => {
    const fulfillment = await ordersPatch(
      request("/api/admin/orders", {
        id: "order-one",
        fulfillmentStatus: "processing",
        trackingNumber: "",
      }),
    );
    expect((await fulfillment.json()).order.fulfillmentStatus).toBe("processing");
    const content = await contentPatch(
      request("/api/admin/content", { ...contentInput(), heroTitle: "A test headline" }),
    );
    expect((await content.json()).content.heroTitle).toBe("A test headline");
    expect(rateLimit).toHaveBeenCalledWith("operations:fulfillment:admin", 60, 60_000);
    expect(rateLimit).toHaveBeenCalledWith("operations:content:admin", 30, 60_000);
    expect((await readHomeContent(routeStore)).heroTitle).toBe("A test headline");
    expect((await contentPatch(request("/api/admin/content", contentInput(), null))).status).toBe(
      403,
    );
  });
});
