import { test, expect } from "@playwright/test";
import { productInputSchema } from "../../src/lib/validation/commerce";
import type { Product } from "../../src/types/commerce";

test.describe("administrator interface", () => {
  test.skip(process.env.VELA_E2E_EMULATOR !== "1", "Requires explicit emulator mode.");
  test("edits a product and adjusts inventory through the dashboard", async ({
    page,
  }, testInfo) => {
    test.setTimeout(90000);
    await page.goto("/sign-in?returnTo=%2Fadmin");
    await page.getByLabel("Email address", { exact: true }).fill("admin@example.test");
    await page.getByLabel("Password", { exact: true }).fill("Vela-local-2026!");
    await page.getByRole("button", { name: "Welcome back", exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    ).toBeTruthy();
    await page.screenshot({ path: `.local/admin-${testInfo.project.name}.png`, fullPage: true });
    const result = await page.request.get("/api/admin/products");
    const product: Product = (await result.json()).products.find(
      (p: Product) => p.id === "first-light-serum",
    );
    const input = Object.fromEntries(
      Object.keys(productInputSchema.shape).map((key) => [key, product[key as keyof Product]]),
    );
    const headers = { Origin: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000" };
    try {
      await page.goto("/admin/products");
      await page.getByRole("link", { name: "Edit First Light Serum", exact: true }).click();
      const description = `A morning ritual ${Date.now()}`;
      await page.getByLabel("Short description", { exact: true }).fill(description);
      await page.getByRole("button", { name: "Save product", exact: true }).click();
      await expect(page.getByRole("status")).toContainText(/saved|updated/i);
      await page.reload();
      await expect(page.getByLabel("Short description", { exact: true })).toHaveValue(description);
      await page.goto("/admin/inventory");
      await page
        .getByRole("button", { name: "Adjust stock for First Light Serum", exact: true })
        .click();
      await page.getByLabel("Stock adjustment", { exact: true }).fill("1");
      await page.getByLabel("Reason", { exact: true }).fill("Emulator browser inventory check");
      await page.getByRole("button", { name: "Apply stock adjustment", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(
        page.getByText("Emulator browser inventory check", { exact: true }).first(),
      ).toBeVisible();
      await page.goto("/admin/categories");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    } finally {
      testInfo.setTimeout(testInfo.timeout + 10000);
      await page.request.patch("/api/admin/products", {
        headers,
        data: { id: product.id, product: input },
      });
      const latest: Product = (
        await (await page.request.get("/api/admin/products")).json()
      ).products.find((p: Product) => p.id === product.id);
      if (latest.stock !== product.stock)
        await page.request.patch("/api/admin/inventory", {
          headers,
          data: {
            productId: product.id,
            delta: product.stock - latest.stock,
            reason: "Restore browser test inventory",
          },
        });
    }
  });
});
