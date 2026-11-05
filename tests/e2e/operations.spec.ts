import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { contentInputSchema, type HomeContentInput } from "../../src/lib/validation/operations";
import type { Order, SiteContent, UserProfile } from "../../src/types/commerce";
import type { AdminAnalytics } from "../../src/types/operations";

async function noPageOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBeTruthy();
}

test.describe("emulator operations and customer order history", () => {
  test.skip(process.env.VELA_E2E_EMULATOR !== "1", "Requires explicitly enabled local emulators.");

  test("fulfills verified test orders, isolates customers, and persists homepage content", async ({
    page,
  }, testInfo) => {
    test.setTimeout(90000);
    const browserErrors: string[] = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    const base = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
    if (
      process.env.VERCEL ||
      !["127.0.0.1", "localhost", "[::1]"].includes(new URL(base).hostname) ||
      (process.env.FIRESTORE_EMULATOR_HOST &&
        process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080")
    ) {
      throw new Error("Operations fixtures are restricted to demo-vela on loopback emulators.");
    }
    const previousHost = process.env.FIRESTORE_EMULATOR_HOST;
    process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
    const nonce = randomUUID().replaceAll("-", "").slice(0, 12);
    const prefix = `local_ops_${testInfo.project.name}_${nonce}`;
    const app = initializeApp({ projectId: "demo-vela" }, prefix);
    const db = getFirestore(app);
    const request = page.request;
    const headers = { Origin: new URL(base).origin };
    const startedAt = Date.now();
    let originalContent: HomeContentInput | undefined;
    let originalHomeAuditIds = new Set<string>();

    async function login(email: string) {
      const response = await request.post(
        "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-vela-emulator-key",
        { data: { email, password: "Vela-local-2026!", returnSecureToken: true } },
      );
      expect(response.status()).toBe(200);
      const { idToken } = await response.json();
      expect(
        (await request.post("/api/auth/session", { headers, data: { idToken } })).status(),
      ).toBe(200);
    }

    const foreignProfile: UserProfile = {
      id: `${prefix}_customer`,
      name: `Localops${nonce} Customer`,
      email: `${prefix}@example.test`,
      searchName: `localops${nonce} customer`,
      searchEmail: `${prefix}@example.test`,
      addresses: [],
      createdAt: startedAt - 1000,
      updatedAt: startedAt - 1000,
    };
    function orderFixture(id: string, userId: string, paid: boolean, quantity = 1): Order {
      const subtotal = 4800 * quantity;
      const shipping = subtotal >= 7500 ? 0 : 600;
      return {
        id,
        userId,
        email: userId === "vela-customer" ? "customer@example.test" : foreignProfile.email,
        lines: [
          {
            productId: "first-light-serum",
            name: "Local operations fixture — First Light Serum",
            image: "/images/first-light-serum.webp",
            quantity,
            unitPrice: 4800,
          },
        ],
        subtotal,
        shipping,
        total: subtotal + shipping,
        currency: "usd",
        // Explicit local test fixtures exercise operations, not the payment gateway.
        paymentStatus: paid ? "paid" : "pending",
        paidAt: paid ? startedAt - 500 : null,
        fulfillmentStatus: "unfulfilled",
        testMode: true,
        sessionId: null,
        checkoutUrl: null,
        requestKey: randomUUID(),
        expiresAt: startedAt + 35 * 60 * 1000,
        shippingAddress: {
          id: "local-fixture-address",
          name: "Local test recipient",
          line1: "100 Test Lane",
          line2: "",
          city: "Example",
          state: "CA",
          postalCode: "90001",
          country: "US",
        },
        trackingNumber: "",
        createdAt: startedAt - 1000,
        updatedAt: startedAt - 1000,
      };
    }
    const ownedPaid = orderFixture(`${prefix}_paid`, "vela-customer", true);
    const foreignPaid = orderFixture(`${prefix}_foreign`, foreignProfile.id, true, 2);
    const ownedPending = orderFixture(`${prefix}_pending`, "vela-customer", false);
    const fixtures = [ownedPaid, foreignPaid, ownedPending];

    try {
      await login("customer@example.test");
      expect((await request.get("/api/admin/analytics?days=30")).status()).toBe(403);
      expect(
        (
          await request.patch("/api/admin/orders", {
            headers,
            data: { id: ownedPaid.id, fulfillmentStatus: "processing", trackingNumber: "" },
          })
        ).status(),
      ).toBe(403);

      await login("admin@example.test");
      const baselineResponse = await request.get("/api/admin/analytics?days=30");
      expect(baselineResponse.status()).toBe(200);
      const baseline: AdminAnalytics = await baselineResponse.json();
      expect(baseline.scope.truncated).toBe(false);
      const contentResponse = await request.get("/api/admin/content");
      expect(contentResponse.status()).toBe(200);
      const content: SiteContent = (await contentResponse.json()).content;
      originalContent = contentInputSchema.parse(
        Object.fromEntries(
          Object.keys(contentInputSchema.shape).map((key) => [
            key,
            content[key as keyof SiteContent],
          ]),
        ),
      );
      originalHomeAuditIds = new Set(
        (await db.collection("auditLogs").where("entityId", "==", "home").get()).docs.map(
          (doc) => doc.id,
        ),
      );
      const seed = db.batch();
      seed.set(db.collection("users").doc(foreignProfile.id), foreignProfile);
      for (const order of fixtures) seed.set(db.collection("orders").doc(order.id), order);
      await seed.commit();

      const analyticsResponse = await request.get("/api/admin/analytics?days=30");
      expect(analyticsResponse.status()).toBe(200);
      const analytics: AdminAnalytics = await analyticsResponse.json();
      expect(analytics.scope.truncated).toBe(false);
      expect(analytics.metrics.revenue - baseline.metrics.revenue).toBe(
        ownedPaid.total + foreignPaid.total,
      );
      expect(analytics.metrics.paidOrders - baseline.metrics.paidOrders).toBe(2);
      expect(analytics.metrics.orders - baseline.metrics.orders).toBe(3);
      expect(analytics.metrics.pendingOrders - baseline.metrics.pendingOrders).toBe(1);
      expect(
        (
          await request.patch("/api/admin/orders", {
            headers,
            data: {
              id: ownedPaid.id,
              fulfillmentStatus: "processing",
              trackingNumber: "",
              paymentStatus: "paid",
            },
          })
        ).status(),
      ).toBe(400);
      expect(
        (
          await request.patch("/api/admin/orders", {
            headers,
            data: { id: ownedPending.id, fulfillmentStatus: "processing", trackingNumber: "" },
          })
        ).status(),
      ).toBe(409);

      await page.goto("/admin/orders");
      await page.getByLabel("Payment status", { exact: true }).selectOption("paid");
      await page.getByRole("button", { name: "Apply filters", exact: true }).click();
      await expect(page).toHaveURL(/paymentStatus=paid/);
      await page.getByLabel("Search these orders", { exact: true }).fill(ownedPaid.id);
      await expect(
        page.getByRole("link", { name: `View order ${ownedPending.id}`, exact: true }),
      ).toHaveCount(0);
      await noPageOverflow(page);
      await page.getByRole("link", { name: `View order ${ownedPaid.id}`, exact: true }).click();
      await expect(page.getByRole("heading", { level: 1 })).toContainText("Order");

      const tracking = `LOCAL-TEST-${nonce.toUpperCase()}`;
      async function saveFulfillment(status: "processing" | "shipped") {
        await page.getByLabel("Fulfillment status", { exact: true }).selectOption(status);
        await page
          .getByLabel("Tracking number", { exact: true })
          .fill(status === "shipped" ? tracking : "");
        const [response] = await Promise.all([
          page.waitForResponse(
            (result) =>
              new URL(result.url()).pathname === "/api/admin/orders" &&
              result.request().method() === "PATCH",
          ),
          page.getByRole("button", { name: "Save fulfillment", exact: true }).click(),
        ]);
        expect(response.status()).toBe(200);
        expect((await response.json()).order.fulfillmentStatus).toBe(status);
        await page.reload();
        await expect(page.getByLabel("Fulfillment status", { exact: true })).toHaveValue(status);
      }
      await saveFulfillment("processing");
      await saveFulfillment("shipped");
      await expect(page.getByLabel("Tracking number", { exact: true })).toHaveValue(tracking);
      await noPageOverflow(page);
      const stored = (await db.collection("orders").doc(ownedPaid.id).get()).data();
      expect(stored).toMatchObject({
        paymentStatus: "paid",
        fulfillmentStatus: "shipped",
        trackingNumber: tracking,
      });

      await page.goto("/admin/customers");
      await page
        .getByLabel("Find a customer", { exact: true })
        .fill(`LOCALOPS${nonce.toUpperCase()}`);
      await page.getByRole("button", { name: "Search customers", exact: true }).click();
      await expect(
        page.getByRole("link", { name: `View profile for ${foreignProfile.name}`, exact: true }),
      ).toBeVisible();
      await page
        .getByRole("link", { name: `View profile for ${foreignProfile.name}`, exact: true })
        .click();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(foreignProfile.name);
      await expect(
        page.getByRole("link", { name: `View order ${foreignPaid.id}`, exact: true }),
      ).toBeVisible();

      await page.goto("/admin/analytics");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Analytics");
      await expect(page.getByText("Verified revenue", { exact: true })).toBeVisible();
      await noPageOverflow(page);
      await page.screenshot({
        path: `.local/operations-${testInfo.project.name}.png`,
        fullPage: true,
      });

      await page.goto("/admin/content");
      const heroTitle = `A local ritual ${nonce}.`;
      const promotionTitle = `A local rhythm ${nonce}.`;
      await expect(page.getByLabel("Hero title", { exact: true })).toHaveValue(
        originalContent.heroTitle,
      );
      await page.getByLabel("Hero title", { exact: true }).fill(heroTitle);
      await page.getByLabel("Promotion title", { exact: true }).fill(promotionTitle);
      const [savedContent] = await Promise.all([
        page.waitForResponse(
          (result) =>
            new URL(result.url()).pathname === "/api/admin/content" &&
            result.request().method() === "PATCH",
        ),
        page.getByRole("button", { name: "Save content", exact: true }).click(),
      ]);
      expect(savedContent.status()).toBe(200);
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toContainText(heroTitle);
      await expect(page.getByRole("heading", { name: promotionTitle, exact: true })).toBeVisible();

      await login("customer@example.test");
      expect((await request.get(`/api/orders/${foreignPaid.id}`)).status()).toBe(404);
      await page.goto("/account/orders");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your orders.");
      const ownedLink = page.getByRole("link", {
        name: `View order ${ownedPaid.id.slice(-8).toUpperCase()}`,
        exact: true,
      });
      await expect(ownedLink).toBeVisible();
      await expect(page.locator(`a[href="/account/orders/${foreignPaid.id}"]`)).toHaveCount(0);
      await expect(
        page.getByText(`shipped · Tracking: ${tracking}`, { exact: true }),
      ).toBeVisible();
      await noPageOverflow(page);
      await ownedLink.click();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your ritual, confirmed.");
      await expect(page.getByText(tracking, { exact: true })).toBeVisible();
      await expect(page.locator('[aria-current="step"]')).toContainText("Shipped");
      const foreignPage = await page.goto(`/account/orders/${foreignPaid.id}`);
      expect(foreignPage?.status()).toBe(404);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Let’s find your way back.");
      expect(browserErrors).toEqual([]);
      await testInfo.attach("operations-fixture-verification", {
        body: JSON.stringify({
          project: testInfo.project.name,
          fixtureIds: fixtures.map((order) => order.id),
          revenueDelta: analytics.metrics.revenue - baseline.metrics.revenue,
          fulfillment: "shipped",
          note: "Explicit local emulator fixtures; no external payments occurred.",
        }),
        contentType: "application/json",
      });
    } finally {
      testInfo.setTimeout(testInfo.timeout + 20000);
      try {
        if (originalContent) {
          try {
            await login("admin@example.test");
            expect(
              (
                await request.patch("/api/admin/content", { headers, data: originalContent })
              ).status(),
            ).toBe(200);
          } catch (error) {
            // A failed session/API assertion must not leave temporary homepage copy.
            // This fallback is confined to the explicitly guarded local emulator.
            const { promotionTitle, promotionText, ...fields } = originalContent;
            const restore = db.batch();
            restore.set(db.collection("settings").doc("home"), {
              ...fields,
              id: "home",
              updatedAt: Date.now(),
            });
            restore.set(db.collection("promotions").doc("home"), {
              id: "home",
              title: promotionTitle,
              text: promotionText,
              updatedAt: Date.now(),
            });
            await restore.commit();
            throw error;
          }
        }
      } finally {
        try {
          const cleanup = db.batch();
          for (const order of fixtures) cleanup.delete(db.collection("orders").doc(order.id));
          cleanup.delete(db.collection("users").doc(foreignProfile.id));
          const orderAudits = await db
            .collection("auditLogs")
            .where(
              "entityId",
              "in",
              fixtures.map((order) => order.id),
            )
            .get();
          for (const doc of orderAudits.docs) cleanup.delete(doc.ref);
          if (originalContent) {
            const homeAudits = await db
              .collection("auditLogs")
              .where("entityId", "==", "home")
              .get();
            for (const doc of homeAudits.docs) {
              const log = doc.data();
              if (
                !originalHomeAuditIds.has(doc.id) &&
                log.actorId === "vela-admin" &&
                log.action === "content.home.updated" &&
                log.createdAt >= startedAt
              )
                cleanup.delete(doc.ref);
            }
          }
          await cleanup.commit();
        } finally {
          try {
            await db.terminate();
          } finally {
            try {
              await deleteApp(app);
            } finally {
              if (previousHost === undefined) delete process.env.FIRESTORE_EMULATOR_HOST;
              else process.env.FIRESTORE_EMULATOR_HOST = previousHost;
            }
          }
        }
      }
    }
  });
});
