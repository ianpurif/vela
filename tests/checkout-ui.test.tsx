// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { demoProducts } from "@/features/catalog/fixtures";
import { useCart } from "@/stores/cart";
import {
  cartFingerprint,
  getCheckoutAttempt,
  reconcilePaidBag,
  rememberCheckoutOrder,
  stripeCheckoutUrl,
  subtractOrderedQuantities,
} from "@/components/checkout/checkout-state";
import { CheckoutReview } from "@/components/checkout/checkout-review";
import { OrderConfirmation } from "@/components/checkout/order-confirmation";
import type { Order } from "@/types/commerce";

const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
const items = [{ productId: "first-light-serum", quantity: 1 }];
const baseOrder: Order = {
  id: "order-verified",
  userId: "customer-1",
  email: "customer@example.test",
  lines: [
    {
      productId: "first-light-serum",
      name: "First Light Serum",
      image: "/images/first-light-serum.webp",
      quantity: 1,
      unitPrice: 4800,
    },
  ],
  subtotal: 4800,
  shipping: 600,
  total: 5400,
  currency: "usd",
  paymentStatus: "pending",
  paidAt: null,
  fulfillmentStatus: "unfulfilled",
  testMode: true,
  sessionId: null,
  checkoutUrl: null,
  requestKey: "11111111-1111-4111-8111-111111111111",
  expiresAt: Date.now() + 2100000,
  shippingAddress: null,
  trackingNumber: "",
  createdAt: Date.now(),
  updatedAt: Date.now(),
};
const originalLocks = Object.getOwnPropertyDescriptor(navigator, "locks");

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  useCart.setState({ items: [], open: false });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  if (originalLocks) Object.defineProperty(navigator, "locks", originalLocks);
  else Reflect.deleteProperty(navigator, "locks");
});

describe("checkout retry safety", () => {
  it("reuses a key for the exact basket including after paid status, until an explicit new attempt", () => {
    const first = getCheckoutAttempt("customer-1", items);
    expect(getCheckoutAttempt("customer-1", items).requestKey).toBe(first.requestKey);
    rememberCheckoutOrder({ ...baseOrder, requestKey: first.requestKey, paymentStatus: "paid" });
    expect(getCheckoutAttempt("customer-1", items).requestKey).toBe(first.requestKey);
    expect(getCheckoutAttempt("customer-1", items, true).requestKey).not.toBe(first.requestKey);
    expect(cartFingerprint([...items, { productId: "cream", quantity: 2 }])).toBe(
      cartFingerprint([{ productId: "cream", quantity: 2 }, ...items]),
    );
  });
  it("creates a new key after the server reports a terminal failed attempt", () => {
    const first = getCheckoutAttempt("customer-1", items);
    rememberCheckoutOrder({ ...baseOrder, requestKey: first.requestKey, paymentStatus: "failed" });
    expect(getCheckoutAttempt("customer-1", items).requestKey).not.toBe(first.requestKey);
  });
  it("allows only HTTPS checkout.stripe.com redirects", () => {
    expect(stripeCheckoutUrl("https://checkout.stripe.com/c/pay/cs_test_example")).toContain(
      "checkout.stripe.com",
    );
    for (const url of [
      "javascript:alert(1)",
      "https://checkout.stripe.com.evil.example/pay",
      "https://evil.example",
      "http://checkout.stripe.com/pay",
      "https://user:pass@checkout.stripe.com/pay",
      null,
    ])
      expect(stripeCheckoutUrl(url)).toBeNull();
  });
});

describe("verified payment cart reconciliation", () => {
  it("preserves additional quantities and unrelated products", () => {
    expect(
      subtractOrderedQuantities(
        [
          { productId: "first-light-serum", quantity: 4 },
          { productId: "cream", quantity: 2 },
        ],
        items,
      ),
    ).toEqual([
      { productId: "first-light-serum", quantity: 3 },
      { productId: "cream", quantity: 2 },
    ]);
  });
  it("never cleans a pending order or a paid order without the checkout snapshot", async () => {
    useCart.setState({ items });
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: { request: async (_key: string, work: () => unknown) => work() },
    });
    expect(await reconcilePaidBag(baseOrder)).toBe("preserved");
    rememberCheckoutOrder({ ...baseOrder, paymentStatus: "paid" });
    expect(await reconcilePaidBag({ ...baseOrder, paymentStatus: "paid" })).toBe("preserved");
    expect(useCart.getState().items).toEqual(items);
  });
  it("applies purchased quantities once across concurrent confirmation calls", async () => {
    let tail = Promise.resolve();
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: {
        request: (_key: string, work: () => Promise<string>) => {
          const result = tail.then(work);
          tail = result.then(() => undefined);
          return result;
        },
      },
    });
    const attempt = getCheckoutAttempt("customer-1", items);
    const paid = { ...baseOrder, requestKey: attempt.requestKey, paymentStatus: "paid" as const };
    useCart.setState({
      items: [
        { productId: "first-light-serum", quantity: 3 },
        { productId: "cream", quantity: 1 },
      ],
    });
    const results = await Promise.all([reconcilePaidBag(paid), reconcilePaidBag(paid)]);
    expect(results).toContain("updated");
    expect(results).toContain("already-updated");
    expect(useCart.getState().items).toEqual([
      { productId: "first-light-serum", quantity: 2 },
      { productId: "cream", quantity: 1 },
    ]);
    expect(sessionStorage.getItem("vela-order-cleared-v1:customer-1:order-verified")).toBe("done");
  });
});

describe("checkout interface", () => {
  it("sends only IDs, quantities and a stable key on ambiguous 503 retries", async () => {
    useCart.setState({ items });
    const fetchMock = vi
      .fn()
      .mockImplementation(
        async () =>
          new Response(
            JSON.stringify({
              error: "Stripe test payments are not configured.",
              code: "CONFIGURATION_REQUIRED",
            }),
            { status: 503, headers: { "Content-Type": "application/json" } },
          ),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <CheckoutReview
        products={demoProducts}
        uid="customer-1"
        email="customer@example.test"
        emailVerified
      />,
    );
    const button = await screen.findByRole("button", { name: "Continue to test checkout" });
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("not configured"));
    fireEvent.click(screen.getByRole("button", { name: "Continue to test checkout" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const firstBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(Object.keys(firstBody).sort()).toEqual(["items", "requestKey"]);
    expect(firstBody.items).toEqual(items);
    expect(secondBody.requestKey).toBe(firstBody.requestKey);
    expect(navigation.push).not.toHaveBeenCalled();
  });
  it("requires email verification before starting checkout", async () => {
    useCart.setState({ items });
    render(
      <CheckoutReview
        products={demoProducts}
        uid="customer-1"
        email="customer@example.test"
        emailVerified={false}
      />,
    );
    expect(await screen.findByRole("button", { name: "Continue to test checkout" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Verify your email" })).toHaveAttribute(
      "href",
      "/account",
    );
  });
  it("shows pending status on the success route without treating the redirect as payment", () => {
    useCart.setState({ items });
    render(<OrderConfirmation initialOrder={baseOrder} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("One last moment.");
    expect(screen.getByText("Awaiting payment confirmation")).toBeVisible();
    expect(screen.queryByText("Verified test payment")).not.toBeInTheDocument();
    expect(useCart.getState().items).toEqual(items);
  });
});
