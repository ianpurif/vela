import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { cartSchema, documentId } from "@/lib/validation/commerce";
import { calculateTotals } from "@/features/cart/pricing";
import { firestoreStore } from "@/server/repositories/firestore-store";
import type { CommerceStore } from "@/server/repositories/store";
import type { SessionUser } from "@/server/auth";
import type { CartItem, InventoryReservation, Order, Product } from "@/types/commerce";

export const checkoutSchema = z.object({ items: cartSchema, requestKey: z.uuid() }).strict();
export type CheckoutCustomer = { id: string; orderIds: string[]; updatedAt: number };
export const RESERVATION_DURATION = 35 * 60 * 1000;

export function cartFingerprint(items: CartItem[]) {
  return JSON.stringify(
    items
      .map(({ productId, quantity }) => ({ productId, quantity }))
      .sort((a, b) => a.productId.localeCompare(b.productId)),
  );
}
export function assertInventory(product: Product) {
  if (
    !Number.isSafeInteger(product.stock) ||
    !Number.isSafeInteger(product.reserved) ||
    product.reserved < 0 ||
    product.stock < product.reserved
  )
    throw new AppError(
      409,
      "This product’s inventory needs a store review.",
      "INVENTORY_REVIEW_REQUIRED",
    );
}

/** Called only after the test gateway configuration has been validated. */
export async function reserveOrder(
  input: unknown,
  user: SessionUser,
  store: CommerceStore = firestoreStore,
): Promise<Order> {
  const data = checkoutSchema.parse(input);
  if (!user.emailVerified || !user.email)
    throw new AppError(403, "Verify your email before starting test checkout.", "EMAIL_UNVERIFIED");
  const id = `v_${createHash("sha256").update(`${user.uid}:${data.requestKey}`).digest("hex").slice(0, 40)}`;
  const items = [...data.items].sort((a, b) => a.productId.localeCompare(b.productId));
  return store.transaction(async (tx) => {
    const [existing, customer] = await Promise.all([
      tx.get<Order>("orders", id),
      tx.get<CheckoutCustomer>("checkoutCustomers", user.uid),
    ]);
    if (existing) {
      if (
        existing.userId !== user.uid ||
        cartFingerprint(existing.lines) !== cartFingerprint(items)
      )
        throw new AppError(
          409,
          "This checkout attempt belongs to a different cart. Start a new checkout.",
          "CHECKOUT_CONFLICT",
        );
      return existing;
    }
    if ((customer?.orderIds.length ?? 0) >= 3)
      throw new AppError(
        409,
        "You already have three pending checkouts. Complete or cancel one from your orders.",
        "CHECKOUT_LIMIT",
      );
    const products = await Promise.all(
      items.map((item) => tx.get<Product>("products", item.productId)),
    );
    const lines = items.map((item, index) => {
      const product = products[index];
      if (!product || product.status !== "published")
        throw new AppError(
          409,
          "An item in your bag is no longer available. Please review your bag.",
          "PRODUCT_UNAVAILABLE",
        );
      assertInventory(product);
      if (!Number.isSafeInteger(product.price) || product.price < 100 || product.price > 1000000)
        throw new AppError(409, "A product price needs a store review.");
      if (product.stock - product.reserved < item.quantity)
        throw new AppError(
          409,
          `${product.name} has ${product.stock - product.reserved} available. Please update your bag.`,
          "INSUFFICIENT_STOCK",
        );
      return {
        productId: product.id,
        name: product.name,
        image: product.images[0]?.src || "",
        quantity: item.quantity,
        unitPrice: product.price,
      };
    });
    const now = Date.now();
    const order: Order = {
      id,
      userId: user.uid,
      email: user.email,
      lines,
      ...calculateTotals(lines),
      currency: "usd",
      paymentStatus: "pending",
      paidAt: null,
      fulfillmentStatus: "unfulfilled",
      testMode: true,
      sessionId: null,
      checkoutUrl: null,
      requestKey: data.requestKey,
      expiresAt: now + RESERVATION_DURATION,
      shippingAddress: null,
      trackingNumber: "",
      createdAt: now,
      updatedAt: now,
    };
    const reservation: InventoryReservation = {
      id,
      orderId: id,
      items,
      status: "active",
      expiresAt: order.expiresAt,
      reconcileAfter: order.expiresAt + 60000,
      createdAt: now,
      updatedAt: now,
    };
    products.forEach((product, index) => {
      tx.set("products", product!.id, {
        ...product!,
        reserved: product!.reserved + items[index].quantity,
        updatedAt: now,
      });
    });
    tx.set("orders", id, order);
    tx.set("inventoryReservations", id, reservation);
    tx.set("checkoutCustomers", user.uid, {
      id: user.uid,
      orderIds: [...(customer?.orderIds || []), id],
      updatedAt: now,
    });
    return order;
  });
}

export async function getCustomerOrder(
  id: string,
  uid: string,
  store: CommerceStore = firestoreStore,
) {
  if (!documentId.safeParse(id).success) throw new AppError(404, "Order not found.");
  const order = await store.get<Order>("orders", id);
  if (!order || order.userId !== uid) throw new AppError(404, "Order not found.");
  return order;
}
export async function listCustomerOrders(uid: string, store: CommerceStore = firestoreStore) {
  return store.list<Order>("orders", [{ field: "userId", op: "==", value: uid }], {
    orderBy: "createdAt",
    direction: "desc",
    limit: 100,
  });
}

export async function listCustomerOrderPage(
  uid: string,
  afterId?: string,
  store: CommerceStore = firestoreStore,
) {
  const after = afterId ? await getCustomerOrder(afterId, uid, store) : null;
  const rows = await store.list<Order>("orders", [{ field: "userId", op: "==", value: uid }], {
    orderBy: "createdAt",
    direction: "desc",
    limit: 21,
    ...(after ? { startAfter: { value: after.createdAt, id: after.id } } : {}),
  });
  const orders = rows.slice(0, 20);
  return { orders, next: rows.length > 20 ? orders.at(-1)!.id : null };
}
