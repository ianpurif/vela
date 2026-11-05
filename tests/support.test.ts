import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { requireAdmin } from "@/server/auth";
import { firestoreStore } from "@/server/repositories/firestore-store";
import {
  contactDocumentId,
  getAdminSupportInbox,
  getAdminSupportMessage,
  newsletterDocumentId,
  saveContactMessage,
  saveNewsletterPreference,
  updateSupportStatus,
} from "@/server/services/support";
import { POST as contactPost } from "@/app/api/contact/route";
import { POST as newsletterPost } from "@/app/api/newsletter/route";
import { GET as inboxGet, PATCH as statusPatch } from "@/app/api/admin/support/route";
import type { ContactMessage, NewsletterSubscriber } from "@/types/support";
import { MemoryStore } from "./helpers/memory-store";

vi.mock("@/server/auth", () => ({ requireAdmin: vi.fn() }));
const now = Date.UTC(2026, 10, 6, 12);
const key = "a".repeat(64);
const otherKey = "b".repeat(64);
const email = "support@example.test";
const contact = () => ({
  name: "Test Customer",
  email,
  subject: "A product question",
  message: "Could you help me choose a daily routine?",
  requestKey: randomUUID(),
});
const signup = () => ({ action: "subscribe", email, consent: true, preferenceKey: key });
const unsubscribe = (preferenceKey = key, address = email) => ({
  action: "unsubscribe",
  email: address,
  preferenceKey,
});
let store: MemoryStore;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://127.0.0.1:3000");
  vi.mocked(requireAdmin)
    .mockReset()
    .mockResolvedValue({
      uid: "admin",
      email: "admin@example.test",
      name: "Admin",
      admin: true,
      emailVerified: true,
    });
  store = new MemoryStore();
  vi.spyOn(firestoreStore, "get").mockImplementation(store.get.bind(store));
  vi.spyOn(firestoreStore, "list").mockImplementation(store.list.bind(store));
  vi.spyOn(firestoreStore, "set").mockImplementation(store.set.bind(store));
  vi.spyOn(firestoreStore, "transaction").mockImplementation(store.transaction.bind(store));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("private contact persistence", () => {
  it("saves bounded normalized content with server-owned status/time and a minimal receipt", async () => {
    const input = contact();
    expect(
      await saveContactMessage(
        { ...input, name: " Test Customer ", email: " SUPPORT@EXAMPLE.TEST " },
        store,
      ),
    ).toEqual({ saved: true });
    const record = await store.get<ContactMessage & { requestKey?: string; payloadHash: string }>(
      "contactMessages",
      contactDocumentId(input.requestKey),
    );
    expect(record).toMatchObject({
      name: "Test Customer",
      email,
      status: "new",
      createdAt: now,
      updatedAt: now,
    });
    expect(record?.payloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(record).not.toHaveProperty("requestKey");
  });

  it("serializes concurrent retries into exactly one record", async () => {
    const input = contact();
    const results = await Promise.all(
      Array.from({ length: 12 }, () => saveContactMessage(input, store)),
    );
    expect(results.every((result) => result.saved)).toBe(true);
    expect(await store.list("contactMessages")).toHaveLength(1);
  });

  it("rejects a changed payload under the same key without overwriting the original", async () => {
    const input = contact();
    await saveContactMessage(input, store);
    await expect(
      saveContactMessage(
        { ...input, message: "A different message should not replace the first one." },
        store,
      ),
    ).rejects.toMatchObject({ status: 409, code: "CONTACT_RETRY_MISMATCH" });
    expect(
      (await store.get<ContactMessage>("contactMessages", contactDocumentId(input.requestKey)))
        ?.message,
    ).toBe(input.message);
  });

  it("keeps reviewed state when an older successful submission is retried", async () => {
    const input = contact();
    await saveContactMessage(input, store);
    await updateSupportStatus({ id: contactDocumentId(input.requestKey), status: "closed" }, store);
    vi.setSystemTime(now + 60_000);
    await saveContactMessage(input, store);
    expect((await getAdminSupportMessage(contactDocumentId(input.requestKey), store))?.status).toBe(
      "closed",
    );
    expect(await store.list("auditLogs")).toHaveLength(1);
  });

  it.each([
    { message: "short" },
    { message: "x".repeat(5001) },
    { subject: "x".repeat(161) },
    { email: "not-an-email" },
    { requestKey: "guessable" },
    { status: "closed" },
    { admin: true },
  ])("rejects invalid or injected fields before persistence: %j", async (change) => {
    await expect(saveContactMessage({ ...contact(), ...change }, store)).rejects.toThrow();
    expect(await store.list("contactMessages")).toHaveLength(0);
  });
});

describe("newsletter consent and private capabilities", () => {
  it("requires explicit consent and saves only a pending signup with a hashed capability", async () => {
    await expect(
      saveNewsletterPreference({ ...signup(), consent: false }, store),
    ).rejects.toThrow();
    await expect(
      saveNewsletterPreference({ action: "subscribe", email, preferenceKey: key }, store),
    ).rejects.toThrow();
    expect(await store.list("newsletterSubscribers")).toHaveLength(0);
    expect(await saveNewsletterPreference(signup(), store)).toEqual({ accepted: true });
    const row = await store.get<NewsletterSubscriber>(
      "newsletterSubscribers",
      newsletterDocumentId(email),
    );
    expect(row).toMatchObject({
      email,
      status: "pending",
      consentVersion: "vela-newsletter-v1",
      consentedAt: now,
      unsubscribedAt: null,
    });
    expect(row?.preferenceKeyHash).toMatch(/^[a-f0-9]{64}$/);
    expect(row?.preferenceKeyHash).not.toBe(key);
    expect(row).not.toHaveProperty("preferenceKey");
  });

  it("deduplicates normalized emails and never rotates or reveals an existing capability", async () => {
    await saveNewsletterPreference(signup(), store);
    const before = await store.get("newsletterSubscribers", newsletterDocumentId(email));
    vi.setSystemTime(now + 1000);
    expect(
      await saveNewsletterPreference(
        { ...signup(), email: " SUPPORT@EXAMPLE.TEST ", preferenceKey: otherKey },
        store,
      ),
    ).toEqual({ accepted: true });
    expect(await store.list("newsletterSubscribers")).toHaveLength(1);
    expect(await store.get("newsletterSubscribers", newsletterDocumentId(email))).toEqual(before);
  });

  it("uses indistinguishable responses for wrong-key and unknown-address unsubscribe attempts", async () => {
    await saveNewsletterPreference(signup(), store);
    const before = await store.get("newsletterSubscribers", newsletterDocumentId(email));
    const wrong = await saveNewsletterPreference(unsubscribe(otherKey), store);
    const unknown = await saveNewsletterPreference(unsubscribe(key, "unknown@example.test"), store);
    expect(wrong).toEqual(unknown);
    expect(wrong).toEqual({ accepted: true });
    expect(await store.get("newsletterSubscribers", newsletterDocumentId(email))).toEqual(before);
    expect(await store.list("newsletterSubscribers")).toHaveLength(1);
  });

  it("requires the matching capability to unsubscribe or renew consent after opting out", async () => {
    await saveNewsletterPreference(signup(), store);
    vi.setSystemTime(now + 1000);
    await saveNewsletterPreference(unsubscribe(), store);
    const optedOut = await store.get<NewsletterSubscriber>(
      "newsletterSubscribers",
      newsletterDocumentId(email),
    );
    expect(optedOut).toMatchObject({
      status: "unsubscribed",
      unsubscribedAt: now + 1000,
      consentedAt: now,
    });
    await saveNewsletterPreference({ ...signup(), preferenceKey: otherKey }, store);
    expect(await store.get("newsletterSubscribers", newsletterDocumentId(email))).toEqual(optedOut);
    vi.setSystemTime(now + 2000);
    await saveNewsletterPreference(signup(), store);
    expect(await store.get("newsletterSubscribers", newsletterDocumentId(email))).toMatchObject({
      status: "pending",
      unsubscribedAt: null,
      consentedAt: now + 2000,
      preferenceKeyHash: optedOut?.preferenceKeyHash,
    });
  });

  it("keeps repeated same-state preference requests idempotent", async () => {
    await Promise.all(Array.from({ length: 8 }, () => saveNewsletterPreference(signup(), store)));
    const before = await store.get("newsletterSubscribers", newsletterDocumentId(email));
    vi.setSystemTime(now + 1000);
    await saveNewsletterPreference(signup(), store);
    expect(await store.get("newsletterSubscribers", newsletterDocumentId(email))).toEqual(before);
    expect(await store.list("newsletterSubscribers")).toHaveLength(1);
  });

  it("rejects email-only mutation and server-owned status injection", async () => {
    await expect(
      saveNewsletterPreference({ action: "unsubscribe", email }, store),
    ).rejects.toThrow();
    await expect(
      saveNewsletterPreference({ ...signup(), status: "active" }, store),
    ).rejects.toThrow();
    await expect(
      saveNewsletterPreference({ ...signup(), preferenceKey: "short" }, store),
    ).rejects.toThrow();
    expect(await store.list("newsletterSubscribers")).toHaveLength(0);
  });
});

describe("authorized support inbox", () => {
  it("independently requires admin claims for every reader and status mutation", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(
      new AppError(403, "Administrator access is required."),
    );
    const id = contactDocumentId(randomUUID());
    await expect(getAdminSupportInbox(undefined, store)).rejects.toMatchObject({ status: 403 });
    await expect(getAdminSupportMessage(id, store)).rejects.toMatchObject({ status: 403 });
    await expect(updateSupportStatus({ id, status: "reviewing" }, store)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("paginates ties safely and omits internal payload fingerprints", async () => {
    const records = Array.from({ length: 101 }, (_, index) => {
      const id = `c_${index.toString(16).padStart(64, "0")}`;
      return {
        id,
        name: "Customer",
        email,
        subject: "Question",
        message: "A saved question for the team.",
        status: "new",
        createdAt: now,
        updatedAt: now,
        payloadHash: "internal",
      };
    });
    const inboxStore = new MemoryStore({
      contactMessages: Object.fromEntries(records.map((record) => [record.id, record])),
    });
    const first = await getAdminSupportInbox(undefined, inboxStore);
    expect(first.messages).toHaveLength(100);
    expect(first.truncated).toBe(true);
    expect(first.messages[0]).not.toHaveProperty("payloadHash");
    const next = await getAdminSupportInbox(first.next!, inboxStore);
    expect(next.messages).toHaveLength(1);
    expect(next.next).toBeNull();
    expect(new Set([...first.messages, ...next.messages].map((message) => message.id)).size).toBe(
      101,
    );
  });

  it("audits effective status changes without modifying message content or duplicating retries", async () => {
    const input = contact();
    await saveContactMessage(input, store);
    const id = contactDocumentId(input.requestKey);
    const before = await getAdminSupportMessage(id, store);
    const updated = await updateSupportStatus({ id, status: "reviewing" }, store);
    await updateSupportStatus({ id, status: "reviewing" }, store);
    expect(updated).toEqual({ ...before, status: "reviewing" });
    expect(await store.list("auditLogs")).toHaveLength(1);
    expect(updated).not.toHaveProperty("payloadHash");
    await expect(
      updateSupportStatus({ id, status: "closed", email: "other@example.test" }, store),
    ).rejects.toThrow();
  });

  it("rolls back status if its audit cannot be saved", async () => {
    const input = contact();
    await saveContactMessage(input, store);
    const transaction = store.transaction.bind(store);
    vi.spyOn(store, "transaction").mockImplementation((work) =>
      transaction((tx) =>
        work({
          ...tx,
          set(collection, id, value) {
            if (collection === "auditLogs") throw new Error("Audit unavailable");
            tx.set(collection, id, value);
          },
        }),
      ),
    );
    await expect(
      updateSupportStatus({ id: contactDocumentId(input.requestKey), status: "closed" }, store),
    ).rejects.toThrow("Audit unavailable");
    expect((await getAdminSupportMessage(contactDocumentId(input.requestKey), store))?.status).toBe(
      "new",
    );
  });
});

function post(
  path: string,
  body: unknown,
  origin: string | null = "http://127.0.0.1:3000",
  method = "POST",
) {
  return new Request(`http://127.0.0.1:3000${path}`, {
    method,
    headers: { "content-type": "application/json", ...(origin ? { origin } : {}) },
    body: JSON.stringify(body),
  });
}

describe("support API origin and durable request limits", () => {
  it("rejects missing/foreign origins before persisting private records", async () => {
    expect((await contactPost(post("/api/contact", contact(), null))).status).toBe(403);
    expect(
      (await newsletterPost(post("/api/newsletter", signup(), "https://other.example.test")))
        .status,
    ).toBe(403);
    expect(await store.list("contactMessages")).toHaveLength(0);
    expect(await store.list("newsletterSubscribers")).toHaveLength(0);
  });

  it("handles a lost response retry with the same receipt and a single saved record", async () => {
    const input = contact();
    const first = await contactPost(post("/api/contact", input));
    const retry = await contactPost(post("/api/contact", input));
    expect(await first.json()).toEqual({ saved: true });
    expect(await retry.json()).toEqual({ saved: true });
    expect(await store.list("contactMessages")).toHaveLength(1);
    expect(retry.headers.get("cache-control")).toBe("no-store");
  });

  it("enforces the persisted per-email contact limit across separate requests and resets after the window", async () => {
    for (let index = 0; index < 5; index += 1)
      expect((await contactPost(post("/api/contact", contact()))).status).toBe(200);
    expect(
      (await contactPost(post("/api/contact", { ...contact(), email: "SUPPORT@EXAMPLE.TEST" })))
        .status,
    ).toBe(429);
    expect(await store.list("contactMessages")).toHaveLength(5);
    expect(await store.list("rateLimits")).toHaveLength(2);
    vi.setSystemTime(now + 15 * 60_000 + 1);
    expect((await contactPost(post("/api/contact", contact()))).status).toBe(200);
  });

  it("enforces the global contact limit even when callers change email addresses", async () => {
    for (let index = 0; index < 60; index += 1) {
      const input = { ...contact(), email: `customer-${index}@example.test` };
      expect((await contactPost(post("/api/contact", input))).status).toBe(200);
    }
    expect(
      (await contactPost(post("/api/contact", { ...contact(), email: "fresh@example.test" })))
        .status,
    ).toBe(429);
    expect(await store.list("contactMessages")).toHaveLength(60);
  });

  it("requires consent/capabilities and limits newsletter preferences without disclosing membership", async () => {
    expect(
      (await newsletterPost(post("/api/newsletter", { ...signup(), consent: false }))).status,
    ).toBe(400);
    expect(
      (await newsletterPost(post("/api/newsletter", { action: "unsubscribe", email }))).status,
    ).toBe(400);
    for (let index = 0; index < 10; index += 1) {
      const response = await newsletterPost(
        post("/api/newsletter", index % 2 ? { ...signup(), preferenceKey: otherKey } : signup()),
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ accepted: true });
    }
    expect((await newsletterPost(post("/api/newsletter", unsubscribe()))).status).toBe(429);
    expect(await store.list("newsletterSubscribers")).toHaveLength(1);
  });

  it("guards admin inbox reads and audited status writes", async () => {
    const input = contact();
    await saveContactMessage(input, store);
    vi.mocked(requireAdmin).mockRejectedValueOnce(
      new AppError(403, "Administrator access is required."),
    );
    expect((await inboxGet(new Request("http://127.0.0.1:3000/api/admin/support"))).status).toBe(
      403,
    );
    const body = { id: contactDocumentId(input.requestKey), status: "reviewing" };
    expect((await statusPatch(post("/api/admin/support", body, null, "PATCH"))).status).toBe(403);
    const response = await statusPatch(
      post("/api/admin/support", body, "http://127.0.0.1:3000", "PATCH"),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).message.status).toBe("reviewing");
    expect(await store.list("auditLogs")).toHaveLength(1);
  });
});
