import { test, expect, type Page } from "@playwright/test";
import { createHash, randomUUID } from "node:crypto";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { Product } from "../../src/types/commerce";
import type { ContactInput } from "../../src/lib/validation/support";

function localDatabase(prefix: string) {
  const base = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
  if (
    process.env.VELA_E2E_EMULATOR !== "1" ||
    process.env.VERCEL ||
    !["127.0.0.1", "localhost", "[::1]"].includes(new URL(base).hostname) ||
    (process.env.FIRESTORE_EMULATOR_HOST &&
      process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080")
  ) {
    throw new Error("Personalization fixtures require demo-vela on loopback emulators.");
  }
  const previousHost = process.env.FIRESTORE_EMULATOR_HOST;
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
  const app = initializeApp({ projectId: "demo-vela" }, prefix);
  const db = getFirestore(app);
  return {
    db,
    base,
    async close() {
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
    },
  };
}

async function noPageOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBeTruthy();
}

async function captureLayout(page: Page, name: string, project: string) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  });
  let previousGeometry = "";
  await expect
    .poll(async () => {
      const geometry = await page
        .locator("header")
        .first()
        .evaluate((element) => {
          const box = element.getBoundingClientRect();
          return { scrollY: window.scrollY, top: box.top, height: box.height };
        });
      const currentGeometry = JSON.stringify(geometry);
      const stable = currentGeometry === previousGeometry;
      previousGeometry = currentGeometry;
      return stable && geometry.scrollY === 0 && geometry.top >= 0 && geometry.top < 80;
    })
    .toBe(true);
  expect(
    await page
      .getByRole("link", { name: "Skip to content", exact: true })
      .evaluate((element) => element.getBoundingClientRect().bottom),
  ).toBeLessThanOrEqual(0);
  if (project === "mobile") {
    await page.screenshot({ path: `.local/${name}-${project}-top.png` });
  }
  await page.screenshot({ path: `.local/${name}-${project}.png`, fullPage: true });
}

test.describe("local personalization and support", () => {
  test.skip(process.env.VELA_E2E_EMULATOR !== "1", "Requires explicitly enabled local emulators.");

  test("matches a repeatable available routine and adds the complete ritual to the bag", async ({
    page,
  }, testInfo) => {
    test.setTimeout(90000);
    const browserErrors: string[] = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    await page.emulateMedia({ reducedMotion: "reduce" });
    const nonce = randomUUID().replaceAll("-", "").slice(0, 12);
    const local = localDatabase(`local-personalization-${testInfo.project.name}-${nonce}`);
    const excludedIds = [`local-quiz-${nonce}-archived`, `local-quiz-${nonce}-unavailable`];
    try {
      const source = await local.db.collection("products").doc("first-light-serum").get();
      expect(source.exists).toBe(true);
      const serum = source.data() as Product;
      const seed = local.db.batch();
      for (const [index, id] of excludedIds.entries()) {
        seed.set(local.db.collection("products").doc(id), {
          ...serum,
          id,
          slug: id,
          name: `A local excluded serum ${index + 1}`,
          status: index === 0 ? "archived" : "published",
          stock: index === 0 ? 10 : 0,
          reserved: 0,
          rank: 0,
          featured: false,
          fragranceFree: true,
          skinTypes: ["dry", "oily", "combination", "balanced"],
          concerns: ["dryness", "dullness", "texture", "comfort"],
        } satisfies Product);
      }
      await seed.commit();
      await page.goto("/routine");
      async function chooseAnswer(label: string) {
        // The native controls are visually hidden; visitors select their visible labels.
        await page.getByText(label, { exact: true }).click();
        await expect(page.getByLabel(label, { exact: true })).toBeChecked();
      }
      await chooseAnswer("Dry");
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await chooseAnswer("Dryness");
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await chooseAnswer("Often sensitive");
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await chooseAnswer("Balanced (3 steps)");
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await chooseAnswer("Fragrance-free only");
      await page.getByRole("button", { name: "See my ritual", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Your considered ritual.", exact: true }),
      ).toBeVisible();

      async function recommendationIds() {
        const articles = page.locator('article[aria-label^="Step "]');
        await expect(articles).toHaveCount(3);
        const ids: string[] = [];
        for (const article of await articles.all()) {
          const href = await article.locator('a[href^="/products/"]').first().getAttribute("href");
          expect(href).toBeTruthy();
          ids.push(decodeURIComponent(href!.split("/products/")[1]));
        }
        return ids;
      }
      const first = await recommendationIds();
      expect(new Set(first).size).toBe(first.length);
      for (const id of first) {
        expect(excludedIds).not.toContain(id);
        const product = (await local.db.collection("products").doc(id).get()).data() as Product;
        expect(product.status).toBe("published");
        expect(product.stock - product.reserved).toBeGreaterThan(0);
        expect(product.fragranceFree).toBe(true);
        expect(product.skinTypes).toContain("dry");
        await expect(page.getByRole("heading", { name: product.name, exact: true })).toBeVisible();
      }
      await page.getByRole("button", { name: "Edit answers", exact: true }).click();
      await expect(page.getByLabel("Dry", { exact: true })).toBeChecked();
      for (const selected of [
        "Dryness",
        "Often sensitive",
        "Balanced (3 steps)",
        "Fragrance-free only",
      ]) {
        await page.getByRole("button", { name: "Continue", exact: true }).click();
        await expect(page.getByLabel(selected, { exact: true })).toBeChecked();
      }
      await page.getByRole("button", { name: "See my ritual", exact: true }).click();
      expect(await recommendationIds()).toEqual(first);
      await noPageOverflow(page);
      await page.screenshot({
        path: `.local/routine-${testInfo.project.name}.png`,
        fullPage: true,
      });
      await page.getByRole("button", { name: "Add routine to bag", exact: true }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect
        .poll(async () =>
          page.evaluate(() => {
            const saved = JSON.parse(localStorage.getItem("vela-bag-v1") || "{}");
            return saved.state?.items || [];
          }),
        )
        .toEqual(first.map((productId) => ({ productId, quantity: 1 })));
      await page.keyboard.press("Escape");
      await page.goto("/cart");
      await page.reload();
      for (const id of first) {
        await expect(page.locator(`a[href="/products/${id}"]`).first()).toBeVisible();
      }
      await noPageOverflow(page);
      expect(browserErrors).toEqual([]);
    } finally {
      testInfo.setTimeout(testInfo.timeout + 15000);
      try {
        const cleanup = local.db.batch();
        for (const id of excludedIds) cleanup.delete(local.db.collection("products").doc(id));
        await cleanup.commit();
      } finally {
        await local.close();
      }
    }
  });

  test("saves private support messages safely and manages consent with a private preference key", async ({
    page,
  }, testInfo) => {
    test.setTimeout(120000);
    const browserErrors: string[] = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    await page.emulateMedia({ reducedMotion: "reduce" });
    const nonce = randomUUID().replaceAll("-", "").slice(0, 12);
    const local = localDatabase(`local-support-${testInfo.project.name}-${nonce}`);
    const request = page.request;
    const headers = { Origin: new URL(local.base).origin };
    const email = `local_support_${testInfo.project.name}_${nonce}@example.test`;
    const digest = (value: string) => createHash("sha256").update(value).digest("hex");
    const newsletterId = `n_${digest(email)}`;
    const newsletterRef = local.db.collection("newsletterSubscribers").doc(newsletterId);
    const contactAttempts: ContactInput[] = [];
    const contactDeliveryStatuses: number[] = [];
    const contactIds = new Set<string>();
    const subject = `Local support ${nonce}`;
    const message = `A local test note ${nonce}. Please review the test-order information.\nThis is plain text: <strong>no markup</strong>.`;

    async function login(address: string) {
      const response = await request.post(
        "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-vela-emulator-key",
        { data: { email: address, password: "Vela-local-2026!", returnSecureToken: true } },
      );
      expect(response.status()).toBe(200);
      const { idToken } = (await response.json()) as { idToken: string };
      expect(
        (await request.post("/api/auth/session", { headers, data: { idToken } })).status(),
      ).toBe(200);
      return idToken;
    }

    async function expectPrivateFirestore(id: string, collection: string, idToken?: string) {
      const response = await request.get(
        `http://127.0.0.1:8080/v1/projects/demo-vela/databases/(default)/documents/${collection}/${id}`,
        { headers: idToken ? { Authorization: `Bearer ${idToken}` } : {} },
      );
      expect(response.status()).toBe(403);
    }

    try {
      for (const path of ["/about", "/faq", "/shipping", "/returns", "/privacy", "/terms"]) {
        const response = await page.goto(path);
        expect(response?.status()).toBe(200);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        if (path === "/faq") {
          const answer = page
            .locator("details")
            .filter({ hasText: "Will I receive newsletter emails?" });
          await answer.locator("summary").click();
          await expect(answer).toHaveAttribute("open", "");
          await expect(
            answer.getByRole("link", { name: "newsletter preferences", exact: true }),
          ).toBeVisible();
        }
        await noPageOverflow(page);
      }

      expect((await request.get("/api/admin/support")).status()).toBe(401);
      const contactPage = await page.goto("/contact");
      expect(contactPage?.status()).toBe(200);
      const contact = page.getByRole("form", { name: "Contact VELA", exact: true });
      await contact.getByLabel("Your name", { exact: true }).fill("Local support visitor");
      await contact.getByLabel("Email address", { exact: true }).fill(email);
      await contact.getByLabel("Subject", { exact: true }).fill(subject);
      await contact.getByLabel("Message", { exact: true }).fill(message);

      // Persist the first request, then lose only its response. The retry must reuse its key.
      await page.route("**/api/contact", async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        const data = route.request().postDataJSON() as ContactInput;
        contactAttempts.push(data);
        contactIds.add(`c_${digest(data.requestKey)}`);
        if (contactAttempts.length === 1) {
          const delivered = await route.fetch();
          contactDeliveryStatuses.push(delivered.status());
          await route.abort("failed");
        } else {
          await route.continue();
        }
      });
      await contact.getByRole("button", { name: "Save message", exact: true }).click();
      await expect(contact.getByRole("alert")).toContainText("couldn’t confirm");
      expect(contactDeliveryStatuses).toEqual([200]);
      expect(contactAttempts).toHaveLength(1);
      expect(contactAttempts[0].requestKey).toMatch(/^[a-f0-9-]{36}$/);
      const contactId = `c_${digest(contactAttempts[0].requestKey)}`;
      const contactRef = local.db.collection("contactMessages").doc(contactId);
      const storedMessage = (await contactRef.get()).data();
      expect(storedMessage).toMatchObject({
        email,
        subject,
        message,
        name: "Local support visitor",
        status: "new",
      });
      await expect(contact.getByLabel("Message", { exact: true })).toHaveValue(message);
      const [retried] = await Promise.all([
        page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === "/api/contact" &&
            response.request().method() === "POST",
        ),
        contact.getByRole("button", { name: "Save message", exact: true }).click(),
      ]);
      expect(retried.status()).toBe(200);
      expect(await retried.json()).toEqual({ saved: true });
      await expect(contact.getByRole("status")).toContainText("saved for the VELA team");
      expect(contactAttempts).toHaveLength(2);
      expect(contactAttempts[1]).toEqual(contactAttempts[0]);
      expect((await contactRef.get()).data()).toEqual(storedMessage);
      expect(
        (await local.db.collection("contactMessages").where("email", "==", email).get()).size,
      ).toBe(1);
      expect(
        (
          await request.post("/api/contact", {
            headers,
            data: { ...contactAttempts[0], message: `${message} Changed.` },
          })
        ).status(),
      ).toBe(409);
      expect((await contactRef.get()).data()).toEqual(storedMessage);
      await noPageOverflow(page);

      const newsletterPage = await page.goto("/newsletter");
      expect(newsletterPage?.status()).toBe(200);
      const newsletter = page
        .locator("main")
        .getByRole("form", { name: "Newsletter preferences", exact: true });
      await newsletter.getByLabel("Email address", { exact: true }).fill(email);
      await newsletter.getByRole("button", { name: "Save my signup", exact: true }).click();
      await expect(newsletter.getByRole("alert")).toContainText("Please agree");
      expect((await newsletterRef.get()).exists).toBe(false);
      expect(
        (
          await request.post("/api/newsletter", {
            headers,
            data: { action: "subscribe", email, consent: false, preferenceKey: "1".repeat(64) },
          })
        ).status(),
      ).toBe(400);
      await newsletter
        .getByLabel("I agree to receive occasional VELA emails and can unsubscribe at any time.", {
          exact: true,
        })
        .check();
      const [signup] = await Promise.all([
        page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === "/api/newsletter" &&
            response.request().method() === "POST",
        ),
        newsletter.getByRole("button", { name: "Save my signup", exact: true }).click(),
      ]);
      expect(signup.status()).toBe(200);
      expect(await signup.json()).toEqual({ accepted: true });
      const signupRequest = signup.request().postDataJSON() as { preferenceKey: string };
      expect(signupRequest.preferenceKey).toMatch(/^[a-f0-9]{64}$/);
      await expect(newsletter.getByRole("status")).toContainText("saved as pending");
      const storedSignup = (await newsletterRef.get()).data();
      expect(storedSignup).toMatchObject({
        email,
        status: "pending",
        consentVersion: "vela-newsletter-v1",
        preferenceKeyHash: digest(signupRequest.preferenceKey),
        unsubscribedAt: null,
      });
      expect(JSON.stringify(storedSignup)).not.toContain(signupRequest.preferenceKey);
      const privateLink = await newsletter
        .getByRole("link", { name: "Open private preferences", exact: true })
        .getAttribute("href");
      expect(privateLink).toBeTruthy();
      const privateUrl = new URL(privateLink!, local.base);
      expect(privateUrl.pathname).toBe("/newsletter");
      expect(privateUrl.search).toBe("");
      const fragment = new URLSearchParams(privateUrl.hash.slice(1));
      expect(fragment.get("email")).toBe(email);
      expect(fragment.get("key")).toBe(signupRequest.preferenceKey);

      const strangerKey =
        signupRequest.preferenceKey === "2".repeat(64) ? "3".repeat(64) : "2".repeat(64);
      for (const data of [
        { action: "subscribe", email, consent: true, preferenceKey: strangerKey },
        { action: "unsubscribe", email, preferenceKey: strangerKey },
      ]) {
        const response = await request.post("/api/newsletter", { headers, data });
        expect(response.status()).toBe(200);
        expect(await response.json()).toEqual({ accepted: true });
        expect((await newsletterRef.get()).data()).toEqual(storedSignup);
      }
      expect((await request.get("/api/newsletter")).status()).toBe(405);
      await page.evaluate(
        (address) => localStorage.removeItem(`vela:newsletter-preference:v1:${address}`),
        email,
      );
      await page.goto("/newsletter");
      await newsletter.getByLabel("Email address", { exact: true }).fill(email);
      await newsletter.getByRole("button", { name: "Unsubscribe instead", exact: true }).click();
      await newsletter.getByRole("button", { name: "Unsubscribe", exact: true }).click();
      await expect(newsletter.getByRole("alert")).toContainText(
        "Open your private preferences link",
      );
      expect((await newsletterRef.get()).data()).toEqual(storedSignup);
      await page.goto(privateUrl.toString());
      await expect(newsletter.getByLabel("Email address", { exact: true })).toHaveValue(email);
      await expect(
        newsletter.getByRole("button", { name: "Unsubscribe", exact: true }),
      ).toBeVisible();
      expect((await newsletterRef.get()).data()).toEqual(storedSignup);
      const [unsubscribe] = await Promise.all([
        page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === "/api/newsletter" &&
            response.request().method() === "POST",
        ),
        newsletter.getByRole("button", { name: "Unsubscribe", exact: true }).click(),
      ]);
      expect(unsubscribe.status()).toBe(200);
      expect(await unsubscribe.json()).toEqual({ accepted: true });
      await expect(newsletter.getByRole("status")).toContainText("request processed");
      const unsubscribed = (await newsletterRef.get()).data();
      expect(unsubscribed).toMatchObject({
        email,
        status: "unsubscribed",
        preferenceKeyHash: storedSignup!.preferenceKeyHash,
      });
      expect(unsubscribed!.unsubscribedAt).toBeGreaterThanOrEqual(storedSignup!.createdAt);
      const replay = await request.post("/api/newsletter", {
        headers,
        data: { action: "unsubscribe", email, preferenceKey: signupRequest.preferenceKey },
      });
      expect(replay.status()).toBe(200);
      expect(await replay.json()).toEqual({ accepted: true });
      expect((await newsletterRef.get()).data()).toEqual(unsubscribed);
      await noPageOverflow(page);
      await captureLayout(page, "newsletter", testInfo.project.name);

      await expectPrivateFirestore(contactId, "contactMessages");
      await expectPrivateFirestore(newsletterId, "newsletterSubscribers");
      expect((await request.get(`/api/admin/support/${contactId}`)).status()).toBe(401);
      const customerToken = await login("customer@example.test");
      expect((await request.get("/api/admin/support")).status()).toBe(403);
      expect((await request.get(`/api/admin/support/${contactId}`)).status()).toBe(403);
      expect(
        (
          await request.patch("/api/admin/support", {
            headers,
            data: { id: contactId, status: "closed" },
          })
        ).status(),
      ).toBe(403);
      await expectPrivateFirestore(contactId, "contactMessages", customerToken);
      await expectPrivateFirestore(newsletterId, "newsletterSubscribers", customerToken);
      expect((await contactRef.get()).data()).toEqual(storedMessage);

      await login("admin@example.test");
      const adminResponse = await request.get(`/api/admin/support/${contactId}`);
      expect(adminResponse.status()).toBe(200);
      const adminMessage = (await adminResponse.json()).message;
      expect(adminMessage).toMatchObject({ id: contactId, email, subject, message, status: "new" });
      expect(adminMessage).not.toHaveProperty("payloadHash");
      await page.goto("/admin/support");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("The support inbox.");
      await page.getByRole("link", { name: `Read message: ${subject}`, exact: true }).click();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(subject);
      const supportMessage = page.getByRole("article", { name: "Support message", exact: true });
      await expect(supportMessage).toContainText(email);
      await expect(supportMessage).toContainText(message);
      await expect(supportMessage.locator("strong")).toHaveCount(0);
      const reviewForm = page.getByRole("form", { name: "Update support message", exact: true });
      await reviewForm.getByLabel("Message status", { exact: true }).selectOption("reviewing");
      const [reviewed] = await Promise.all([
        page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === "/api/admin/support" &&
            response.request().method() === "PATCH",
        ),
        reviewForm.getByRole("button", { name: "Save status", exact: true }).click(),
      ]);
      expect(reviewed.status()).toBe(200);
      expect((await reviewed.json()).message.status).toBe("reviewing");
      await expect(reviewForm.getByRole("status")).toHaveText("Message status saved.");
      await page.reload();
      await expect(reviewForm.getByLabel("Message status", { exact: true })).toHaveValue(
        "reviewing",
      );
      expect((await contactRef.get()).data()).toMatchObject({
        status: "reviewing",
        email,
        message,
      });
      const audits = await local.db
        .collection("auditLogs")
        .where("entityId", "==", contactId)
        .get();
      expect(audits.size).toBe(1);
      expect(audits.docs[0].data()).toMatchObject({
        actorId: "vela-admin",
        action: "support.status.updated",
        entityId: contactId,
      });
      await noPageOverflow(page);
      await captureLayout(page, "support", testInfo.project.name);
      expect(browserErrors).toEqual([]);
    } finally {
      testInfo.setTimeout(testInfo.timeout + 15000);
      try {
        const cleanup = local.db.batch();
        cleanup.delete(newsletterRef);
        for (const id of contactIds) {
          cleanup.delete(local.db.collection("contactMessages").doc(id));
          const audits = await local.db.collection("auditLogs").where("entityId", "==", id).get();
          for (const audit of audits.docs) cleanup.delete(audit.ref);
        }
        await cleanup.commit();
      } finally {
        await local.close();
      }
    }
  });
});
