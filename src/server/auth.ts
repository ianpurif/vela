import "server-only";
import { cookies } from "next/headers";
import { getAdminAuth } from "@/lib/firebase/admin";
import { AppError } from "@/lib/errors";
import type { DecodedIdToken } from "firebase-admin/auth";

export type SessionUser = {
  uid: string;
  email: string;
  name: string;
  admin: boolean;
  emailVerified: boolean;
};
export const SESSION_COOKIE = "vela_session";
export const SESSION_DURATION = 5 * 24 * 60 * 60 * 1000;
export function toSessionUser(token: DecodedIdToken): SessionUser {
  return {
    uid: token.uid,
    email: token.email || "",
    name: typeof token.name === "string" ? token.name : "",
    admin: token.admin === true,
    emailVerified: token.email_verified === true,
  };
}
export async function getSession(): Promise<SessionUser | null> {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  try {
    return toSessionUser(await getAdminAuth().verifySessionCookie(cookie, true));
  } catch (error) {
    if (error instanceof AppError) throw error;
    return null;
  }
}
export async function requireUser() {
  const user = await getSession();
  if (!user) throw new AppError(401, "Please sign in to continue.", "AUTH_REQUIRED");
  return user;
}
export async function requireAdmin() {
  const user = await requireUser();
  if (!user.admin) throw new AppError(403, "Administrator access is required.", "FORBIDDEN");
  return user;
}
