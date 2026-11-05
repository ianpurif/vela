import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  cookieSet: vi.fn(),
  cookieDelete: vi.fn(),
  verifyIdToken: vi.fn(),
  createSessionCookie: vi.fn(),
  verifySessionCookie: vi.fn(),
  revokeRefreshTokens: vi.fn(),
  profile: vi.fn(),
  rateLimit: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mocks.cookieGet, set: mocks.cookieSet, delete: mocks.cookieDelete }),
}));
vi.mock("@/lib/firebase/admin", () => ({ getAdminAuth: () => mocks }));
vi.mock("@/server/services/accounts", () => ({ getProfile: mocks.profile }));
vi.mock("@/server/services/rate-limit", () => ({ rateLimit: mocks.rateLimit }));

import { POST, DELETE } from "@/app/api/auth/session/route";
import { getSession, requireAdmin, SESSION_COOKIE, SESSION_DURATION } from "@/server/auth";

const now = Date.UTC(2026, 10, 6, 12);
const token = "test-id-token-".repeat(4);
const identity = {
  uid: "customer",
  name: "Test Customer",
  email: "customer@example.test",
  email_verified: false,
  admin: false,
  auth_time: now / 1000,
};
function request(origin = "https://vela.example", body: unknown = { idToken: token }) {
  return new Request(`${origin}/api/auth/session`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://vela.example");
  vi.stubEnv("VERCEL", "");
  mocks.verifyIdToken.mockResolvedValue(identity);
  mocks.createSessionCookie.mockResolvedValue("server-issued-session");
  mocks.verifySessionCookie.mockResolvedValue(identity);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("session boundary", () => {
  it("sets a secure httpOnly cookie only after verified recent identity and profile creation", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.verifyIdToken).toHaveBeenCalledWith(token, true);
    expect(mocks.createSessionCookie).toHaveBeenCalledWith(token, { expiresIn: SESSION_DURATION });
    expect(mocks.profile).toHaveBeenCalledWith(
      expect.objectContaining({ uid: "customer", admin: false }),
    );
    expect(mocks.cookieSet).toHaveBeenCalledWith(SESSION_COOKIE, "server-issued-session", {
      maxAge: SESSION_DURATION / 1000,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
  });

  it("allows a non-secure session cookie only for explicit local HTTP", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://127.0.0.1:3000");
    expect((await POST(request("http://127.0.0.1:3000"))).status).toBe(200);
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      SESSION_COOKIE,
      "server-issued-session",
      expect.objectContaining({ secure: false, httpOnly: true }),
    );
  });

  it("rejects non-HTTPS external configuration before authentication or cookie creation", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://vela.example");
    expect((await POST(request("http://vela.example"))).status).toBe(503);
    expect(mocks.verifyIdToken).not.toHaveBeenCalled();
    expect(mocks.createSessionCookie).not.toHaveBeenCalled();
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it.each(["https://evil.example", "null", ""])(
    'rejects the foreign or missing Origin "%s"',
    async (origin) => {
      const candidate = request();
      if (origin) candidate.headers.set("Origin", origin);
      else candidate.headers.delete("Origin");
      expect((await POST(candidate)).status).toBe(403);
      expect(mocks.verifyIdToken).not.toHaveBeenCalled();
      expect(mocks.cookieSet).not.toHaveBeenCalled();
    },
  );

  it("rejects injected roles before asking Firebase to verify the token", async () => {
    expect((await POST(request(undefined, { idToken: token, admin: true }))).status).toBe(400);
    expect(mocks.verifyIdToken).not.toHaveBeenCalled();
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it("rejects invalid and old authentication without writing a cookie", async () => {
    mocks.verifyIdToken.mockRejectedValueOnce(new Error("invalid token"));
    expect((await POST(request())).status).toBe(401);
    mocks.verifyIdToken.mockResolvedValueOnce({ ...identity, auth_time: now / 1000 - 301 });
    expect((await POST(request())).status).toBe(401);
    expect(mocks.createSessionCookie).not.toHaveBeenCalled();
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it("checks revocation before trusting a session or an administrator claim", async () => {
    mocks.cookieGet.mockReturnValue({ value: "existing-session" });
    mocks.verifySessionCookie.mockRejectedValueOnce(new Error("revoked session"));
    expect(await getSession()).toBeNull();
    expect(mocks.verifySessionCookie).toHaveBeenCalledWith("existing-session", true);
    mocks.verifySessionCookie.mockResolvedValueOnce({ ...identity, admin: "true" });
    await expect(requireAdmin()).rejects.toMatchObject({ status: 403 });
    mocks.verifySessionCookie.mockResolvedValueOnce({ ...identity, admin: true });
    expect(await requireAdmin()).toMatchObject({ uid: "customer", admin: true });
  });

  it("revokes the verified session owner before clearing the cookie on logout", async () => {
    mocks.cookieGet.mockReturnValue({ value: "existing-session" });
    const response = await DELETE(
      new Request("https://vela.example/api/auth/session", {
        method: "DELETE",
        headers: { Origin: "https://vela.example" },
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.revokeRefreshTokens).toHaveBeenCalledWith("customer");
    expect(mocks.cookieDelete).toHaveBeenCalledWith(SESSION_COOKIE);
  });
});
