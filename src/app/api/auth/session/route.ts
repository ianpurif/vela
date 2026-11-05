import { cookies } from "next/headers";
import { z } from "zod";
import { getAdminAuth } from "@/lib/firebase/admin";
import { api, assertSameOrigin, readJson } from "@/server/http";
import { getSession, SESSION_COOKIE, SESSION_DURATION, toSessionUser } from "@/server/auth";
import { AppError } from "@/lib/errors";
import { getProfile } from "@/server/services/accounts";
import { rateLimit } from "@/server/services/rate-limit";
import { getApplicationUrl } from "@/server/application-url";

export const POST = api(async (request) => {
  assertSameOrigin(request);
  const { idToken } = await readJson(
    request,
    z.object({ idToken: z.string().min(30).max(10000) }).strict(),
  );
  const auth = getAdminAuth();
  let decoded;
  try {
    decoded = await auth.verifyIdToken(idToken, true);
  } catch {
    throw new AppError(401, "Your sign-in has expired. Please sign in again.");
  }
  if (Date.now() / 1000 - decoded.auth_time > 300)
    throw new AppError(401, "Please sign in again to start a secure session.");
  await rateLimit(`session:${decoded.uid}`, 15, 60000);
  const user = toSessionUser(decoded);
  const session = await auth.createSessionCookie(idToken, { expiresIn: SESSION_DURATION });
  await getProfile(user);
  (await cookies()).set(SESSION_COOKIE, session, {
    maxAge: SESSION_DURATION / 1000,
    httpOnly: true,
    secure: getApplicationUrl().protocol === "https:",
    sameSite: "lax",
    path: "/",
  });
  return Response.json({ user }, { headers: { "Cache-Control": "no-store" } });
});
export const DELETE = api(async (request) => {
  assertSameOrigin(request);
  const user = await getSession();
  if (user) await getAdminAuth().revokeRefreshTokens(user.uid);
  (await cookies()).delete(SESSION_COOKIE);
  return Response.json({ ok: true });
});
