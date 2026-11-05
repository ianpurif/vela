import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildCheckoutParams,
  createPaymentGateway,
  getPaymentGateway,
  normalizePaymentSession,
  validateCheckoutOrigin,
  verifyStripeEvent,
  type StripeSessionClient,
} from "@/lib/stripe/provider";
import type { Order } from "@/types/commerce";

const origin = "https://vela.example.test";
const webhookSecret = "whsec_local_signature_fixture_only";
const createdAt = 1793980800123;
const order: Order = {
  id: `v_${"a".repeat(40)}`,
  userId: "user-fixture",
  email: "customer@example.test",
  lines: [
    {
      productId: "serum",
      name: "Saved serum name",
      image: "/images/serum.jpg",
      quantity: 2,
      unitPrice: 4800,
    },
    {
      productId: "cream",
      name: "Saved cream name",
      image: "/images/cream.jpg",
      quantity: 1,
      unitPrice: 5200,
    },
  ],
  subtotal: 14800,
  shipping: 800,
  total: 15600,
  currency: "usd",
  paymentStatus: "pending",
  paidAt: null,
  fulfillmentStatus: "unfulfilled",
  testMode: true,
  sessionId: null,
  checkoutUrl: null,
  requestKey: "local-request-fixture",
  expiresAt: createdAt + 35 * 60_000,
  shippingAddress: null,
  trackingNumber: "",
  createdAt,
  updatedAt: createdAt,
};

function session(overrides: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
  // Only fields consumed by this boundary are needed in the SDK response fixture.
  return {
    id: "cs_test_fixture",
    object: "checkout.session",
    mode: "payment",
    status: "open",
    payment_status: "unpaid",
    payment_method_types: ["card"],
    livemode: false,
    url: "https://checkout.stripe.com/c/pay/cs_test_fixture",
    client_reference_id: order.id,
    metadata: { orderId: order.id, userId: order.userId },
    amount_total: order.total,
    currency: "usd",
    expires_at: Math.floor(order.expiresAt / 1000),
    collected_information: null,
    ...overrides,
  } as Stripe.Checkout.Session;
}

function mockClient() {
  return {
    create: vi.fn<StripeSessionClient["create"]>().mockResolvedValue(session()),
    retrieve: vi.fn<StripeSessionClient["retrieve"]>().mockResolvedValue(session()),
    expire: vi
      .fn<StripeSessionClient["expire"]>()
      .mockResolvedValue(session({ status: "expired", url: null })),
    list: vi.fn<StripeSessionClient["list"]>().mockResolvedValue({ data: [], has_more: false }),
  };
}

function signedEvent(overrides: Record<string, unknown> = {}, timestamp?: number) {
  const body = JSON.stringify({
    id: "evt_local_fixture",
    object: "event",
    type: "checkout.session.completed",
    livemode: false,
    data: { object: session({ status: "complete", payment_status: "paid", url: null }) },
    ...overrides,
  });
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload: body,
    secret: webhookSecret,
    timestamp,
  });
  return { body, signature };
}

beforeEach(() => {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_local_fixture_only");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", webhookSecret);
  vi.stubEnv("NEXT_PUBLIC_APP_URL", origin);
  vi.stubEnv("VERCEL", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Stripe test-only configuration", () => {
  it("constructs the configured gateway without making an external request", () => {
    expect(getPaymentGateway().createSession).toBeTypeOf("function");
  });

  it.each([
    "",
    "sk_live_local_fixture",
    "rk_test_local_fixture",
    "sk_test_",
    " sk_test_local_fixture",
  ])("rejects missing or non-test API credentials: %s", (key) => {
    vi.stubEnv("STRIPE_SECRET_KEY", key);
    expect(getPaymentGateway).toThrow(expect.objectContaining({ status: 503 }));
  });

  it.each([
    undefined,
    "http://vela.example.test",
    "javascript:alert(1)",
    "https://user:password@vela.example.test",
    "https://vela.example.test/path",
    "https://vela.example.test?redirect=elsewhere",
    "https://vela.example.test#fragment",
    " https://vela.example.test",
  ])("rejects unsafe checkout origins: %s", (value) => {
    expect(() => validateCheckoutOrigin(value)).toThrow(expect.objectContaining({ status: 503 }));
  });

  it("allows HTTPS origins and local loopback HTTP only outside Vercel", () => {
    expect(validateCheckoutOrigin(`${origin}/`)).toBe(origin);
    for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
      expect(validateCheckoutOrigin(`http://${host}:3000`)).toBe(`http://${host}:3000`);
    }
    vi.stubEnv("VERCEL", "1");
    expect(() => validateCheckoutOrigin("http://127.0.0.1:3000")).toThrow();
    expect(() => validateCheckoutOrigin("https://localhost:3000")).toThrow();
    expect(validateCheckoutOrigin(origin)).toBe(origin);
  });

  it("requires the return origin when creating the gateway", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(getPaymentGateway).toThrow(expect.objectContaining({ status: 503 }));
  });
});

describe("authoritative Checkout requests", () => {
  it("uses snapshot prices, card-only USD, shipping, and stable order idempotency", async () => {
    const client = mockClient();
    const gateway = createPaymentGateway(client, origin);
    await gateway.createSession(order);
    await gateway.createSession({
      ...order,
      updatedAt: order.updatedAt + 60_000,
      checkoutUrl: "already-attached",
    });
    const [params, options] = client.create.mock.calls[0];
    expect(client.create.mock.calls[1]).toEqual(client.create.mock.calls[0]);
    expect(options).toEqual({ idempotencyKey: order.id });
    expect(params).toMatchObject({
      mode: "payment",
      ui_mode: "hosted_page",
      allowed_payment_method_types: ["card"],
      adaptive_pricing: { enabled: false },
      automatic_tax: { enabled: false },
      allow_promotion_codes: false,
      customer_email: order.email,
      client_reference_id: order.id,
      metadata: { orderId: order.id, userId: order.userId },
      expires_at: Math.floor(order.expiresAt / 1000),
      shipping_address_collection: { allowed_countries: ["US"] },
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: 800, currency: "usd" },
          },
        },
      ],
    });
    expect(params.line_items).toEqual([
      {
        quantity: 2,
        price_data: {
          currency: "usd",
          unit_amount: 4800,
          product_data: { name: "Saved serum name", metadata: { productId: "serum" } },
        },
      },
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: 5200,
          product_data: { name: "Saved cream name", metadata: { productId: "cream" } },
        },
      },
    ]);
    expect(params.success_url).toBe(`${origin}/checkout/success?order=${order.id}`);
    expect(params.cancel_url).toBe(`${origin}/checkout?order=${order.id}&cancelled=1`);
  });

  it("encodes return parameters and handles complimentary shipping in the total", () => {
    const params = buildCheckoutParams(
      { ...order, id: "order /?&", shipping: 0, total: order.subtotal },
      origin,
    );
    expect(new URL(params.success_url!).searchParams.get("order")).toBe("order /?&");
    expect(new URL(params.cancel_url!).searchParams.get("cancelled")).toBe("1");
    expect(params.shipping_options?.[0].shipping_rate_data?.fixed_amount?.amount).toBe(0);
  });

  it.each([
    { total: 1 },
    { subtotal: 1 },
    { shipping: -1 },
    { currency: "eur" },
    { testMode: false },
    { lines: [{ ...order.lines[0], quantity: 1.5 }] },
    { lines: [] },
  ])("rejects an inconsistent saved snapshot before calling Stripe: %j", async (change) => {
    const client = mockClient();
    await expect(
      createPaymentGateway(client, origin).createSession({ ...order, ...change } as Order),
    ).rejects.toMatchObject({ code: "ORDER_SNAPSHOT_INVALID" });
    expect(client.create).not.toHaveBeenCalled();
  });

  it.each([
    { livemode: true },
    { amount_total: 1 },
    { currency: "eur" },
    { metadata: { orderId: order.id, userId: "someone-else" } },
    { client_reference_id: "another-order" },
    { expires_at: 1 },
  ])("rejects a create response inconsistent with its order: %j", async (change) => {
    const client = mockClient();
    client.create.mockResolvedValue(session(change));
    await expect(createPaymentGateway(client, origin).createSession(order)).rejects.toMatchObject({
      status: 502,
    });
  });

  it("normalizes retrieve and expire without assigning an order payment state", async () => {
    const client = mockClient();
    const gateway = createPaymentGateway(client, origin);
    expect(await gateway.retrieveSession("cs_test_fixture")).toMatchObject({
      status: "open",
      paymentStatus: "unpaid",
    });
    expect(await gateway.expireSession("cs_test_fixture")).toMatchObject({
      status: "expired",
      paymentStatus: "unpaid",
      url: null,
    });
    expect(client.expire).toHaveBeenCalledWith("cs_test_fixture");
    client.retrieve.mockResolvedValue(session({ id: "cs_test_different" }));
    await expect(gateway.retrieveSession("cs_test_fixture")).rejects.toMatchObject({ status: 502 });
    await expect(gateway.retrieveSession("cs_live_fixture")).rejects.toMatchObject({ status: 502 });
  });

  it("preserves uncertainty on API failure without exposing provider request details", async () => {
    const client = mockClient();
    client.create.mockRejectedValue(new Error("timeout containing sk_test_do_not_expose"));
    await expect(createPaymentGateway(client, origin).createSession(order)).rejects.toMatchObject({
      status: 502,
      code: "STRIPE_PROVIDER_ERROR",
      message: "Stripe checkout could not be verified. Please retry.",
    });
  });
});

describe("Stripe session normalization", () => {
  const shipping = {
    name: "Test Customer",
    address: {
      line1: "123 Example Street",
      line2: null,
      city: "Austin",
      state: "TX",
      postal_code: "78701",
      country: "US",
    },
  };

  it("normalizes amounts, ownership, milliseconds, and the current collected shipping address", () => {
    const normalized = normalizePaymentSession(
      session({
        collected_information: {
          business_name: null,
          individual_name: null,
          shipping_details: shipping,
        },
      }),
    );
    expect(normalized).toMatchObject({
      orderId: order.id,
      userId: order.userId,
      amountTotal: 15600,
      currency: "usd",
      expiresAt: Math.floor(order.expiresAt / 1000) * 1000,
      shippingAddress: {
        id: "stripe-shipping",
        name: "Test Customer",
        line1: "123 Example Street",
        line2: "",
        city: "Austin",
        state: "TX",
        postalCode: "78701",
        country: "US",
      },
    });
  });

  it("supports legacy snapshot shipping details and absent optional values", () => {
    expect(
      normalizePaymentSession({ ...session(), shipping_details: shipping }).shippingAddress?.name,
    ).toBe(shipping.name);
    expect(
      normalizePaymentSession(
        session({
          metadata: null,
          client_reference_id: null,
          amount_total: null,
          currency: null,
          url: null,
        }),
      ),
    ).toMatchObject({
      orderId: null,
      userId: null,
      amountTotal: null,
      currency: null,
      shippingAddress: null,
      url: null,
    });
  });

  it.each([
    { metadata: { userId: order.userId } },
    { client_reference_id: null },
    { status: null },
    { amount_total: 1.5 },
    { expires_at: -1 },
    { url: "javascript:alert(1)" },
    { url: "https://user:secret@checkout.stripe.com" },
    { mode: "subscription" },
    { payment_method_types: ["card", "us_bank_account"] },
    { livemode: true },
  ])("fails closed on malformed or conflicting session data: %j", (change) => {
    expect(() => normalizePaymentSession({ ...session(), ...change })).toThrow(
      expect.objectContaining({ status: 502 }),
    );
  });
});

describe("unattached-session crash recovery", () => {
  it("reads every page, even after a match, with one fixed full creation window", async () => {
    const client = mockClient();
    client.list.mockResolvedValueOnce({ data: [session()], has_more: true }).mockResolvedValueOnce({
      data: [session({ id: "cs_test_unrelated", metadata: null, client_reference_id: null })],
      has_more: false,
    });
    expect(await createPaymentGateway(client, origin).findSession(order)).toMatchObject({
      id: "cs_test_fixture",
    });
    expect(client.list).toHaveBeenCalledTimes(2);
    expect(client.list.mock.calls[0][0]).toEqual({
      created: {
        gte: Math.floor(order.createdAt / 1000) - 60,
        lte: Math.ceil(order.expiresAt / 1000) + 60,
      },
      limit: 100,
    });
    expect(client.list.mock.calls[1][0]).toEqual({
      ...client.list.mock.calls[0][0],
      starting_after: "cs_test_fixture",
    });
  });

  it("returns null only after the final page contains no order match", async () => {
    const client = mockClient();
    client.list
      .mockResolvedValueOnce({
        data: [session({ id: "cs_test_unrelated", metadata: null, client_reference_id: null })],
        has_more: true,
      })
      .mockResolvedValueOnce({ data: [], has_more: false });
    await expect(createPaymentGateway(client, origin).findSession(order)).resolves.toBeNull();
    expect(client.list).toHaveBeenCalledTimes(2);
  });

  it("rejects two matching sessions on separate pages", async () => {
    const client = mockClient();
    client.list
      .mockResolvedValueOnce({ data: [session()], has_more: true })
      .mockResolvedValueOnce({ data: [session({ id: "cs_test_second" })], has_more: false });
    await expect(createPaymentGateway(client, origin).findSession(order)).rejects.toMatchObject({
      code: "CHECKOUT_RECOVERY_AMBIGUOUS",
    });
  });

  it("does not hide a mismatched candidate discovered by its client reference", async () => {
    const client = mockClient();
    client.list.mockResolvedValue({
      data: [session({ metadata: { orderId: "different", userId: order.userId } })],
      has_more: false,
    });
    await expect(createPaymentGateway(client, origin).findSession(order)).rejects.toMatchObject({
      code: "STRIPE_SESSION_MISMATCH",
    });
  });

  it("does not return its candidate when a later API page fails", async () => {
    const client = mockClient();
    client.list
      .mockResolvedValueOnce({ data: [session()], has_more: true })
      .mockRejectedValueOnce(new Error("API timeout"));
    await expect(createPaymentGateway(client, origin).findSession(order)).rejects.toMatchObject({
      code: "STRIPE_PROVIDER_ERROR",
    });
  });

  it("fails closed at the scan bound", async () => {
    const client = mockClient();
    let index = 0;
    client.list.mockImplementation(async () => ({
      data: [
        session({ id: `cs_test_unrelated_${index++}`, metadata: null, client_reference_id: null }),
      ],
      has_more: true,
    }));
    await expect(createPaymentGateway(client, origin).findSession(order)).rejects.toMatchObject({
      code: "CHECKOUT_RECOVERY_INCOMPLETE",
    });
    expect(client.list).toHaveBeenCalledTimes(100);
  });

  it("rejects empty continuation pages, repeated cursors, and live results", async () => {
    for (const page of [
      { data: [], has_more: true },
      { data: [session()], has_more: true },
      { data: [session({ livemode: true })], has_more: false },
    ]) {
      const client = mockClient();
      client.list.mockResolvedValue(page);
      await expect(createPaymentGateway(client, origin).findSession(order)).rejects.toMatchObject({
        status: 502,
      });
    }
  });

  it.each(["open", "complete", "expired"] as const)(
    "retains a recovered %s session for authoritative service decisions",
    async (status) => {
      const client = mockClient();
      client.list.mockResolvedValue({ data: [session({ status })], has_more: false });
      expect((await createPaymentGateway(client, origin).findSession(order))?.status).toBe(status);
    },
  );
});

describe("signed Stripe snapshot events", () => {
  it.each([
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
    "checkout.session.expired",
  ])("verifies SDK-generated signatures for %s", (type) => {
    const event = signedEvent({ type });
    expect(verifyStripeEvent(event.body, event.signature)).toMatchObject({
      id: "evt_local_fixture",
      type,
      livemode: false,
      session: { id: "cs_test_fixture", paymentStatus: "paid", orderId: order.id },
    });
  });

  it("verifies unknown events but does not treat their objects as checkout sessions", () => {
    const event = signedEvent({
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_test_fixture" } },
    });
    expect(verifyStripeEvent(event.body, event.signature).session).toBeNull();
  });

  it("ignores unrelated signed Checkout events in a shared Stripe account", () => {
    for (const object of [
      session({
        mode: "subscription",
        metadata: null,
        client_reference_id: "another-app-customer",
      }),
      session({ metadata: { orderId: "another-app-order" }, client_reference_id: null }),
      { id: "cs_test_unrelated" },
    ]) {
      const event = signedEvent({ data: { object } });
      expect(verifyStripeEvent(event.body, event.signature).session).toBeNull();
    }
  });

  it("rejects missing, invalid, old, and tampered signatures before trusting event data", () => {
    const event = signedEvent();
    const old = signedEvent({}, Math.floor(Date.now() / 1000) - 600);
    for (const [body, signature] of [
      [event.body, null],
      [event.body, "invalid"],
      [event.body.replace('"livemode":false', '"livemode":true'), event.signature],
      [old.body, old.signature],
    ] as const) {
      expect(() => verifyStripeEvent(body, signature)).toThrow(
        expect.objectContaining({ status: 400, code: "STRIPE_SIGNATURE_INVALID" }),
      );
    }
  });

  it("rejects signed live events and live sessions inside test events", () => {
    const liveEvent = signedEvent({ livemode: true });
    expect(() => verifyStripeEvent(liveEvent.body, liveEvent.signature)).toThrow(
      expect.objectContaining({ status: 400, code: "STRIPE_LIVE_EVENT" }),
    );
    const liveSession = signedEvent({ data: { object: session({ livemode: true }) } });
    expect(() => verifyStripeEvent(liveSession.body, liveSession.signature)).toThrow(
      expect.objectContaining({ status: 400, code: "STRIPE_EVENT_INVALID" }),
    );
  });

  it("rejects signed malformed sessions and conflicting ownership metadata", () => {
    for (const object of [
      { id: "cs_test_incomplete", metadata: { orderId: order.id } },
      session({ client_reference_id: "wrong-order" }),
      session({ mode: "subscription" }),
    ]) {
      const event = signedEvent({ data: { object } });
      expect(() => verifyStripeEvent(event.body, event.signature)).toThrow(
        expect.objectContaining({ status: 400, code: "STRIPE_EVENT_INVALID" }),
      );
    }
  });

  it("rejects signed JSON without an event envelope", () => {
    const body = "null";
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload: body,
      secret: webhookSecret,
    });
    expect(() => verifyStripeEvent(body, signature)).toThrow(
      expect.objectContaining({ status: 400, code: "STRIPE_EVENT_INVALID" }),
    );
  });

  it("returns 503 when test or webhook credentials are not configured", () => {
    const event = signedEvent();
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    expect(() => verifyStripeEvent(event.body, event.signature)).toThrow(
      expect.objectContaining({ status: 503 }),
    );
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", webhookSecret);
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_local_fixture");
    expect(() => verifyStripeEvent(event.body, event.signature)).toThrow(
      expect.objectContaining({ status: 503 }),
    );
  });
});
