import "server-only";
import { timingSafeEqual } from "node:crypto";
import { AppError } from "@/lib/errors";

export function requireCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32)
    throw new AppError(503, "Reservation recovery is not configured.");
  const supplied = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
    throw new AppError(401, "Unauthorized recovery request.");
}
