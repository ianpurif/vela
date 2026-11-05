import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const emulatorOrigin = "http://127.0.0.1:9099";
const identityEndpoint = `${emulatorOrigin}/identitytoolkit.googleapis.com/v1`;
const localApiKey = "demo-vela-emulator-key";
const initialPassword = "LocalOnly!Vela2026";

type EmulatorOobCode = {
  email: string;
  oobCode: string;
  requestType: "VERIFY_EMAIL" | "PASSWORD_RESET";
};

async function codeFor(
  request: APIRequestContext,
  email: string,
  requestType: EmulatorOobCode["requestType"],
) {
  let matchingCode: EmulatorOobCode | undefined;
  await expect
    .poll(
      async () => {
        const response = await request.get(
          `${emulatorOrigin}/emulator/v1/projects/demo-vela/oobCodes`,
        );
        expect(response.ok()).toBeTruthy();
        const { oobCodes = [] } = (await response.json()) as { oobCodes?: EmulatorOobCode[] };
        matchingCode = oobCodes
          .filter((code) => code.email === email && code.requestType === requestType)
          .at(-1);
        return Boolean(matchingCode);
      },
      { message: `The local emulator should record ${requestType} for this test account.` },
    )
    .toBe(true);
  return matchingCode!.oobCode;
}

async function register(page: Page, email: string, name: string) {
  await page.goto("/register");
  await page.getByLabel("Your name", { exact: true }).fill(name);
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(initialPassword);
  await page.getByLabel("Confirm password", { exact: true }).fill(initialPassword);
  await page.getByRole("button", { name: "Create my account", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByLabel("Your name", { exact: true })).toHaveValue(name);
}

async function signIn(page: Page, email: string, password: string) {
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Welcome back", exact: true }).click();
}

test.describe("emulator email verification and password recovery", () => {
  test.skip(process.env.VELA_E2E_EMULATOR !== "1", "Requires explicit local emulator mode.");

  test.beforeEach(async ({ context, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Identity recovery is independent of viewport.");
    expect(baseURL).toBe("http://127.0.0.1:3000");
    // A configuration regression must fail rather than create external accounts or emails.
    await context.route(/^https:\/\/(identitytoolkit|securetoken)\.googleapis\.com\//, (route) =>
      route.abort(),
    );
    await context.route("https://accounts.google.com/**", (route) => route.abort());
  });

  test("confirms an emulator email action and refreshes the verified server session", async ({
    page,
    request,
  }) => {
    const email = `verify-${randomUUID()}@example.test`;
    await register(page, email, "Verification Customer");
    await expect(page.getByText("Email verified", { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "I’ve verified my email", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Your email isn’t verified yet");
    expect((await (await page.request.get("/api/auth/me")).json()).user.emailVerified).toBe(false);

    await page.getByRole("button", { name: "Send verification email", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Verification email sent");
    const oobCode = await codeFor(request, email, "VERIFY_EMAIL");
    const applied = await request.post(`${identityEndpoint}/accounts:update?key=${localApiKey}`, {
      data: { oobCode },
    });
    expect(applied.ok()).toBeTruthy();

    await page.getByRole("button", { name: "I’ve verified my email", exact: true }).click();
    await expect(page.getByText("Email verified", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send verification email", exact: true }),
    ).toHaveCount(0);
    await page.reload();
    await expect(page.getByText("Email verified", { exact: true })).toBeVisible();
    const session = await (await page.request.get("/api/auth/me")).json();
    expect(session.user.email).toBe(email);
    expect(session.user.emailVerified).toBe(true);
    expect(session.user.admin).toBe(false);
  });

  test("resets an isolated customer's password and rejects the old password", async ({
    page,
    request,
  }) => {
    const email = `reset-${randomUUID()}@example.test`;
    const newPassword = "ReplacedLocal!Vela2026";
    await register(page, email, "Password Recovery Customer");
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(/\/sign-in$/);

    await page.getByRole("link", { name: "Forgot password?", exact: true }).click();
    await expect(page).toHaveURL(/\/reset-password$/);
    await page.getByLabel("Email address", { exact: true }).fill(email);
    await page.getByRole("button", { name: "Send reset link", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("If an account exists for that email");
    const oobCode = await codeFor(request, email, "PASSWORD_RESET");
    const reset = await request.post(
      `${identityEndpoint}/accounts:resetPassword?key=${localApiKey}`,
      {
        data: { oobCode, newPassword },
      },
    );
    expect(reset.ok()).toBeTruthy();
    const reused = await request.post(
      `${identityEndpoint}/accounts:resetPassword?key=${localApiKey}`,
      {
        data: { oobCode, newPassword: "MustNeverApply!2026" },
      },
    );
    expect(reused.status()).toBe(400);

    await page.getByRole("link", { name: "Return to sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await signIn(page, email, initialPassword);
    await expect(
      page.getByRole("form", { name: "Sign in to VELA" }).getByRole("alert"),
    ).toContainText("That email and password didn’t match");
    await expect(page).toHaveURL(/\/sign-in$/);
    expect((await (await page.request.get("/api/auth/me")).json()).user).toBeNull();

    await signIn(page, email, newPassword);
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByLabel("Your name", { exact: true })).toHaveValue(
      "Password Recovery Customer",
    );
    expect((await (await page.request.get("/api/auth/me")).json()).user.email).toBe(email);
  });

  test("creates a customer session through the local Google provider popup", async ({
    page,
    context,
  }) => {
    const email = `google-${randomUUID()}@example.test`;
    // The emulator's optional Material styling loads from a CDN before its inline
    // handlers. Keep this local test independent of that cosmetic network request.
    await context.route(
      /^https:\/\/(unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//,
      (route) => route.abort(),
    );
    await page.goto("/sign-in");
    const popupOpened = page.waitForEvent("popup");
    await page.getByRole("button", { name: "Continue with Google", exact: true }).click();
    const popup = await popupOpened;
    await expect(popup).toHaveURL(/^http:\/\/127\.0\.0\.1:9099\/emulator\/auth\/handler/);
    await popup.waitForLoadState("domcontentloaded");
    await popup.getByRole("button", { name: "Add new account", exact: true }).click();
    // These IDs belong to the installed Firebase Auth emulator's provider widget.
    await popup.locator("#email-input").fill(email);
    await popup.locator("#display-name-input").fill("Google Emulator Customer");
    await popup.locator("#sign-in").click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByLabel("Your name", { exact: true })).toHaveValue(
      "Google Emulator Customer",
    );
    const session = await (await page.request.get("/api/auth/me")).json();
    expect(session.user.email).toBe(email);
    expect(session.user.admin).toBe(false);
    await expect(page.getByRole("link", { name: "Store administration", exact: true })).toHaveCount(
      0,
    );
  });
});
