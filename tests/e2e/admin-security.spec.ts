import { test, expect } from "@playwright/test";
import { demoProducts } from "../../src/features/catalog/fixtures";
import { productInputSchema } from "../../src/lib/validation/commerce";
import type { Product } from "../../src/types/commerce";

test.describe("admin authorization and persistent commerce", () => {
  test.skip(process.env.VELA_E2E_EMULATOR !== "1", "Requires isolated emulator mode.");
  test("blocks customers and persists validated administrator changes", async ({
    request,
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "Server permissions do not depend on viewport.");
    const base = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
    const headers = { Origin: base };
    expect((await request.get("/api/admin/products")).status()).toBe(401);
    async function login(email: string) {
      const response = await request.post(
        "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-vela-emulator-key",
        { data: { email, password: "Vela-local-2026!", returnSecureToken: true } },
      );
      expect(response.ok()).toBeTruthy();
      const { idToken } = await response.json();
      expect(
        (await request.post("/api/auth/session", { headers, data: { idToken } })).status(),
      ).toBe(200);
    }
    await login("customer@example.test");
    expect((await request.get("/api/admin/products")).status()).toBe(403);
    expect(
      (
        await request.patch("/api/admin/inventory", {
          headers,
          data: { productId: "stillwater-cleanser", delta: 100, reason: "Unauthorized" },
        })
      ).status(),
    ).toBe(403);
    await login("admin@example.test");
    expect((await request.get("/api/admin/products")).status()).toBe(200);
    const slug = `qa-catalog-${Date.now()}`;
    const product = {
      ...Object.fromEntries(
        Object.keys(productInputSchema.shape).map((key) => [
          key,
          demoProducts[0][key as keyof Product],
        ]),
      ),
      slug,
      name: "QA catalog product",
      featured: false,
      status: "draft",
    };
    try {
      expect((await request.post("/api/admin/products", { headers, data: product })).status()).toBe(
        201,
      );
      expect(
        (
          await request.patch("/api/admin/inventory", {
            headers,
            data: { productId: slug, delta: -1, reason: "Invalid adjustment" },
          })
        ).status(),
      ).toBe(409);
      expect(
        (
          await request.patch("/api/admin/inventory", {
            headers,
            data: { productId: slug, delta: 6, reason: "Emulator test stock" },
          })
        ).status(),
      ).toBe(200);
      expect(
        (
          await request.patch("/api/admin/products", {
            headers,
            data: { id: slug, product: { ...product, status: "published" } },
          })
        ).status(),
      ).toBe(200);
      await page.goto(`/products/${slug}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("QA catalog product");
      expect(
        (
          await request.patch("/api/admin/products", {
            headers,
            data: { id: slug, product: { ...product, status: "archived" } },
          })
        ).status(),
      ).toBe(200);
      expect((await page.goto(`/products/${slug}`))?.status()).toBe(404);
    } finally {
      // Emulator-only fixture cleanup. No production project is addressed by this test.
      await request.delete(
        `http://127.0.0.1:8080/v1/projects/demo-vela/databases/(default)/documents/products/${slug}`,
        { headers: { Authorization: "Bearer owner" } },
      );
    }
  });
});
