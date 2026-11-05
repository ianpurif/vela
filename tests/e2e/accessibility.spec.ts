import { test, expect, type Page, type TestInfo, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";

const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function audit(page: Page, info: TestInfo, label: string, dialog = false) {
  await page.evaluate(() => document.fonts.ready);
  const result = await new AxeBuilder({ page }).withTags(tags).analyze();
  const geometry = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    main: document.querySelectorAll("main#main").length,
  }));
  const name = `axe-${label.replaceAll(/[^a-z0-9-]/gi, "-")}`;
  const reportPath = info.outputPath(`${name}.json`);
  await writeFile(
    reportPath,
    JSON.stringify(
      {
        label,
        url: page.url(),
        viewport: page.viewportSize(),
        geometry,
        violations: result.violations,
        incomplete: result.incomplete,
      },
      null,
      2,
    ),
  );
  await info.attach(name, {
    path: reportPath,
    contentType: "application/json",
  });
  console.log(
    `[axe] ${info.project.name} ${label}: ${result.violations.map((violation) => `${violation.id}(${violation.nodes.length})`).join(", ") || "clear"}; width ${geometry.document}/${geometry.viewport}`,
  );
  expect
    .soft(geometry.document, `${label}: page horizontal overflow`)
    .toBeLessThanOrEqual(geometry.viewport);
  if (!dialog) expect.soft(geometry.main, `${label}: one main landmark and skip target`).toBe(1);
  expect
    .soft(
      result.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.map((node) => ({
          target: node.target,
          summary: node.failureSummary,
        })),
      })),
      `${label}: WCAG 2.1 AA automated findings`,
    )
    .toEqual([]);
}

async function visit(page: Page, path: string) {
  const response = await page.goto(path);
  expect(response?.status(), `${path} responds successfully`).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

async function signIn(page: Page, role: "customer" | "admin") {
  const base = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
  if (
    process.env.VELA_E2E_EMULATOR !== "1" ||
    process.env.VERCEL ||
    !["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname)
  )
    throw new Error("Accessibility sign-ins require explicitly enabled loopback emulators.");
  await page.goto(`/sign-in?returnTo=${role === "admin" ? "/admin" : "/account"}`);
  await page.getByLabel("Email address", { exact: true }).fill(`${role}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("Vela-local-2026!");
  await page.getByRole("button", { name: "Welcome back", exact: true }).click();
  await expect(page).toHaveURL(role === "admin" ? /\/admin$/ : /\/account$/);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: role === "admin" ? "A clear view of your store." : /^Hello,/,
    }),
  ).toBeVisible();
}

async function focusIsInside(dialog: Locator) {
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
}

async function focusedIndicatorContrast(target: Locator) {
  return target.evaluate((element) => {
    const style = getComputedStyle(element);
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d")!;
    function rgb(color: string) {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data];
    }
    function luminance(color: number[]) {
      const channels = color.slice(0, 3).map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    }
    let ancestor = element.parentElement;
    let background = rgb("#f7f3ed");
    while (ancestor) {
      const color = rgb(getComputedStyle(ancestor).backgroundColor);
      if (color[3] >= 240) {
        background = color;
        break;
      }
      ancestor = ancestor.parentElement;
    }
    const colors = [
      ...(style.outlineStyle !== "none" && parseFloat(style.outlineWidth) >= 2
        ? [style.outlineColor]
        : []),
      ...(style.boxShadow.match(/(?:rgba?\([^)]*\)|color\([^)]*\))/g) ?? []),
    ];
    const contrasts = colors.map((color) => {
      const a = luminance(rgb(color));
      const b = luminance(background);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
    return {
      visible: element.matches(":focus-visible"),
      outline: style.outline,
      shadow: style.boxShadow,
      contrast: Math.max(0, ...contrasts),
    };
  });
}

test.beforeEach(async ({ page }) => {
  page.setDefaultTimeout(10000);
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("public discovery, product and populated cart meet WCAG 2.1 AA checks", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  for (const path of ["/", "/shop", "/cart", "/products/first-light-serum"]) {
    await visit(page, path);
    await audit(page, info, path);
  }
  await page.getByRole("button", { name: /Add to bag.*First Light Serum/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await audit(page, info, "populated-bag-dialog", true);
  await page.keyboard.press("Escape");
  await visit(page, "/cart");
  await audit(page, info, "populated-cart");
});

test("support and authentication forms expose accessible names and validation", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  for (const path of [
    "/contact",
    "/newsletter",
    "/faq",
    "/sign-in",
    "/register",
    "/reset-password",
  ]) {
    await visit(page, path);
    await audit(page, info, path);
  }
  await visit(page, "/contact");
  await page.getByRole("button", { name: "Save message", exact: true }).click();
  await expect(page.getByLabel("Your name", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByLabel("Your name", { exact: true })).toBeFocused();
  await audit(page, info, "contact-validation");
});

test("every routine step and the result remain accessible with keyboard choices", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  await visit(page, "/routine");
  const options = [
    "Dry",
    "Dryness",
    "Often sensitive",
    "Balanced (3 steps)",
    "Fragrance-free only",
  ];
  for (let step = 0; step < options.length; step += 1) {
    await expect(
      page.getByRole("progressbar", { name: "Routine finder progress" }),
    ).toHaveAttribute("aria-valuenow", String(step + 1));
    await audit(page, info, `routine-step-${step + 1}`);
    const control = page.getByLabel(options[step], { exact: true });
    await control.focus();
    await page.keyboard.press("Space");
    await expect(control).toBeChecked();
    const next = page.getByRole("button", {
      name: step === 4 ? "See my ritual" : "Continue",
      exact: true,
    });
    await next.focus();
    await page.keyboard.press("Enter");
    if (step < 4) await expect(page.locator("fieldset legend h2")).toBeFocused();
  }
  await expect(
    page.getByRole("heading", { name: "Your considered ritual.", exact: true }),
  ).toBeFocused();
  await audit(page, info, "routine-results");
});

test("emulator customer and administrator screens meet WCAG 2.1 AA checks", async ({
  page,
}, info) => {
  test.skip(process.env.VELA_E2E_EMULATOR !== "1", "Requires explicitly enabled local emulators.");
  test.setTimeout(240000);
  await signIn(page, "customer");
  await audit(page, info, "customer-account");
  await page.getByRole("button", { name: "Add an address", exact: true }).click();
  await audit(page, info, "customer-address-form");
  await visit(page, "/account/orders");
  await audit(page, info, "customer-orders");
  await visit(page, "/account");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).not.toHaveURL(/\/account$/);
  await signIn(page, "admin");
  for (const path of [
    "/admin",
    "/admin/products",
    "/admin/products/first-light-serum",
    "/admin/inventory",
    "/admin/categories",
    "/admin/orders",
    "/admin/customers",
    "/admin/content",
    "/admin/analytics",
    "/admin/support",
  ]) {
    await visit(page, path);
    await audit(page, info, path);
  }
  await visit(page, "/admin/analytics");
  await page.getByText("View daily data", { exact: true }).click();
  await audit(page, info, "admin-analytics-data-table");
  if (info.project.name === "mobile") {
    const menu = page.getByRole("button", { name: "Open administration menu", exact: true });
    await menu.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    for (let index = 0; index < 8; index += 1) {
      await page.keyboard.press("Tab");
      await focusIsInside(dialog);
    }
    await audit(page, info, "administration-menu-dialog", true);
    await page.keyboard.press("Escape");
    await expect(menu).toBeFocused();
  }
});

test("skip link, focus indicators and modal keyboard boundaries work", async ({ page }, info) => {
  test.setTimeout(120000);
  await visit(page, "/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content", exact: true });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  expect
    .soft(
      await page.evaluate(() => !!document.activeElement?.closest("main")),
      "Skip link moves the next keyboard stop into main",
    )
    .toBe(true);

  const search = page.getByRole("button", { name: "Search products", exact: true });
  await search.focus();
  await page.keyboard.press("Enter");
  let dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const input = dialog.getByRole("textbox", { name: "Search the collection" });
  await expect(input).toBeFocused();
  const searchFocus = await focusedIndicatorContrast(input);
  expect.soft(searchFocus.visible, "Search input has keyboard focus styling").toBe(true);
  expect
    .soft(searchFocus.contrast, "Search focus indicator contrasts with ivory")
    .toBeGreaterThanOrEqual(3);
  for (let index = 0; index < 5; index += 1) {
    await page.keyboard.press("Tab");
    await focusIsInside(dialog);
  }
  await audit(page, info, "search-dialog", true);
  await page.keyboard.press("Escape");
  await expect(search).toBeFocused();

  const bag = page.getByRole("button", { name: "Shopping bag", exact: true });
  await bag.focus();
  await page.keyboard.press("Enter");
  dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  for (let index = 0; index < 5; index += 1) {
    await page.keyboard.press("Tab");
    await focusIsInside(dialog);
  }
  await audit(page, info, "empty-bag-dialog", true);
  await page.keyboard.press("Escape");
  await expect(bag).toBeFocused();

  if (info.project.name === "mobile") {
    const menu = page.getByRole("button", { name: "Open navigation", exact: true });
    await menu.focus();
    await page.keyboard.press("Enter");
    dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    for (let index = 0; index < 8; index += 1) {
      await page.keyboard.press("Tab");
      await focusIsInside(dialog);
    }
    await audit(page, info, "mobile-navigation-dialog", true);
    await page.keyboard.press("Escape");
    await expect(menu).toBeFocused();
  }

  const footerLink = page
    .locator("footer")
    .getByRole("link", { name: "Our philosophy", exact: true });
  await footerLink.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(footerLink).toBeFocused();
  const focus = await focusedIndicatorContrast(footerLink);
  await info.attach("dark-surface-focus", {
    body: Buffer.from(JSON.stringify(focus, null, 2)),
    contentType: "application/json",
  });
  expect.soft(focus.visible, "Footer link has keyboard focus styling").toBe(true);
  expect
    .soft(focus.contrast, "Focus indicator contrasts with the dark footer")
    .toBeGreaterThanOrEqual(3);

  const newsletterButton = page.getByRole("button", { name: "Save my signup", exact: true });
  await newsletterButton.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(newsletterButton).toBeFocused();
  const buttonFocus = await focusedIndicatorContrast(newsletterButton);
  expect.soft(buttonFocus.visible, "Shared button has keyboard focus styling").toBe(true);
  expect
    .soft(buttonFocus.contrast, "Shared button focus contrasts with the warm newsletter surface")
    .toBeGreaterThanOrEqual(3);

  if (info.project.name === "desktop") {
    await page
      .getByRole("navigation", { name: "Main navigation", exact: true })
      .getByRole("link", { name: "The collection", exact: true })
      .hover();
    const hover = await new AxeBuilder({ page }).include("header").withTags(tags).analyze();
    await info.attach("navigation-hover", {
      body: Buffer.from(JSON.stringify(hover.violations, null, 2)),
      contentType: "application/json",
    });
    expect(hover.violations, "Desktop navigation keeps adequate contrast when hovered").toEqual([]);
  }
});
