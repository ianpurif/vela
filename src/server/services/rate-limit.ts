import "server-only";
import { createHash } from "node:crypto";
import { firestoreStore as store } from "@/server/repositories/firestore-store";
import { AppError } from "@/lib/errors";

/** Durable fixed-window limiter; it remains effective across serverless instances. */
export async function rateLimit(key: string, max: number, windowMs: number) {
  const id = createHash("sha256").update(key).digest("hex");
  const now = Date.now();
  await store.transaction(async (tx) => {
    const row = await tx.get<{ count: number; expiresAt: number }>("rateLimits", id);
    if (row && row.expiresAt > now && row.count >= max)
      throw new AppError(429, "Please wait a little before trying again.", "RATE_LIMITED");
    tx.set("rateLimits", id, {
      count: row && row.expiresAt > now ? row.count + 1 : 1,
      expiresAt: row && row.expiresAt > now ? row.expiresAt : now + windowMs,
    });
  });
}
