import { test, expect, request as playwrightRequest } from "@playwright/test";

test.describe("Firebase emulator session and ownership", () => {
  test.skip(
    process.env.VELA_E2E_EMULATOR !== "1",
    "Requires explicitly enabled local Firebase emulators.",
  );
  test("rejects forged sessions, cross-origin writes, and role self-assignment", async ({
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "Server security is independent of viewport.");
    const base = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
    const headers = { Origin: base };
    expect((await request.get("/api/account")).status()).toBe(401);
    expect(
      (
        await request.post("/api/auth/session", {
          headers: { Origin: "https://untrusted.example" },
          data: { idToken: "invalid".repeat(10) },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await request.post("/api/auth/session", {
          headers,
          data: { idToken: "invalid".repeat(10) },
        })
      ).status(),
    ).toBe(401);
    const email = `isolation-${Date.now()}@example.test`;
    const signup = await request.post(
      "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-vela-emulator-key",
      { data: { email, password: "LocalTest!2026", returnSecureToken: true } },
    );
    expect(signup.ok()).toBeTruthy();
    const { idToken, localId } = await signup.json();
    const session = await request.post("/api/auth/session", { headers, data: { idToken } });
    expect(session.status()).toBe(200);
    expect(session.headers()["set-cookie"]).toMatch(/HttpOnly/i);
    expect(session.headers()["set-cookie"]).toMatch(/SameSite=lax/i);
    const account = await request.get("/api/account");
    expect((await account.json()).profile.id).toBe(localId);
    expect(
      (
        await request.patch("/api/account", {
          headers,
          data: { name: "New name", addresses: [], admin: true },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await request.patch("/api/account", {
          headers,
          data: { name: "My own profile", addresses: [] },
        })
      ).status(),
    ).toBe(200);
    const other = await playwrightRequest.newContext({ baseURL: base });
    expect((await other.get(`/api/account?uid=${localId}`)).status()).toBe(401);
    await other.dispose();
    expect((await request.delete("/api/auth/session", { headers })).status()).toBe(200);
    expect((await request.get("/api/account")).status()).toBe(401);
  });
});
