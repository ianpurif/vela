import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { deleteApp, getApps } from "firebase-admin/app";
import { getAdminDb } from "@/lib/firebase/admin";
import { firestoreStore } from "@/server/repositories/firestore-store";
import { reserveOrder } from "@/server/services/orders";
import { processVerifiedPaymentEvent } from "@/server/services/payments";
import { demoProducts } from "@/features/catalog/fixtures";
import type { Order, Product } from "@/types/commerce";

const projectId = "demo-vela-payment-tests";
const uid = `buyer_${randomUUID().replaceAll("-", "")}`;
const id = `product_${randomUUID().replaceAll("-", "")}`;
const user = {
  uid,
  email: "payment-test@example.test",
  name: "Payment test",
  admin: false,
  emailVerified: true,
};
let order: Order;
const eventId = `evt_${randomUUID().replaceAll("-", "")}`;

beforeAll(async () => {
  vi.stubEnv("VELA_DATA_MODE", "firebase");
  vi.stubEnv("NEXT_PUBLIC_USE_FIREBASE_EMULATORS", "true");
  vi.stubEnv("FIREBASE_PROJECT_ID", projectId);
  vi.stubEnv("FIRESTORE_EMULATOR_HOST", "127.0.0.1:8080");
  vi.stubEnv("FIREBASE_AUTH_EMULATOR_HOST", "127.0.0.1:9099");
  await firestoreStore.set("products", id, {
    ...demoProducts[1],
    id,
    slug: id,
    stock: 1,
    reserved: 0,
  });
});
afterAll(async () => {
  const db = getAdminDb();
  // Only remove this test's named records from the isolated, loopback-only demo project.
  const batch = db.batch();
  batch.delete(db.doc(`products/${id}`));
  batch.delete(db.doc(`checkoutCustomers/${uid}`));
  batch.delete(db.doc(`checkoutCustomers/${uid}_other`));
  batch.delete(db.doc(`stripeWebhookEvents/${eventId}`));
  if (order) {
    batch.delete(db.doc(`orders/${order.id}`));
    batch.delete(db.doc(`inventoryReservations/${order.id}`));
    const logs = await db.collection("auditLogs").where("entityId", "==", order.id).get();
    logs.docs.forEach((doc) => batch.delete(doc.ref));
  }
  await batch.commit();
  await db.terminate();
  const app = getApps().find((item) => item.name === "vela-admin");
  if (app) await deleteApp(app);
  vi.unstubAllEnvs();
});

it("serializes competing purchases of the last unit in actual Firestore transactions", async () => {
  const results = await Promise.allSettled([
    reserveOrder({ items: [{ productId: id, quantity: 1 }], requestKey: randomUUID() }, user),
    reserveOrder(
      { items: [{ productId: id, quantity: 1 }], requestKey: randomUUID() },
      { ...user, uid: `${uid}_other` },
    ),
  ]);
  const success = results.find(
    (result) => result.status === "fulfilled",
  ) as PromiseFulfilledResult<Order>;
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  order = success.value;
  expect(await firestoreStore.get<Product>("products", id)).toMatchObject({
    stock: 1,
    reserved: 1,
  });
});

it("deduplicates simultaneous payment deliveries and commits inventory with the order", async () => {
  expect(order).toBeDefined();
  const event = {
    id: eventId,
    type: "checkout.session.completed",
    livemode: false,
    session: {
      id: `cs_test_${order.id}`,
      url: null,
      status: "complete" as const,
      paymentStatus: "paid" as const,
      livemode: false,
      orderId: order.id,
      userId: order.userId,
      amountTotal: order.total,
      currency: "usd",
      expiresAt: Math.floor(order.expiresAt / 1000) * 1000,
      shippingAddress: null,
    },
  };
  await Promise.all([processVerifiedPaymentEvent(event), processVerifiedPaymentEvent(event)]);
  expect(await firestoreStore.get("products", id)).toMatchObject({ stock: 0, reserved: 0 });
  expect(await firestoreStore.get("orders", order.id)).toMatchObject({
    paymentStatus: "paid",
    fulfillmentStatus: "unfulfilled",
  });
  expect(await firestoreStore.get("inventoryReservations", order.id)).toMatchObject({
    status: "confirmed",
  });
});
