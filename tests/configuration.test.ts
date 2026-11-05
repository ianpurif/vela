import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCatalogRepository } from "@/server/repositories/catalog";
import { getAdminAuth } from "@/lib/firebase/admin";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { readBody, assertSameOrigin, api } from "@/server/http";
import { getApplicationUrl } from "@/server/application-url";
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
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
    try {
      vi.stubEnv("VELA_DATA_MODE", "demo");
      expect(() => getAdminAuth()).toThrow(/unavailable/);
    } finally {
      await deleteApp(app);
    }
  });
  it("rechecks emulator restrictions before reusing a privileged app", async () => {
    const app = initializeApp({ projectId: "demo-vela" }, "vela-admin");
    try {
      vi.stubEnv("VELA_DATA_MODE", "firebase");
      vi.stubEnv("FIREBASE_PROJECT_ID", "demo-vela");
      vi.stubEnv("NEXT_PUBLIC_USE_FIREBASE_EMULATORS", "true");
      vi.stubEnv("FIRESTORE_EMULATOR_HOST", "remote.example:8080");
      vi.stubEnv("FIREBASE_AUTH_EMULATOR_HOST", "127.0.0.1:9099");
      vi.stubEnv("VERCEL", "");
      expect(() => getAdminAuth()).toThrow(/loopback/);
      vi.stubEnv("FIRESTORE_EMULATOR_HOST", "127.0.0.1:8080");
      vi.stubEnv("VERCEL", "1");
      expect(() => getAdminAuth()).toThrow(/loopback/);
      vi.stubEnv("VERCEL", "");
      vi.stubEnv("FIREBASE_PROJECT_ID", "demo-other");
      expect(() => getAdminAuth()).toThrow(/Restart the server/);
    } finally {
      await deleteApp(app);
    }
  });
  it("stops reading an oversized stream without a content-length header", async () => {
    let cancelled = false;
    const stream = new ReadableStream({
      pull(controller) {
        controller.enqueue(new Uint8Array(40000));
      },
      cancel() {
        cancelled = true;
      },
    });
    const request = new Request("http://localhost", {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit);
    await expect(readBody(request)).rejects.toMatchObject({ status: 413 });
    expect(cancelled).toBe(true);
  });
  it("rejects missing and foreign origins", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://vela.example");
    expect(() => assertSameOrigin(new Request("https://vela.example"))).toThrow(/VELA website/);
    expect(() =>
      assertSameOrigin(
        new Request("https://vela.example", { headers: { Origin: "https://evil.example" } }),
      ),
    ).toThrow(/VELA website/);
  });
  it("returns no product for an invalid document slug", async () => {
    vi.stubEnv("VELA_DATA_MODE", "firebase");
    expect(await getCatalogRepository().getBySlug("invalid/slug")).toBeNull();
  });
});

describe("application origin configuration", () => {
  beforeEach(() => vi.stubEnv("VERCEL", ""));

  it.each(["http://localhost:3000", "https://127.0.0.1", "http://[::1]:3000"])(
    "rejects a hosted deployment using loopback origin %s",
    (configured) => {
      vi.stubEnv("NEXT_PUBLIC_APP_URL", configured);
      vi.stubEnv("VERCEL", "1");
      expect(() => getApplicationUrl()).toThrow();
    },
  );

  it.each([
    ["https://vela.example", "https://vela.example"],
    ["https://VELA.example:443/", "https://vela.example"],
    ["https://vela.example:8443/", "https://vela.example:8443"],
    ["http://127.0.0.1:3000", "http://127.0.0.1:3000"],
    ["http://localhost:3000/", "http://localhost:3000"],
    ["http://[::1]:3000/", "http://[::1]:3000"],
  ])("accepts the explicit safe origin %s", (configured, origin) => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", configured);
    expect(getApplicationUrl().origin).toBe(origin);
    expect(() =>
      assertSameOrigin(new Request(origin, { headers: { Origin: origin } })),
    ).not.toThrow();
  });

  it.each([
    "",
    "not a URL",
    "https:vela.example",
    "//vela.example",
    "ftp://vela.example",
    "http://vela.example",
    "http://localhost.evil.example",
    "http://192.168.1.20",
    "https://user:password@vela.example",
    "https://@vela.example",
    "https://vela.example/path",
    "https://vela.example/path/..",
    "https://vela.example//",
    "https://vela.example?next=/",
    "https://vela.example?",
    "https://vela.example#",
    "https://vela.example#fragment",
    " https://vela.example",
    "https://vela.example ",
    "https://vela.example\\path",
    "https://vela.example:99999",
  ])("fails closed on unsafe or ambiguous configuration %s", async (configured) => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", configured);
    expect(() => getApplicationUrl()).toThrow();
    const endpoint = api(async (request) => {
      assertSameOrigin(request);
      return Response.json({ accepted: true });
    });
    const response = await endpoint(
      new Request("https://vela.example", { headers: { Origin: "https://vela.example" } }),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "CONFIGURATION_REQUIRED" });
  });
});

describe("bounded UTF-8 request bodies", () => {
  function streamed(chunks: Uint8Array[], cancel?: () => void) {
    return new Request("http://localhost", {
      method: "POST",
      body: new ReadableStream({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(chunk);
          if (!cancel) controller.close();
        },
        cancel,
      }),
      duplex: "half",
    } as RequestInit);
  }

  it.each([{ bytes: [0xc3, 0x28] }, { bytes: [0xf0, 0x9f] }, { bytes: [0xed, 0xa0, 0x80] }])(
    "returns 400 for invalid or truncated UTF-8 $bytes",
    async ({ bytes }) => {
      const endpoint = api(async (request) => Response.json({ body: await readBody(request) }));
      const response = await endpoint(streamed([new Uint8Array(bytes)]));
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "INVALID_BODY_ENCODING" });
    },
  );

  it("cancels an invalid open stream and preserves the 400 status when cancellation fails", async () => {
    const cancel = vi.fn(() => {
      throw new Error("Synthetic cancellation failure");
    });
    await expect(readBody(streamed([new Uint8Array([0xff])], cancel))).rejects.toMatchObject({
      status: 400,
    });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("preserves valid characters split across stream chunks", async () => {
    const input = '{"message":"A little café 🌿"}';
    const bytes = new TextEncoder().encode(input);
    const chunks = Array.from(bytes, (byte) => new Uint8Array([byte]));
    expect(await readBody(streamed(chunks))).toBe(input);
  });
});
