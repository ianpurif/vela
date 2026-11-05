import { afterEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { demoProducts } from "@/features/catalog/fixtures";
import {
  reserveOrder,
  getCustomerOrder,
  listCustomerOrders,
  listCustomerOrderPage,
} from "@/server/services/orders";
import {
  cancelCheckout,
  processVerifiedPaymentEvent,
  reconcileReservations,
  startCheckout,
} from "@/server/services/payments";
import type { PaymentGateway, PaymentSession } from "@/lib/stripe/provider";
import type { SessionUser } from "@/server/auth";
import type { Order, InventoryReservation } from "@/types/commerce";
import { MemoryStore } from "./helpers/memory-store";

const user: SessionUser = {
  uid: "buyer",
  email: "buyer@example.test",
  name: "Buyer",
  admin: false,
  emailVerified: true,
};
const product = { ...demoProducts[1], stock: 10, reserved: 0 };
const input = (quantity = 1, requestKey = randomUUID()) => ({
  items: [{ productId: product.id, quantity }],
  requestKey,
});
const makeStore = (stock = 10) =>
  new MemoryStore({ products: { [product.id]: { ...product, stock } } });
function session(order: Order, overrides: Partial<PaymentSession> = {}): PaymentSession {
  return {
    id: `cs_test_${order.id}`,
    url: "https://checkout.stripe.com/c/pay/cs_test_fixture",
    status: "open",
    paymentStatus: "unpaid",
    livemode: false,
    orderId: order.id,
    userId: order.userId,
    amountTotal: order.total,
    currency: "usd",
    expiresAt: Math.floor(order.expiresAt / 1000) * 1000,
    shippingAddress: null,
    ...overrides,
  };
}
function gateway(): PaymentGateway & { sessions: Map<string, PaymentSession> } {
  const sessions = new Map<string, PaymentSession>();
  return {
    sessions,
    createSession: vi.fn(async (order) => {
      const existing = [...sessions.values()].find((value) => value.orderId === order.id);
      const result = existing || session(order);
      sessions.set(result.id, result);
      return result;
    }),
    retrieveSession: vi.fn(async (id) => {
      const result = sessions.get(id);
      if (!result) throw new Error("Unknown session");
      return result;
    }),
    expireSession: vi.fn(async (id) => {
      const existing = sessions.get(id);
      if (!existing || existing.status !== "open") throw new Error("Not open");
      const result: PaymentSession = { ...existing, status: "expired", url: null };
      sessions.set(id, result);
      return result;
    }),
    findSession: vi.fn(
      async (order) => [...sessions.values()].find((value) => value.orderId === order.id) || null,
    ),
  };
}
function event(
  order: Order,
  id = `evt_${randomUUID().replaceAll("-", "")}`,
  overrides: Partial<PaymentSession> = {},
  type = "checkout.session.completed",
) {
  return {
    id,
    type,
    livemode: false,
    session: session(order, { status: "complete", paymentStatus: "paid", ...overrides }),
  };
}
afterEach(() => vi.useRealTimers());

describe("authoritative orders and stock reservations", () => {
  it("snapshots server prices, adds shipping and reserves without selling stock", async () => {
    const store = makeStore();
    const order = await reserveOrder(input(), user, store);
    expect(order).toMatchObject({
      subtotal: 4800,
      shipping: 600,
      total: 5400,
      paymentStatus: "pending",
      testMode: true,
      paidAt: null,
    });
    expect(await store.get("products", product.id)).toMatchObject({ stock: 10, reserved: 1 });
    expect(await store.get("inventoryReservations", order.id)).toMatchObject({
      status: "active",
      items: [{ productId: product.id, quantity: 1 }],
    });
  });
  it("does not accept browser prices or duplicate product rows", async () => {
    const store = makeStore();
    const data = input();
    await expect(reserveOrder({ ...data, total: 1 }, user, store)).rejects.toThrow();
    await expect(
      reserveOrder({ ...data, items: [...data.items, ...data.items] }, user, store),
    ).rejects.toThrow();
    expect(await store.list("orders")).toHaveLength(0);
  });
  it("rejects unverified customers before reserving inventory", async () => {
    const store = makeStore();
    await expect(
      reserveOrder(input(), { ...user, emailVerified: false }, store),
    ).rejects.toMatchObject({ status: 403 });
    expect(await store.list("orders")).toHaveLength(0);
  });
  it("same request key is idempotent while different cart content is rejected", async () => {
    const store = makeStore();
    const data = input();
    const results = await Promise.all(
      Array.from({ length: 8 }, () => reserveOrder(data, user, store)),
    );
    expect(new Set(results.map((order) => order.id)).size).toBe(1);
    expect(await store.get("products", product.id)).toMatchObject({ reserved: 1 });
    await expect(reserveOrder(input(2, data.requestKey), user, store)).rejects.toMatchObject({
      code: "CHECKOUT_CONFLICT",
    });
  });
  it("concurrent buyers cannot reserve the last unit twice", async () => {
    const store = makeStore(1);
    const results = await Promise.allSettled([
      reserveOrder(input(), user, store),
      reserveOrder(input(), { ...user, uid: "other" }, store),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await store.get("products", product.id)).toMatchObject({ stock: 1, reserved: 1 });
  });
  it("limits pending checkouts atomically and frees the slot on settlement", async () => {
    const store = makeStore();
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () => reserveOrder(input(), user, store)),
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(3);
    const order = (results[0] as PromiseFulfilledResult<Order>).value;
    await processVerifiedPaymentEvent(event(order), store);
    await expect(reserveOrder(input(), user, store)).resolves.toMatchObject({
      paymentStatus: "pending",
    });
  });
  it("keeps the saved price when catalog prices change during retry", async () => {
    const store = makeStore();
    const data = input();
    const first = await reserveOrder(data, user, store);
    await store.set("products", product.id, { ...product, reserved: 1, price: 9999 });
    expect((await reserveOrder(data, user, store)).total).toBe(first.total);
  });
  it("hides other customers’ orders and lists only owned orders", async () => {
    const store = makeStore();
    const order = await reserveOrder(input(), user, store);
    await expect(getCustomerOrder(order.id, "other", store)).rejects.toMatchObject({ status: 404 });
    expect(await listCustomerOrders("other", store)).toEqual([]);
    expect(await listCustomerOrders(user.uid, store)).toHaveLength(1);
  });
  it("paginates complete customer history with equal timestamps and rejects foreign cursors", async () => {
    const store = makeStore();
    const order = await reserveOrder(input(), user, store);
    for (let index = 0; index < 24; index++)
      await store.set("orders", `history_${index.toString().padStart(2, "0")}`, {
        ...order,
        id: `history_${index.toString().padStart(2, "0")}`,
      });
    await store.set("orders", "foreign_cursor", {
      ...order,
      id: "foreign_cursor",
      userId: "other",
    });
    const first = await listCustomerOrderPage(user.uid, undefined, store);
    const second = await listCustomerOrderPage(user.uid, first.next!, store);
    expect(first.orders).toHaveLength(20);
    expect(second.orders).toHaveLength(5);
    expect(second.next).toBeNull();
    expect(new Set([...first.orders, ...second.orders].map((row) => row.id)).size).toBe(25);
    await expect(listCustomerOrderPage(user.uid, "foreign_cursor", store)).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe("checkout and cancellation", () => {
  it("reuses the same provider session and reservation on repeated checkout", async () => {
    const store = makeStore();
    const api = gateway();
    const data = input();
    const first = await startCheckout(data, user, store, api);
    const second = await startCheckout(data, user, store, api);
    expect(first.sessionId).toBe(second.sessionId);
    expect(api.createSession).toHaveBeenCalledTimes(1);
    expect(await store.get("products", product.id)).toMatchObject({ reserved: 1 });
  });
  it("keeps inventory held after an ambiguous provider failure and recovers the same session", async () => {
    const store = makeStore();
    const api = gateway();
    const data = input();
    const create = api.createSession;
    api.createSession = vi.fn(async (order) => {
      await create(order);
      throw new Error("network timeout after creation");
    });
    await expect(startCheckout(data, user, store, api)).rejects.toThrow("network timeout");
    expect(await store.get("products", product.id)).toMatchObject({ reserved: 1 });
    api.createSession = create;
    const order = await startCheckout(data, user, store, api);
    expect(api.sessions.size).toBe(1);
    expect(order.sessionId).not.toBeNull();
  });
  it("does not create another session once less than 30 minutes remain", async () => {
    vi.useFakeTimers();
    const store = makeStore();
    const api = gateway();
    const data = input();
    const order = await reserveOrder(data, user, store);
    vi.setSystemTime(order.createdAt + 6 * 60 * 1000);
    expect((await startCheckout(data, user, store, api)).sessionId).toBeNull();
    expect(api.createSession).not.toHaveBeenCalled();
    expect(await store.get("products", product.id)).toMatchObject({ reserved: 1 });
  });
  it("cancels only after provider expiration and releases stock exactly once", async () => {
    const store = makeStore();
    const api = gateway();
    const order = await startCheckout(input(), user, store, api);
    expect((await cancelCheckout(order.id, user.uid, store, api)).paymentStatus).toBe("cancelled");
    await cancelCheckout(order.id, user.uid, store, api);
    expect(api.expireSession).toHaveBeenCalledTimes(1);
    expect(await store.get("products", product.id)).toMatchObject({ stock: 10, reserved: 0 });
  });
  it("does not release completed paid sessions while the webhook is delayed", async () => {
    const store = makeStore();
    const api = gateway();
    const order = await startCheckout(input(), user, store, api);
    api.sessions.set(
      order.sessionId!,
      session(order, { status: "complete", paymentStatus: "paid" }),
    );
    await expect(cancelCheckout(order.id, user.uid, store, api)).rejects.toMatchObject({
      code: "PAYMENT_PROCESSING",
    });
    expect((await getCustomerOrder(order.id, user.uid, store)).paymentStatus).toBe("pending");
    expect(await store.get("products", product.id)).toMatchObject({ reserved: 1 });
  });
  it("does not cancel an unattached session while creation may still be in flight", async () => {
    const store = makeStore();
    const api = gateway();
    const order = await reserveOrder(input(), user, store);
    await expect(cancelCheckout(order.id, user.uid, store, api)).rejects.toMatchObject({
      code: "CHECKOUT_PREPARING",
    });
    expect(await store.get("products", product.id)).toMatchObject({ reserved: 1 });
  });
});

describe("verified webhook state transitions", () => {
  it("deduplicates identical and separately delivered success events atomically", async () => {
    const store = makeStore();
    const order = await reserveOrder(input(2), user, store);
    const paid = event(order);
    await Promise.all([
      processVerifiedPaymentEvent(paid, store),
      processVerifiedPaymentEvent(paid, store),
      processVerifiedPaymentEvent(event(order), store),
    ]);
    expect(await store.get("products", product.id)).toMatchObject({ stock: 8, reserved: 0 });
    expect(await store.get("orders", order.id)).toMatchObject({
      paymentStatus: "paid",
      fulfillmentStatus: "unfulfilled",
      paidAt: expect.any(Number),
    });
    expect(await store.get("inventoryReservations", order.id)).toMatchObject({
      status: "confirmed",
    });
  });
  it.each([
    { amountTotal: 1 },
    { currency: "eur" },
    { userId: "other" },
    { orderId: "wrong" },
    { livemode: true },
    { expiresAt: 1 },
  ])("rejects mismatched payment facts %j", async (patch) => {
    const store = makeStore();
    const order = await reserveOrder(input(), user, store);
    await expect(
      processVerifiedPaymentEvent(event(order, undefined, patch), store),
    ).rejects.toThrow();
    expect(await store.get("products", product.id)).toMatchObject({ stock: 10, reserved: 1 });
    expect(await store.list("stripeWebhookEvents")).toHaveLength(0);
  });
  it("rejects a different session once one has been attached", async () => {
    const store = makeStore();
    const api = gateway();
    const order = await startCheckout(input(), user, store, api);
    await expect(
      processVerifiedPaymentEvent(event(order, undefined, { id: "cs_test_wrong" }), store),
    ).rejects.toMatchObject({ code: "PAYMENT_MISMATCH" });
  });
  it("unpaid completed events and payment-intent failures cannot falsely settle checkout", async () => {
    const store = makeStore();
    const order = await reserveOrder(input(), user, store);
    await processVerifiedPaymentEvent(event(order, undefined, { paymentStatus: "unpaid" }), store);
    await processVerifiedPaymentEvent(
      {
        id: "evt_unrelated",
        type: "payment_intent.payment_failed",
        livemode: false,
        session: null,
      },
      store,
    );
    expect(await store.get("orders", order.id)).toMatchObject({ paymentStatus: "pending" });
    expect(await store.get("products", product.id)).toMatchObject({ reserved: 1 });
  });
  it.each([
    ["checkout.session.expired", "expired", "expired"],
    ["checkout.session.async_payment_failed", "complete", "failed"],
  ] as const)("releases inventory for %s only once", async (type, status, result) => {
    const store = makeStore();
    const order = await reserveOrder(input(), user, store);
    const failure = event(order, undefined, { status, paymentStatus: "unpaid" }, type);
    await processVerifiedPaymentEvent(failure, store);
    await processVerifiedPaymentEvent(failure, store);
    expect(await store.get("orders", order.id)).toMatchObject({ paymentStatus: result });
    expect(await store.get("products", product.id)).toMatchObject({ stock: 10, reserved: 0 });
  });
  it("paid orders cannot be downgraded by late expiration/failure events", async () => {
    const store = makeStore();
    const order = await reserveOrder(input(), user, store);
    await processVerifiedPaymentEvent(event(order), store);
    await processVerifiedPaymentEvent(
      event(
        order,
        undefined,
        { status: "expired", paymentStatus: "unpaid" },
        "checkout.session.expired",
      ),
      store,
    );
    expect(await store.get("orders", order.id)).toMatchObject({ paymentStatus: "paid" });
    expect(await store.get("products", product.id)).toMatchObject({ stock: 9, reserved: 0 });
  });
  it("escalates contradictory late payment after release instead of overselling", async () => {
    const store = makeStore();
    const order = await reserveOrder(input(), user, store);
    await processVerifiedPaymentEvent(
      event(
        order,
        undefined,
        { status: "expired", paymentStatus: "unpaid" },
        "checkout.session.expired",
      ),
      store,
    );
    await expect(processVerifiedPaymentEvent(event(order), store)).rejects.toMatchObject({
      code: "PAYMENT_REVIEW_REQUIRED",
    });
    expect(await store.get("products", product.id)).toMatchObject({ stock: 10, reserved: 0 });
  });
  it("rolls back all writes if reserved inventory is inconsistent", async () => {
    const store = makeStore();
    const order = await reserveOrder(input(), user, store);
    await store.set("products", product.id, { ...product, reserved: 0 });
    await expect(processVerifiedPaymentEvent(event(order), store)).rejects.toMatchObject({
      code: "INVENTORY_REVIEW_REQUIRED",
    });
    expect(await store.list("stripeWebhookEvents")).toHaveLength(0);
    expect(await store.get("orders", order.id)).toMatchObject({ paymentStatus: "pending" });
  });
});

describe("expired reservation recovery", () => {
  it("moves delayed webhooks behind newer due reservations instead of starving the queue", async () => {
    vi.useFakeTimers();
    const store = makeStore(100);
    const api = gateway();
    let last: Order | undefined;
    for (let index = 0; index < 51; index++) {
      last = await reserveOrder(input(), { ...user, uid: `queue_${index}` }, store);
      if (index < 50)
        api.sessions.set(
          `cs_test_${last.id}`,
          session(last, { status: "complete", paymentStatus: "paid" }),
        );
      vi.setSystemTime(Date.now() + 1000);
    }
    vi.setSystemTime(last!.expiresAt + 61000);
    expect(await reconcileReservations(store, api)).toMatchObject({
      inspected: 50,
      awaitingWebhook: 50,
      released: 0,
    });
    expect(await reconcileReservations(store, api)).toMatchObject({ inspected: 1, released: 1 });
    expect(await store.get("products", product.id)).toMatchObject({ stock: 100, reserved: 50 });
  });
  it("never releases by local clock alone; provider failure retains stock", async () => {
    vi.useFakeTimers();
    const store = makeStore();
    const api = gateway();
    const order = await reserveOrder(input(), user, store);
    vi.setSystemTime(order.expiresAt + 61000);
    api.findSession = vi.fn().mockRejectedValue(new Error("Stripe unavailable"));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await reconcileReservations(store, api)).toMatchObject({ errors: 1, released: 0 });
    quiet.mockRestore();
    expect(await store.get("products", product.id)).toMatchObject({ reserved: 1 });
  });
  it("recovers orphan sessions and keeps completed payments waiting for signed confirmation", async () => {
    vi.useFakeTimers();
    const store = makeStore();
    const api = gateway();
    const order = await reserveOrder(input(), user, store);
    api.sessions.set(
      `cs_test_${order.id}`,
      session(order, { status: "complete", paymentStatus: "paid" }),
    );
    vi.setSystemTime(order.expiresAt + 61000);
    expect(await reconcileReservations(store, api)).toMatchObject({
      awaitingWebhook: 1,
      released: 0,
    });
    expect(await store.get("orders", order.id)).toMatchObject({
      sessionId: `cs_test_${order.id}`,
      paymentStatus: "pending",
    });
  });
  it("releases a provider-confirmed absent or expired session after the safety margin", async () => {
    vi.useFakeTimers();
    const store = makeStore();
    const api = gateway();
    const missing = await reserveOrder(input(), user, store);
    const existing = await startCheckout(input(), { ...user, uid: "other" }, store, api);
    vi.setSystemTime(existing.expiresAt + 61000);
    expect(await reconcileReservations(store, api)).toMatchObject({
      inspected: 2,
      released: 2,
      errors: 0,
    });
    expect(await store.get("products", product.id)).toMatchObject({ stock: 10, reserved: 0 });
    expect(
      (await store.get<InventoryReservation>("inventoryReservations", missing.id))?.status,
    ).toBe("released");
  });
  it("never recreates checkout for a settled request key", async () => {
    const store = makeStore();
    const api = gateway();
    const data = input();
    const order = await startCheckout(data, user, store, api);
    await cancelCheckout(order.id, user.uid, store, api);
    expect((await startCheckout(data, user, store, api)).paymentStatus).toBe("cancelled");
    expect(api.createSession).toHaveBeenCalledTimes(1);
  });
});
