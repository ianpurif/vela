import { test, expect } from "@playwright/test";

test("catalog discovery, product details and persistent cart", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Good skin.");
  await page.getByRole("link", { name: /Explore the collection/ }).click();
  await expect(page).toHaveURL(/\/shop/);
  await page.getByRole("link", { name: "First Light Serum", exact: true }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("First Light Serum");
  await page.getByRole("button", { name: /Add to (bag|cart)/i }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/cart");
  await expect(page.getByText("First Light Serum", { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("First Light Serum", { exact: true }).first()).toBeVisible();
});

test("layout has no horizontal overflow and navigation remains keyboard accessible", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Close navigation" }).click();
  }
  await page.screenshot({ path: `test-results/home-${testInfo.project.name}.png`, fullPage: true });
  expect(errors).toEqual([]);
});
