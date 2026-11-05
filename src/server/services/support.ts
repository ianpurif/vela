import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { requireAdmin } from "@/server/auth";
import { firestoreStore } from "@/server/repositories/firestore-store";
import type { CommerceStore } from "@/server/repositories/store";
import { audit } from "./admin";
import { AppError } from "@/lib/errors";
import {
  contactIdSchema,
  contactInputSchema,
  newsletterInputSchema,
  supportEmailSchema,
  supportStatusInputSchema,
} from "@/lib/validation/support";
import type {
  AdminSupportList,
  ContactMessage,
  ContactResult,
  NewsletterResult,
  NewsletterSubscriber,
} from "@/types/support";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export const contactDocumentId = (requestKey: string) => `c_${digest(requestKey)}`;
export const newsletterDocumentId = (email: string) =>
  `n_${digest(supportEmailSchema.parse(email))}`;
type StoredContact = ContactMessage & { payloadHash: string };

export async function saveContactMessage(
  input: unknown,
  store: CommerceStore = firestoreStore,
): Promise<ContactResult> {
  const { requestKey, ...data } = contactInputSchema.parse(input);
  const id = contactDocumentId(requestKey);
  const payloadHash = digest(JSON.stringify(data));
  await store.transaction(async (tx) => {
    const previous = await tx.get<StoredContact>("contactMessages", id);
    if (previous) {
      if (previous.payloadHash !== payloadHash)
        throw new AppError(
          409,
          "This message reference has already been used. Start a new message to change its contents.",
          "CONTACT_RETRY_MISMATCH",
        );
      return;
    }
    const now = Date.now();
    const message: StoredContact = {
      ...data,
      id,
      status: "new",
      payloadHash,
      createdAt: now,
      updatedAt: now,
    };
    tx.set("contactMessages", id, message);
  });
  return { saved: true };
}

export async function saveNewsletterPreference(
  input: unknown,
  store: CommerceStore = firestoreStore,
): Promise<NewsletterResult> {
  const data = newsletterInputSchema.parse(input);
  const id = newsletterDocumentId(data.email);
  const preferenceKeyHash = digest(data.preferenceKey);
  await store.transaction(async (tx) => {
    const previous = await tx.get<NewsletterSubscriber>("newsletterSubscribers", id);
    if (previous) {
      const expected = Buffer.from(previous.preferenceKeyHash, "hex");
      const supplied = Buffer.from(preferenceKeyHash, "hex");
      if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return;
      const status = data.action === "subscribe" ? "pending" : "unsubscribed";
      if (previous.status === status) return;
      const now = Date.now();
      tx.set("newsletterSubscribers", id, {
        ...previous,
        status,
        updatedAt: now,
        consentedAt: data.action === "subscribe" ? now : previous.consentedAt,
        unsubscribedAt: data.action === "unsubscribe" ? now : null,
      });
      return;
    }
    if (data.action === "unsubscribe") return;
    const now = Date.now();
    const subscriber: NewsletterSubscriber = {
      id,
      email: data.email,
      status: "pending",
      preferenceKeyHash,
      consentVersion: "vela-newsletter-v1",
      consentedAt: now,
      unsubscribedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    tx.set("newsletterSubscribers", id, subscriber);
  });
  return { accepted: true };
}

function publicMessage(record: StoredContact): ContactMessage {
  const { id, name, email, subject, message, status, createdAt, updatedAt } = record;
  return { id, name, email, subject, message, status, createdAt, updatedAt };
}

export async function getAdminSupportInbox(
  after?: string,
  store: CommerceStore = firestoreStore,
): Promise<AdminSupportList> {
  await requireAdmin();
  const cursor = after
    ? await store.get<StoredContact>("contactMessages", contactIdSchema.parse(after))
    : null;
  if (after && !cursor)
    throw new AppError(
      400,
      "This message cursor is no longer available. Restart the inbox.",
      "SUPPORT_CURSOR_INVALID",
    );
  const rows = await store.list<StoredContact>("contactMessages", [], {
    orderBy: "createdAt",
    direction: "desc",
    limit: 101,
    ...(cursor ? { startAfter: { value: cursor.createdAt, id: cursor.id } } : {}),
  });
  const messages = rows.slice(0, 100).map(publicMessage);
  return {
    messages,
    limit: 100,
    truncated: rows.length > 100,
    next: rows.length > 100 ? messages.at(-1)!.id : null,
  };
}

export async function getAdminSupportMessage(
  id: string,
  store: CommerceStore = firestoreStore,
): Promise<ContactMessage | null> {
  await requireAdmin();
  const row = await store.get<StoredContact>("contactMessages", contactIdSchema.parse(id));
  return row ? publicMessage(row) : null;
}

export async function updateSupportStatus(
  input: unknown,
  store: CommerceStore = firestoreStore,
): Promise<ContactMessage> {
  const actor = await requireAdmin();
  const data = supportStatusInputSchema.parse(input);
  return store.transaction(async (tx) => {
    const message = await tx.get<StoredContact>("contactMessages", data.id);
    if (!message) throw new AppError(404, "Message not found.", "SUPPORT_NOT_FOUND");
    if (message.status === data.status) return publicMessage(message);
    const updated = { ...message, status: data.status, updatedAt: Date.now() };
    const log = audit(actor.uid, "support.status.updated", data.id, {
      from: message.status,
      to: data.status,
    });
    tx.set("contactMessages", data.id, updated);
    tx.set("auditLogs", log.id, log);
    return publicMessage(updated);
  });
}
