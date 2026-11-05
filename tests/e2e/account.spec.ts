import { test, expect } from "@playwright/test";

test.describe("customer account in Firebase emulators", () => {
  test.skip(process.env.VELA_E2E_EMULATOR !== "1", "Requires explicit emulator mode.");
  test("signs in, saves profile and address, then signs out", async ({ page }) => {
    await page.goto("/account");
    await expect(page).toHaveURL(/\/sign-in/);
    await page.getByLabel("Email address", { exact: true }).fill("customer@example.test");
    await page.getByLabel("Password", { exact: true }).fill("Vela-local-2026!");
    await page.getByRole("button", { name: "Welcome back", exact: true }).click();
    await expect(page).toHaveURL(/\/account$/);
    const changedName = `VELA Customer ${Date.now()}`;
    await page.getByLabel("Your name", { exact: true }).fill(changedName);
    await page.getByRole("button", { name: "Add an address", exact: true }).click();
    const address = page.getByRole("group", { name: /Address \d+/ }).last();
    await address.getByLabel("Recipient name", { exact: true }).fill("VELA Customer");
    await address.getByLabel("Street address", { exact: true }).fill("100 Test Lane");
    await address.getByLabel("City", { exact: true }).fill("New York");
    await address.getByLabel("ZIP / postal code", { exact: true }).fill("10001");
    await page.getByRole("button", { name: "Save my details", exact: true }).click();
    await expect(page.getByRole("status")).toContainText(/saved|updated/i);
    await page.reload();
    await expect(page.getByLabel("Your name", { exact: true })).toHaveValue(changedName);
    await expect(page.getByLabel("Street address", { exact: true }).last()).toHaveValue(
      "100 Test Lane",
    );
    await page
      .getByRole("button", { name: /Remove address \d+/ })
      .last()
      .click();
    await page.getByLabel("Your name", { exact: true }).fill("VELA Customer");
    await page.getByRole("button", { name: "Save my details", exact: true }).click();
    await expect(page.getByRole("status")).toContainText(/saved|updated/i);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(/\/(sign-in)?$/);
    await page.goto("/account");
    await expect(page).toHaveURL(/\/sign-in/);
  });
  test("registers a customer and honestly presents email verification", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Your name", { exact: true }).fill("New VELA Customer");
    await page
      .getByLabel("Email address", { exact: true })
      .fill(`customer-${Date.now()}@example.test`);
    await page.getByLabel("Password", { exact: true }).fill("NewLocal!2026");
    await page.getByLabel("Confirm password", { exact: true }).fill("NewLocal!2026");
    await page.getByRole("button", { name: "Create my account", exact: true }).click();
    await expect(page).toHaveURL(/\/account/);
    await expect(page.getByRole("button", { name: "Send verification email" })).toBeVisible();
    await expect(page.getByLabel("Your name", { exact: true })).toHaveValue("New VELA Customer");
  });
});
