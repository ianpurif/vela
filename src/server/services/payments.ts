import "server-only";
import { AppError } from "@/lib/errors";
import { getPaymentGateway, type PaymentGateway, type PaymentSession } from "@/lib/stripe/provider";
import { firestoreStore } from "@/server/repositories/firestore-store";
import type { CommerceStore } from "@/server/repositories/store";
import type { SessionUser } from "@/server/auth";
import type { InventoryReservation, Order, Product } from "@/types/commerce";
import {
  assertInventory,
  cartFingerprint,
  getCustomerOrder,
  reserveOrder,
  type CheckoutCustomer,
} from "./orders";
import { audit } from "./admin";

type PaymentEvent = { id: string; type: string; livemode: boolean; session: PaymentSession | null };
type Settlement = "paid" | "failed" | "expired" | "cancelled";
const SUPPORTED_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
]);

export function validatePaymentSession(session: PaymentSession, order: Order) {
  if (
    session.livemode ||
    session.orderId !== order.id ||
    session.userId !== order.userId ||
    session.amountTotal !== order.total ||
    session.currency !== "usd" ||
    (order.sessionId !== null && session.id !== order.sessionId)
  )
    throw new AppError(
      409,
      "Payment details do not match this order. Store review is required.",
      "PAYMENT_MISMATCH",
    );
  if (Math.abs(session.expiresAt - order.expiresAt) >= 1000)
    throw new AppError(409, "Payment expiration does not match this order.", "PAYMENT_MISMATCH");
}
async function attachSession(order: Order, session: PaymentSession, store: CommerceStore) {
  validatePaymentSession(session, order);
  return store.transaction(async (tx) => {
    const current = await tx.get<Order>("orders", order.id);
    if (!current) throw new AppError(404, "Order not found.");
    validatePaymentSession(session, current);
    const updated = {
      ...current,
      sessionId: session.id,
      checkoutUrl:
        current.paymentStatus === "pending" && session.status === "open" ? session.url : null,
      updatedAt: Date.now(),
    };
    tx.set("orders", current.id, updated);
    return updated;
  });
}

export async function startCheckout(
  input: unknown,
  user: SessionUser,
  store: CommerceStore = firestoreStore,
  gateway: PaymentGateway = getPaymentGateway(),
) {
  let order = await reserveOrder(input, user, store);
  if (order.paymentStatus !== "pending") return order;
  if (order.sessionId) {
    const session = await gateway.retrieveSession(order.sessionId);
    validatePaymentSession(session, order);
    if (session.status === "expired" && session.paymentStatus !== "paid")
      return settleOrder(order.id, "expired", session, store);
    return attachSession(order, session, store);
  }
  // Keep the exact creation parameters on retry. Stripe requires >=30 minutes to expiry.
  // Once that window closes, only discover an already-created session; never release on a timeout.
  if (order.expiresAt - Date.now() < 30 * 60 * 1000 + 5000) {
    if (order.expiresAt + 60000 <= Date.now()) return reconcileOrder(order, store, gateway);
    const found = await gateway.findSession(order);
    if (found) return attachSession(order, found, store);
    return order;
  }
  const session = await gateway.createSession(order);
  order = await attachSession(order, session, store);
  return order;
}

/** Atomic inventory transition. A paid transition is called exclusively by the verified webhook path. */
async function settleOrder(
  orderId: string,
  target: Settlement,
  session: PaymentSession | null,
  store: CommerceStore,
  event?: PaymentEvent,
) {
  return store.transaction(async (tx) => {
    const [order, priorEvent] = await Promise.all([
      tx.get<Order>("orders", orderId),
      event ? tx.get("stripeWebhookEvents", event.id) : Promise.resolve(null),
    ]);
    if (!order) throw new AppError(404, "Order not found.");
    if (priorEvent) return order;
    if (session) validatePaymentSession(session, order);
    if (!session && order.sessionId)
      throw new AppError(
        409,
        "The checkout session changed during recovery. Retry reconciliation.",
      );
    // Never downgrade a paid order. Ignore duplicate terminal notifications after a release.
    if (order.paymentStatus !== "pending") {
      if (target === "paid" && order.paymentStatus !== "paid")
        throw new AppError(
          409,
          "Payment arrived after inventory was released. Store review is required.",
          "PAYMENT_REVIEW_REQUIRED",
        );
      if (event)
        tx.set("stripeWebhookEvents", event.id, {
          id: event.id,
          orderId,
          type: event.type,
          outcome: "already_terminal",
          createdAt: Date.now(),
        });
      return order;
    }
    if (
      target === "paid" &&
      (!event || !session || session.paymentStatus !== "paid" || session.status !== "complete")
    )
      throw new AppError(409, "Payment has not been confirmed.");
    const [reservation, customer] = await Promise.all([
      tx.get<InventoryReservation>("inventoryReservations", order.id),
      tx.get<CheckoutCustomer>("checkoutCustomers", order.userId),
    ]);
    if (
      !reservation ||
      reservation.status !== "active" ||
      reservation.orderId !== order.id ||
      cartFingerprint(reservation.items) !== cartFingerprint(order.lines)
    )
      throw new AppError(
        409,
        "The inventory reservation needs a store review.",
        "INVENTORY_REVIEW_REQUIRED",
      );
    const products = await Promise.all(
      order.lines.map((line) => tx.get<Product>("products", line.productId)),
    );
    const now = Date.now();
    const updated: Order = {
      ...order,
      paymentStatus: target,
      paidAt: target === "paid" ? now : null,
      sessionId: session?.id || order.sessionId,
      checkoutUrl: null,
      shippingAddress: target === "paid" ? session!.shippingAddress : order.shippingAddress,
      updatedAt: now,
    };
    products.forEach((product, index) => {
      const quantity = order.lines[index].quantity;
      if (!product)
        throw new AppError(409, "A reserved product is missing.", "INVENTORY_REVIEW_REQUIRED");
      assertInventory(product);
      if (product.reserved < quantity || product.stock < quantity)
        throw new AppError(
          409,
          "Reserved stock needs a store review.",
          "INVENTORY_REVIEW_REQUIRED",
        );
      tx.set("products", product.id, {
        ...product,
        stock: product.stock - (target === "paid" ? quantity : 0),
        reserved: product.reserved - quantity,
        updatedAt: now,
      });
    });
    tx.set("orders", order.id, updated);
    tx.set("inventoryReservations", order.id, {
      ...reservation,
      status: target === "paid" ? "confirmed" : "released",
      updatedAt: now,
    });
    tx.set("checkoutCustomers", order.userId, {
      id: order.userId,
      orderIds: (customer?.orderIds || []).filter((id) => id !== order.id),
      updatedAt: now,
    });
    if (event)
      tx.set("stripeWebhookEvents", event.id, {
        id: event.id,
        orderId,
        type: event.type,
        outcome: target,
        createdAt: now,
      });
    const log = audit(event ? "stripe" : "system", `order.${target}`, order.id, {
      sessionId: session?.id || null,
      eventId: event?.id || null,
      total: order.total,
      testMode: true,
    });
    tx.set("auditLogs", log.id, log);
    return updated;
  });
}

/** The route must first authenticate the raw body with verifyStripeEvent. Never expose this service as a client mutation. */
export async function processVerifiedPaymentEvent(
  event: PaymentEvent,
  store: CommerceStore = firestoreStore,
) {
  if (event.livemode) throw new AppError(400, "Only Stripe test events are accepted.");
  if (!SUPPORTED_EVENTS.has(event.type)) return { received: true, ignored: true };
  const session = event.session;
  if (!session) return { received: true, ignored: true };
  if (!session?.orderId || !/^evt_[a-zA-Z0-9_]+$/.test(event.id))
    throw new AppError(400, "Invalid checkout event.");
  if (session.livemode) throw new AppError(400, "Only Stripe test sessions are accepted.");
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    if (session.paymentStatus !== "paid") return { received: true, pending: true };
    await settleOrder(session.orderId, "paid", session, store, event);
  } else if (event.type === "checkout.session.expired") {
    if (session.status !== "expired" || session.paymentStatus === "paid")
      throw new AppError(400, "Invalid checkout expiration.");
    await settleOrder(session.orderId, "expired", session, store, event);
  } else {
    if (session.paymentStatus === "paid" || session.status !== "complete")
      throw new AppError(400, "Invalid asynchronous payment failure.");
    await settleOrder(session.orderId, "failed", session, store, event);
  }
  return { received: true };
}

export async function cancelCheckout(
  id: string,
  uid: string,
  store: CommerceStore = firestoreStore,
  gateway: PaymentGateway = getPaymentGateway(),
) {
  let order = await getCustomerOrder(id, uid, store);
  if (order.paymentStatus !== "pending") return order;
  let session = order.sessionId
    ? await gateway.retrieveSession(order.sessionId)
    : await gateway.findSession(order);
  if (!session)
    throw new AppError(
      409,
      "Checkout is still being prepared. Retry shortly; your reservation will be reconciled after expiry.",
      "CHECKOUT_PREPARING",
    );
  validatePaymentSession(session, order);
  order = await attachSession(order, session, store);
  if (session.status === "open") session = await gateway.expireSession(session.id);
  validatePaymentSession(session, order);
  if (session.status !== "expired" || session.paymentStatus === "paid")
    throw new AppError(
      409,
      "Stripe is processing this checkout. Wait for payment confirmation.",
      "PAYMENT_PROCESSING",
    );
  return settleOrder(order.id, "cancelled", session, store);
}

async function reconcileOrder(
  order: Order,
  store: CommerceStore,
  gateway: PaymentGateway,
): Promise<Order> {
  if (order.paymentStatus !== "pending" || order.expiresAt + 60000 > Date.now()) return order;
  let session = order.sessionId
    ? await gateway.retrieveSession(order.sessionId)
    : await gateway.findSession(order);
  if (!session) {
    // Only an exhaustive, successful provider lookup after the creation/expiry window proves absence.
    // Missing/ambiguous API responses throw and keep inventory held for a later retry.
    return settleOrder(order.id, "expired", null, store);
  }
  validatePaymentSession(session, order);
  if (session.status === "open") session = await gateway.expireSession(session.id);
  validatePaymentSession(session, order);
  if (session.status === "expired" && session.paymentStatus !== "paid")
    return settleOrder(order.id, "expired", session, store);
  // Completed sessions stay reserved until a verified webhook is delivered or retried in Stripe.
  return attachSession(order, session, store);
}

export async function reconcileReservations(
  store: CommerceStore = firestoreStore,
  gateway: PaymentGateway = getPaymentGateway(),
) {
  const reservations = await store.list<InventoryReservation>(
    "inventoryReservations",
    [
      { field: "status", op: "==", value: "active" },
      { field: "reconcileAfter", op: "<=", value: Date.now() },
    ],
    { orderBy: "reconcileAfter", limit: 50 },
  );
  const result = { inspected: reservations.length, released: 0, awaitingWebhook: 0, errors: 0 };
  for (const reservation of reservations) {
    try {
      const order = await store.get<Order>("orders", reservation.orderId);
      if (!order) throw new Error("Reservation order is missing.");
      const updated = await reconcileOrder(order, store, gateway);
      if (updated.paymentStatus === "expired") result.released++;
      else if (updated.paymentStatus === "pending") result.awaitingWebhook++;
    } catch (error) {
      result.errors++;
      console.error(
        "Reservation reconciliation needs review",
        reservation.orderId,
        error instanceof AppError ? error.code : "PROVIDER_OR_STORAGE_ERROR",
      );
    } finally {
      // Move unresolved work behind newer due reservations, so a delayed webhook or
      // provider error cannot monopolize every recovery batch.
      await store.transaction(async (tx) => {
        const current = await tx.get<InventoryReservation>("inventoryReservations", reservation.id);
        if (current?.status === "active")
          tx.set("inventoryReservations", current.id, {
            ...current,
            reconcileAfter: Date.now() + 5 * 60 * 1000,
            updatedAt: Date.now(),
          });
      });
    }
  }
  return result;
}
