import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { initializeApp, getApps, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { Order } from "../../src/types/commerce";

test.describe("local checkout and stored confirmation", () => {
  test.skip(process.env.VELA_E2E_EMULATOR !== "1", "Requires isolated local Firebase.");
  test("retains retry identity, bag contents and honest payment status", async ({
    page,
  }, testInfo) => {
    test.setTimeout(90000);
    const headers = { Origin: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000" };
    const request = page.request;
    expect(
      (
        await request.post("/api/checkout", {
          headers,
          data: { items: [], requestKey: randomUUID() },
        })
      ).status(),
    ).toBe(401);
    await page.goto("/checkout");
    await expect(page).toHaveURL(/\/sign-in\?returnTo=/);
    const login = await request.post(
      "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-vela-emulator-key",
      {
        data: {
          email: "customer@example.test",
          password: "Vela-local-2026!",
          returnSecureToken: true,
        },
      },
    );
    const { idToken } = await login.json();
    expect((await request.post("/api/auth/session", { headers, data: { idToken } })).status()).toBe(
      200,
    );
    await page.goto("/products/first-light-serum");
    await page.getByRole("button", { name: "Add to bag: First Light Serum", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.goto("/checkout");
    await expect(page.getByRole("heading", { name: "Your checkout." })).toBeVisible();
    await expect(page.getByText("$54", { exact: true })).toBeVisible();
    const keys: string[] = [];
    page.on("request", (call) => {
      if (call.url().endsWith("/api/checkout") && call.method() === "POST")
        keys.push(call.postDataJSON().requestKey);
    });
    const response = page.waitForResponse(
      (call) => call.url().endsWith("/api/checkout") && call.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Continue to test checkout", exact: true }).click();
    const first = await response;
    test.skip(
      first.status() !== 503,
      "Stripe is configured; exercise external test checkout separately.",
    );
    await expect(
      page.getByRole("alert").filter({ hasText: "Test checkout is not connected yet" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Continue to test checkout", exact: true }).click();
    await expect.poll(() => keys.length).toBe(2);
    expect(keys[0]).toBe(keys[1]);
    expect(
      (
        await request.post("/api/checkout", {
          headers: { Origin: "https://foreign.example" },
          data: {},
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await request.post("/api/checkout", {
          headers,
          data: {
            items: [{ productId: "first-light-serum", quantity: 1, unitPrice: 1 }],
            requestKey: randomUUID(),
          },
        })
      ).status(),
    ).toBe(400);

    // Explicit local fixtures check rendering/isolation only; no payment is simulated as an external success.
    process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
    const appName = `checkout-browser-${testInfo.project.name}`;
    const app =
      getApps().find((value) => value.name === appName) ||
      initializeApp({ projectId: "demo-vela" }, appName);
    const db = getFirestore(app);
    const id = `local_checkout_${randomUUID().replaceAll("-", "")}`;
    const order: Order = {
      id,
      userId: "vela-customer",
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
      requestKey: randomUUID(),
      expiresAt: Date.now() + 2100000,
      shippingAddress: null,
      trackingNumber: "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    try {
      await db.doc(`orders/${id}`).set(order);
      await page.goto(`/checkout/success?order=${id}`);
      await expect(page.getByRole("heading", { name: "One last moment." })).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Check payment status", exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("heading", { name: "Your ritual, confirmed." })).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `.local/checkout-${testInfo.project.name}.png`,
        fullPage: true,
      });
      await db.doc(`orders/${id}`).update({ userId: "someone-else" });
      expect((await request.get(`/api/orders/${id}`)).status()).toBe(404);
      await page.goto(`/checkout/success?order=${id}`);
      await expect(page.getByRole("heading", { name: "Let’s find your way back." })).toBeVisible();
      await page.goto("/cart");
      await expect(page.getByText("First Light Serum", { exact: true }).first()).toBeVisible();
    } finally {
      await db.doc(`orders/${id}`).delete();
      await db.terminate();
      await deleteApp(app);
    }
  });
});
