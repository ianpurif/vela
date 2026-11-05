import { test, expect } from "@playwright/test";
import path from "node:path";
import type { Product } from "../../src/types/commerce";

test.describe("administrator media boundaries", () => {
  test.skip(process.env.VELA_E2E_EMULATOR !== "1", "Requires isolated local Firebase.");
  test("protects uploads, reorders galleries, and fails honestly without Cloudinary keys", async ({
    page,
  }, testInfo) => {
    const request = page.request;
    test.skip(testInfo.project.name !== "desktop", "Media security is independent of viewport.");
    const headers = { Origin: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000" };
    const data = { productId: "first-light-serum" };
    expect((await request.post("/api/admin/media/sign", { headers, data })).status()).toBe(401);
    async function login(email: string) {
      const result = await request.post(
        "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-vela-emulator-key",
        { data: { email, password: "Vela-local-2026!", returnSecureToken: true } },
      );
      const { idToken } = await result.json();
      expect(
        (await request.post("/api/auth/session", { headers, data: { idToken } })).status(),
      ).toBe(200);
    }
    await login("customer@example.test");
    expect((await request.post("/api/admin/media/sign", { headers, data })).status()).toBe(403);
    await login("admin@example.test");
    expect(
      (
        await request.post("/api/admin/media/sign", {
          headers: { Origin: "https://untrusted.example" },
          data,
        })
      ).status(),
    ).toBe(403);
    const probe = await request.post("/api/admin/media/sign", { headers, data });
    test.skip(
      probe.status() !== 503,
      "External Cloudinary is configured; run the real upload verification separately.",
    );
    const original: Product = (
      await (await request.get("/api/admin/products")).json()
    ).products.find((p: Product) => p.id === data.productId);
    try {
      await page.goto(`/admin/products/${data.productId}`);
      await expect(page.getByLabel("Short description", { exact: true })).toHaveValue(
        original.subtitle,
      );
      await page
        .getByLabel("Short description", { exact: true })
        .fill("Unsaved description is preserved");
      await expect(page.getByLabel("Short description", { exact: true })).toHaveValue(
        "Unsaved description is preserved",
      );
      await page.getByRole("button", { name: "Make image 2 the cover", exact: true }).click();
      await expect(page.getByRole("status")).toContainText("Gallery order saved");
      await expect(page.getByLabel("Short description", { exact: true })).toHaveValue(
        "Unsaved description is preserved",
      );
      const reordered: Product = (
        await (await request.get("/api/admin/products")).json()
      ).products.find((p: Product) => p.id === data.productId);
      expect(reordered.images[0].src).toBe(original.images[1].src);
      await page
        .getByLabel("Choose product images", { exact: true })
        .setInputFiles(path.resolve("public/images/first-light-serum.webp"));
      await page.getByRole("button", { name: "Upload 1 image", exact: true }).click();
      await expect(page.getByRole("alert").filter({ hasText: /not connected/i })).toBeVisible();
      const after: Product = (
        await (await request.get("/api/admin/products")).json()
      ).products.find((p: Product) => p.id === data.productId);
      expect(after.images).toHaveLength(original.images.length);
    } finally {
      await request.patch("/api/admin/media/gallery", {
        headers,
        data: {
          productId: data.productId,
          action: "reorder",
          sources: original.images.map((image) => image.src),
        },
      });
    }
  });
});
