import { afterEach, describe, expect, it, vi } from "vitest";
import { getCatalogRepository } from "@/server/repositories/catalog";
import { getAdminAuth } from "@/lib/firebase/admin";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { readBody, assertSameOrigin } from "@/server/http";
afterEach(() => vi.unstubAllEnvs());
describe("explicit service configuration", () => {
  it("serves fixtures only with an explicit demo mode", async () => {
    vi.stubEnv("VELA_DATA_MODE", "demo");
    expect(await getCatalogRepository().list()).toHaveLength(6);
    vi.stubEnv("VELA_DATA_MODE", "");
    expect(() => getCatalogRepository()).toThrow(/not configured/);
  });
  it("does not create real auth sessions in demo mode", () => {
    vi.stubEnv("VELA_DATA_MODE", "demo");
    expect(() => getAdminAuth()).toThrow(/unavailable/);
  });
  it("rejects emulator credentials in a deployed environment", () => {
    vi.stubEnv("VELA_DATA_MODE", "firebase");
    vi.stubEnv("FIREBASE_PROJECT_ID", "demo-vela");
    vi.stubEnv("NEXT_PUBLIC_USE_FIREBASE_EMULATORS", "true");
    vi.stubEnv("VERCEL", "1");
    expect(() => getAdminAuth()).toThrow(/loopback/);
  });
  it("does not reuse a privileged app after switching to read-only demo mode", async () => {
    const app = initializeApp({ projectId: "demo-vela" }, "vela-admin");
    try { vi.stubEnv("VELA_DATA_MODE", "demo"); expect(() => getAdminAuth()).toThrow(/unavailable/); }
    finally { await deleteApp(app); }
  });
  it("stops reading an oversized stream without a content-length header", async () => {
    let cancelled = false;
    const stream = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(40000)); }, cancel() { cancelled = true; } });
    const request = new Request("http://localhost", { method: "POST", body: stream, duplex: "half" } as RequestInit);
    await expect(readBody(request)).rejects.toMatchObject({ status: 413 });
    expect(cancelled).toBe(true);
  });
  it("rejects missing and foreign origins", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://vela.example");
    expect(() => assertSameOrigin(new Request("https://vela.example"))).toThrow(/VELA website/);
    expect(() => assertSameOrigin(new Request("https://vela.example", { headers: { Origin: "https://evil.example" } }))).toThrow(/VELA website/);
  });
  it("returns no product for an invalid document slug", async () => {
    vi.stubEnv("VELA_DATA_MODE", "firebase");
    expect(await getCatalogRepository().getBySlug("invalid/slug")).toBeNull();
  });
});
