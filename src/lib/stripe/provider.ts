import "server-only";
import Stripe from "stripe";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import type { Address, Order } from "@/types/commerce";

export type PaymentSession = {
  id: string;
  url: string | null;
  status: "open" | "complete" | "expired";
  paymentStatus: "paid" | "unpaid" | "no_payment_required";
  livemode: boolean;
  orderId: string | null;
  userId: string | null;
  amountTotal: number | null;
  currency: string | null;
  /** Epoch milliseconds, like the Order domain contract. */
  expiresAt: number;
  shippingAddress: Address | null;
};

export interface PaymentGateway {
  createSession(order: Order): Promise<PaymentSession>;
  retrieveSession(id: string): Promise<PaymentSession>;
  expireSession(id: string): Promise<PaymentSession>;
  findSession(order: Order): Promise<PaymentSession | null>;
}

export type VerifiedStripeEvent = {
  id: string;
  type: string;
  livemode: boolean;
  session: PaymentSession | null;
};

/** A narrow SDK boundary also lets unit tests run without network access. */
export interface StripeSessionClient {
  create(
    params: Stripe.Checkout.SessionCreateParams,
    options: Stripe.RequestOptions,
  ): Promise<Stripe.Checkout.Session>;
  retrieve(id: string): Promise<Stripe.Checkout.Session>;
  expire(id: string): Promise<Stripe.Checkout.Session>;
  list(params: Stripe.Checkout.SessionListParams): Promise<{
    data: Stripe.Checkout.Session[];
    has_more: boolean;
  }>;
}

const shippingDetailsSchema = z.object({
  name: z.string(),
  address: z.object({
    line1: z.string().nullable(),
    line2: z.string().nullable(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    postal_code: z.string().nullable(),
    country: z.string().nullable(),
  }),
});
const sessionSchema = z.object({
  id: z.string().regex(/^cs_test_[A-Za-z0-9_]+$/),
  object: z.literal("checkout.session"),
  mode: z.literal("payment"),
  url: z.string().nullable(),
  status: z.enum(["open", "complete", "expired"]),
  payment_status: z.enum(["paid", "unpaid", "no_payment_required"]),
  payment_method_types: z.array(z.literal("card")).min(1),
  livemode: z.boolean(),
  metadata: z.record(z.string(), z.string()).nullable(),
  client_reference_id: z.string().nullable(),
  amount_total: z.number().int().nonnegative().nullable(),
  currency: z
    .string()
    .regex(/^[a-z]{3}$/)
    .nullable(),
  expires_at: z
    .number()
    .int()
    .positive()
    .max(Math.floor(Number.MAX_SAFE_INTEGER / 1000)),
  collected_information: z.object({ shipping_details: shippingDetailsSchema.nullable() }).nullish(),
  // Older snapshot event versions placed shipping_details at the top level.
  shipping_details: shippingDetailsSchema.nullish(),
});

function unavailable() {
  return new AppError(503, "Test checkout is not connected yet.", "PAYMENTS_UNAVAILABLE");
}

function testSecretKey() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw unavailable();
  if (!key.startsWith("sk_test_") || key.length <= 8 || key.trim() !== key) {
    throw new AppError(503, "Only Stripe test-mode checkout is enabled.", "STRIPE_TEST_MODE_ONLY");
  }
  return key;
}

export function validateCheckoutOrigin(value: string | undefined): string {
  if (!value) throw unavailable();
  try {
    const url = new URL(value);
    const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
    const localHttp = url.protocol === "http:" && loopback && !process.env.VERCEL;
    if (
      (url.protocol !== "https:" && !localHttp) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      value.trim() !== value ||
      (loopback && process.env.VERCEL)
    ) {
      throw new Error("Invalid checkout origin");
    }
    return url.origin;
  } catch {
    throw new AppError(
      503,
      "A safe checkout return URL is not configured.",
      "CHECKOUT_ORIGIN_INVALID",
    );
  }
}

function invalidSession() {
  return new AppError(
    502,
    "Stripe returned an unverifiable checkout session.",
    "STRIPE_SESSION_INVALID",
  );
}

export function normalizePaymentSession(value: unknown): PaymentSession {
  const parsed = sessionSchema.safeParse(value);
  if (!parsed.success) throw invalidSession();
  const session = parsed.data;
  if (session.livemode) {
    throw new AppError(502, "Live Stripe sessions are disabled.", "STRIPE_LIVE_SESSION");
  }
  const orderId = session.metadata?.orderId || null;
  if ((session.client_reference_id || null) !== orderId) {
    throw new AppError(502, "Stripe checkout identity does not match.", "STRIPE_SESSION_MISMATCH");
  }
  if (session.url !== null) {
    try {
      const url = new URL(session.url);
      if (url.protocol !== "https:" || url.username || url.password) throw invalidSession();
    } catch {
      throw invalidSession();
    }
  }
  const shipping = session.collected_information?.shipping_details ?? session.shipping_details;
  return {
    id: session.id,
    url: session.url,
    status: session.status,
    paymentStatus: session.payment_status,
    livemode: false,
    orderId,
    userId: session.metadata?.userId || null,
    amountTotal: session.amount_total,
    currency: session.currency,
    expiresAt: session.expires_at * 1000,
    shippingAddress: shipping
      ? {
          id: "stripe-shipping",
          name: shipping.name,
          line1: shipping.address.line1 ?? "",
          line2: shipping.address.line2 ?? "",
          city: shipping.address.city ?? "",
          state: shipping.address.state ?? "",
          postalCode: shipping.address.postal_code ?? "",
          country: shipping.address.country ?? "",
        }
      : null,
  };
}

function assertOrderSnapshot(order: Order) {
  const cents = (value: number) => Number.isSafeInteger(value) && value >= 0;
  if (
    order.testMode !== true ||
    order.currency !== "usd" ||
    !order.id ||
    !order.userId ||
    !order.email ||
    !Number.isSafeInteger(order.createdAt) ||
    !Number.isSafeInteger(order.expiresAt) ||
    order.createdAt <= 0 ||
    order.expiresAt <= order.createdAt ||
    !order.lines.length ||
    order.lines.length > 100 ||
    order.lines.some(
      (line) =>
        !line.productId ||
        !line.name ||
        !Number.isSafeInteger(line.quantity) ||
        line.quantity < 1 ||
        !cents(line.unitPrice) ||
        line.unitPrice < 1,
    ) ||
    !cents(order.subtotal) ||
    !cents(order.shipping) ||
    !cents(order.total) ||
    order.subtotal !== order.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0) ||
    order.total !== order.subtotal + order.shipping
  ) {
    throw new AppError(
      409,
      "The saved order cannot be used for checkout.",
      "ORDER_SNAPSHOT_INVALID",
    );
  }
}

export function buildCheckoutParams(
  order: Order,
  appUrl: string,
): Stripe.Checkout.SessionCreateParams {
  assertOrderSnapshot(order);
  const origin = validateCheckoutOrigin(appUrl);
  const success = new URL("/checkout/success", origin);
  success.searchParams.set("order", order.id);
  const cancel = new URL("/checkout", origin);
  cancel.searchParams.set("order", order.id);
  cancel.searchParams.set("cancelled", "1");
  return {
    mode: "payment",
    ui_mode: "hosted_page",
    allowed_payment_method_types: ["card"],
    adaptive_pricing: { enabled: false },
    automatic_tax: { enabled: false },
    allow_promotion_codes: false,
    customer_email: order.email,
    client_reference_id: order.id,
    metadata: { orderId: order.id, userId: order.userId },
    line_items: order.lines.map((line) => ({
      quantity: line.quantity,
      price_data: {
        currency: order.currency,
        unit_amount: line.unitPrice,
        product_data: { name: line.name, metadata: { productId: line.productId } },
      },
    })),
    shipping_address_collection: { allowed_countries: ["US"] },
    shipping_options: [
      {
        shipping_rate_data: {
          type: "fixed_amount",
          fixed_amount: { amount: order.shipping, currency: order.currency },
          display_name:
            order.shipping === 0 ? "Complimentary standard shipping" : "Standard shipping",
        },
      },
    ],
    expires_at: Math.floor(order.expiresAt / 1000),
    success_url: success.toString(),
    cancel_url: cancel.toString(),
  };
}

function assertMatchesOrder(session: PaymentSession, order: Order) {
  if (
    session.orderId !== order.id ||
    session.userId !== order.userId ||
    session.amountTotal !== order.total ||
    session.currency !== order.currency ||
    session.expiresAt !== Math.floor(order.expiresAt / 1000) * 1000
  ) {
    throw new AppError(
      502,
      "Stripe checkout does not match the saved order.",
      "STRIPE_SESSION_MISMATCH",
    );
  }
}

async function providerRequest<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (error) {
    if (error instanceof AppError) throw error;
    // An API timeout can follow a successful create/expire. Never convert it to
    // absence or include provider error text (which can contain request data).
    throw new AppError(
      502,
      "Stripe checkout could not be verified. Please retry.",
      "STRIPE_PROVIDER_ERROR",
    );
  }
}

export function createPaymentGateway(client: StripeSessionClient, appUrl: string): PaymentGateway {
  const origin = validateCheckoutOrigin(appUrl);
  const byId = async (id: string, request: (id: string) => Promise<Stripe.Checkout.Session>) => {
    if (!/^cs_test_[A-Za-z0-9_]+$/.test(id)) throw invalidSession();
    const session = normalizePaymentSession(await providerRequest(() => request(id)));
    if (session.id !== id) throw invalidSession();
    return session;
  };
  return {
    async createSession(order) {
      const params = buildCheckoutParams(order, origin);
      const session = normalizePaymentSession(
        await providerRequest(() => client.create(params, { idempotencyKey: order.id })),
      );
      assertMatchesOrder(session, order);
      return session;
    },
    retrieveSession: (id) => byId(id, (sessionId) => client.retrieve(sessionId)),
    expireSession: (id) => byId(id, (sessionId) => client.expire(sessionId)),
    async findSession(order) {
      assertOrderSnapshot(order);
      const created = {
        gte: Math.max(0, Math.floor(order.createdAt / 1000) - 60),
        lte: Math.ceil(order.expiresAt / 1000) + 60,
      };
      let candidate: PaymentSession | null = null;
      let cursor: string | undefined;
      const seen = new Set<string>();
      // Exhaust the complete creation window. The bound is an error, never an
      // empty result: inventory stays held when recovery cannot prove absence.
      for (let pageNumber = 0; pageNumber < 100; pageNumber += 1) {
        const page = await providerRequest(() =>
          client.list({ created, limit: 100, ...(cursor ? { starting_after: cursor } : {}) }),
        );
        if (!page || !Array.isArray(page.data) || typeof page.has_more !== "boolean") {
          throw invalidSession();
        }
        for (const raw of page.data) {
          if (!raw.id || seen.has(raw.id) || raw.livemode !== false) throw invalidSession();
          seen.add(raw.id);
          if (raw.metadata?.orderId !== order.id && raw.client_reference_id !== order.id) continue;
          const session = normalizePaymentSession(raw);
          assertMatchesOrder(session, order);
          if (candidate) {
            throw new AppError(
              409,
              "Multiple Stripe sessions require reconciliation.",
              "CHECKOUT_RECOVERY_AMBIGUOUS",
            );
          }
          candidate = session;
        }
        if (!page.has_more) return candidate;
        cursor = page.data.at(-1)?.id;
        if (!cursor) throw invalidSession();
      }
      throw new AppError(
        503,
        "Checkout recovery could not finish. Please retry later.",
        "CHECKOUT_RECOVERY_INCOMPLETE",
      );
    },
  };
}

export function getPaymentGateway(): PaymentGateway {
  const key = testSecretKey();
  const origin = validateCheckoutOrigin(process.env.NEXT_PUBLIC_APP_URL);
  const stripe = new Stripe(key, {
    apiVersion: Stripe.API_VERSION,
    maxNetworkRetries: 2,
    timeout: 10000,
  });
  return createPaymentGateway(stripe.checkout.sessions, origin);
}

const checkoutEvents = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
]);
const velaOrderId = /^v_[a-f0-9]{40}$/;

function claimsVelaOrder(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const session = value as Record<string, unknown>;
  const metadata = session.metadata;
  const metadataOrderId =
    metadata && typeof metadata === "object"
      ? (metadata as Record<string, unknown>).orderId
      : undefined;
  return [metadataOrderId, session.client_reference_id].some(
    (id) => typeof id === "string" && velaOrderId.test(id),
  );
}

export function verifyStripeEvent(body: string, signature: string | null): VerifiedStripeEvent {
  testSecretKey();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !secret.startsWith("whsec_") || secret.length <= 6) throw unavailable();
  if (!signature)
    throw new AppError(400, "Stripe signature is missing.", "STRIPE_SIGNATURE_INVALID");
  let event: Stripe.Event;
  try {
    // Verify the exact raw body before reading any event fields. The SDK's
    // default five-minute tolerance also rejects old captured signatures.
    event = Stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    throw new AppError(400, "Stripe signature is invalid.", "STRIPE_SIGNATURE_INVALID");
  }
  if (!event || typeof event !== "object") {
    throw new AppError(400, "Stripe event is invalid.", "STRIPE_EVENT_INVALID");
  }
  if (event.livemode !== false) {
    throw new AppError(400, "Live Stripe events are disabled.", "STRIPE_LIVE_EVENT");
  }
  if (typeof event.id !== "string" || !event.id || typeof event.type !== "string" || !event.type) {
    throw new AppError(400, "Stripe event is invalid.", "STRIPE_EVENT_INVALID");
  }
  let session: PaymentSession | null = null;
  // A shared Stripe account can emit unrelated subscriptions/checkouts. Ignore
  // those, but never ignore malformed data claiming one of VELA's order IDs.
  if (checkoutEvents.has(event.type) && claimsVelaOrder(event.data?.object)) {
    try {
      session = normalizePaymentSession(event.data?.object);
    } catch {
      throw new AppError(400, "Stripe checkout event is invalid.", "STRIPE_EVENT_INVALID");
    }
  }
  return { id: event.id, type: event.type, livemode: false, session };
}
