import { afterEach, describe, expect, it, vi } from "vitest";
import { v2 as cloudinary } from "cloudinary";
import { MemoryStore } from "./helpers/memory-store";
import { demoProducts } from "@/features/catalog/fixtures";
import { AppError } from "@/lib/errors";
import { getCloudinaryProvider, type MediaProvider } from "@/lib/cloudinary/provider";
import {
  cloudinaryDeliveryUrl,
  MAX_IMAGE_BYTES,
  mediaDocumentId,
  validateCloudinaryResource,
} from "@/lib/cloudinary/shared";
import {
  completeMediaUpload,
  deleteMediaAsset,
  signMediaUpload,
  updateMediaGallery,
  type MediaUploadTicket,
  type TrackedMediaAsset,
} from "@/server/services/media";
import type { Product, ProductImage } from "@/types/commerce";
import { requireAdmin } from "@/server/auth";
import { POST as signRoute } from "@/app/api/admin/media/sign/route";
import { POST as completeRoute } from "@/app/api/admin/media/complete/route";
import { PATCH as galleryRoute } from "@/app/api/admin/media/gallery/route";
import { DELETE as deleteRoute } from "@/app/api/admin/media/route";

vi.mock("@/server/auth", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/server/services/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue(undefined),
}));

const productId = demoProducts[0].id;
const cloudName = "vela-media-test";
const actorId = "media-admin";

function resource(publicId: string) {
  return {
    public_id: publicId,
    asset_id: `asset-${publicId.split("/").at(-1)}`,
    resource_type: "image",
    type: "upload",
    format: "webp",
    version: 1,
    width: 1200,
    height: 1200,
    bytes: 120000,
    secure_url: `https://res.cloudinary.com/${cloudName}/image/upload/v1/${publicId}.webp`,
  };
}

function fakeProvider() {
  return {
    cloudName,
    sign: vi.fn((publicId: string, timestamp: number) => ({
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      fields: {
        api_key: "local-fixture-key",
        timestamp,
        public_id: publicId,
        signature: "test-signature",
        overwrite: "false" as const,
        allowed_formats: "jpg,png,webp,avif",
      },
    })),
    resource: vi.fn(async (publicId: string): Promise<unknown> => resource(publicId)),
    destroy: vi.fn<(publicId: string) => Promise<void>>().mockResolvedValue(undefined),
  } satisfies MediaProvider;
}

function seeded() {
  return new MemoryStore({ products: { [productId]: structuredClone(demoProducts[0]) } });
}

function assetFor(publicId: string, refs: string[] = []): TrackedMediaAsset {
  const metadata = validateCloudinaryResource(resource(publicId), publicId, cloudName);
  return {
    id: mediaDocumentId(publicId),
    publicId,
    assetId: metadata.assetId,
    src: metadata.src,
    width: metadata.width,
    height: metadata.height,
    bytes: metadata.bytes,
    refs,
    state: "ready",
    createdAt: Date.now(),
  };
}

function imageFor(publicId: string): ProductImage {
  const { src, width, height, assetId } = assetFor(publicId);
  return { publicId, src, width, height, assetId, alt: "A skincare bottle" };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("media signatures and trusted metadata", () => {
  it("fails safely without Cloudinary credentials", () => {
    vi.stubEnv("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME", "");
    vi.stubEnv("CLOUDINARY_API_KEY", "");
    vi.stubEnv("CLOUDINARY_API_SECRET", "");
    expect(() => getCloudinaryProvider()).toThrowError(expect.objectContaining({ status: 503 }));
  });

  it("signs restricted parameters with the real SDK without exposing the secret", () => {
    vi.stubEnv("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME", cloudName);
    vi.stubEnv("CLOUDINARY_API_KEY", "local-fixture-key");
    vi.stubEnv("CLOUDINARY_API_SECRET", "local-fixture-secret");
    const signed = getCloudinaryProvider().sign("vela/products/test-bottle", 1793900000);
    expect(signed.uploadUrl).toBe(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`);
    expect(signed.fields.overwrite).toBe("false");
    expect(signed.fields.allowed_formats).toBe("jpg,png,webp,avif");
    expect(Object.keys(signed.fields).sort()).toEqual([
      "allowed_formats",
      "api_key",
      "overwrite",
      "public_id",
      "signature",
      "timestamp",
    ]);
    const { signature, api_key: apiKey, ...parameters } = signed.fields;
    expect(apiKey).toBe("local-fixture-key");
    expect(signature).toBe(cloudinary.utils.api_sign_request(parameters, "local-fixture-secret"));
    expect(signature).not.toBe(
      cloudinary.utils.api_sign_request(
        { ...parameters, overwrite: "true" },
        "local-fixture-secret",
      ),
    );
    expect(JSON.stringify(signed)).not.toContain("local-fixture-secret");
  });

  it.each([
    { bytes: MAX_IMAGE_BYTES + 1 },
    { width: 8001 },
    { height: 0 },
    { format: "svg" },
    { resource_type: "video" },
    { type: "authenticated" },
    { public_id: "vela/products/another-file" },
    { secure_url: "https://untrusted.example/image.webp" },
    {
      secure_url: "https://res.cloudinary.com/other-store/image/upload/v1/vela/products/test.webp",
    },
  ])("rejects unsafe provider metadata %j", (change) => {
    const id = "vela/products/test";
    expect(() => validateCloudinaryResource({ ...resource(id), ...change }, id, cloudName)).toThrow(
      AppError,
    );
  });

  it("uses deterministic slash-free document IDs and bounded delivery transformations", () => {
    const id = "vela/products/import-1234";
    expect(mediaDocumentId(id)).toMatch(/^[a-f0-9]{64}$/);
    expect(mediaDocumentId(id)).toBe(mediaDocumentId(id));
    expect(mediaDocumentId("vela/products/other")).not.toBe(mediaDocumentId(id));
    expect(() => mediaDocumentId("another-folder/asset")).toThrow();
    expect(cloudinaryDeliveryUrl(resource(id).secure_url, 9999)).toContain(
      "f_auto,q_auto,c_limit,w_2400/",
    );
    expect(cloudinaryDeliveryUrl("/images/first-light-serum.webp", 800)).toBe(
      "/images/first-light-serum.webp",
    );
    expect(cloudinaryDeliveryUrl("https://untrusted.example/image.webp", 800)).toBe(
      "https://untrusted.example/image.webp",
    );
  });
});

describe("single-use media upload attachment", () => {
  it("issues owner-bound tickets only for existing products and fixed server IDs", async () => {
    const store = seeded();
    const provider = fakeProvider();
    await expect(
      signMediaUpload({ productId: "missing" }, actorId, store, provider),
    ).rejects.toMatchObject({ status: 404 });
    expect(provider.sign).not.toHaveBeenCalled();
    await expect(
      signMediaUpload({ productId, public_id: "other-store/file" }, actorId, store, provider),
    ).rejects.toThrow();
    const signed = await signMediaUpload({ productId }, actorId, store, provider);
    expect(signed.fields.public_id).toMatch(/^vela\/products\/[0-9a-f-]{36}$/);
    const ticket = await store.get<MediaUploadTicket>("mediaUploads", signed.ticketId);
    expect(ticket).toMatchObject({ userId: actorId, productId, completedAt: null });
    expect(ticket!.expiresAt - ticket!.createdAt).toBe(15 * 60 * 1000);
  });

  it("rejects another administrator and expired tickets before reading Cloudinary", async () => {
    const store = seeded();
    const provider = fakeProvider();
    const signed = await signMediaUpload({ productId }, actorId, store, provider);
    const input = { ticketId: signed.ticketId, alt: "Test image" };
    await expect(
      completeMediaUpload(input, "another-admin", store, provider),
    ).rejects.toMatchObject({ status: 404 });
    const ticket = (await store.get<MediaUploadTicket>("mediaUploads", signed.ticketId))!;
    await store.set("mediaUploads", ticket.id, { ...ticket, expiresAt: Date.now() - 1 });
    await expect(completeMediaUpload(input, actorId, store, provider)).rejects.toMatchObject({
      status: 410,
    });
    expect(provider.resource).not.toHaveBeenCalled();
    expect(await store.list("auditLogs")).toHaveLength(0);
  });

  it("never accepts image metadata or sources supplied by the browser", async () => {
    const store = seeded();
    const provider = fakeProvider();
    const signed = await signMediaUpload({ productId }, actorId, store, provider);
    await expect(
      completeMediaUpload(
        { ticketId: signed.ticketId, alt: "Image", src: "https://untrusted.example/x", width: 10 },
        actorId,
        store,
        provider,
      ),
    ).rejects.toThrow();
    expect(provider.resource).not.toHaveBeenCalled();
    const product = await completeMediaUpload(
      { ticketId: signed.ticketId, alt: "Image" },
      actorId,
      store,
      provider,
    );
    expect(product.images.at(-1)).toMatchObject({
      src: resource(signed.fields.public_id).secure_url,
      width: 1200,
      height: 1200,
      publicId: signed.fields.public_id,
    });
  });

  it("keeps rejected metadata unattached and the ticket retryable", async () => {
    const store = seeded();
    const provider = fakeProvider();
    const signed = await signMediaUpload({ productId }, actorId, store, provider);
    provider.resource.mockResolvedValueOnce({
      ...resource(signed.fields.public_id),
      bytes: MAX_IMAGE_BYTES + 1,
    });
    await expect(
      completeMediaUpload(
        { ticketId: signed.ticketId, alt: "Large image" },
        actorId,
        store,
        provider,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(
      (await store.get<MediaUploadTicket>("mediaUploads", signed.ticketId))?.completedAt,
    ).toBeNull();
    expect((await store.get<Product>("products", productId))?.images).toEqual(
      demoProducts[0].images,
    );
    expect(await store.list("media")).toHaveLength(0);
  });

  it("attaches once across concurrent retries and rejects changed completion details", async () => {
    const store = seeded();
    const provider = fakeProvider();
    const signed = await signMediaUpload({ productId }, actorId, store, provider);
    const input = { ticketId: signed.ticketId, alt: "Test image" };
    await Promise.all([
      completeMediaUpload(input, actorId, store, provider),
      completeMediaUpload(input, actorId, store, provider),
    ]);
    const product = (await store.get<Product>("products", productId))!;
    expect(
      product.images.filter((image) => image.publicId === signed.fields.public_id),
    ).toHaveLength(1);
    expect(
      (await store.get<TrackedMediaAsset>("media", mediaDocumentId(signed.fields.public_id)))?.refs,
    ).toEqual([productId]);
    expect(await store.list("auditLogs")).toHaveLength(1);
    await expect(
      completeMediaUpload({ ...input, alt: "Different details" }, actorId, store, provider),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("does not reattach a removed and deleted image on exact completion retry", async () => {
    const store = seeded();
    const provider = fakeProvider();
    const signed = await signMediaUpload({ productId }, actorId, store, provider);
    const input = { ticketId: signed.ticketId, alt: "Test image" };
    const attached = await completeMediaUpload(input, actorId, store, provider);
    const src = attached.images.at(-1)!.src;
    await updateMediaGallery({ productId, action: "remove", src }, actorId, store);
    await deleteMediaAsset({ publicId: signed.fields.public_id }, actorId, store, provider);
    provider.resource.mockClear();
    const current = await completeMediaUpload(input, actorId, store, provider);
    expect(current.images.some((image) => image.src === src)).toBe(false);
    expect(provider.resource).not.toHaveBeenCalled();
    expect(await store.list("auditLogs")).toHaveLength(3);
  });

  it("preserves shared references when replacing a product image", async () => {
    const store = seeded();
    const provider = fakeProvider();
    const oldId = "vela/products/shared-old";
    const otherId = demoProducts[1].id;
    await store.set("products", productId, { ...demoProducts[0], images: [imageFor(oldId)] });
    await store.set("products", otherId, { ...demoProducts[1], images: [imageFor(oldId)] });
    await store.set("media", mediaDocumentId(oldId), assetFor(oldId, [productId, otherId]));
    const signed = await signMediaUpload({ productId }, actorId, store, provider);
    const updated = await completeMediaUpload(
      { ticketId: signed.ticketId, alt: "Replacement", replaceSrc: imageFor(oldId).src },
      actorId,
      store,
      provider,
    );
    expect(updated.images).toHaveLength(1);
    expect(updated.images[0].publicId).toBe(signed.fields.public_id);
    expect((await store.get<TrackedMediaAsset>("media", mediaDocumentId(oldId)))?.refs).toEqual([
      otherId,
    ]);
    await expect(
      deleteMediaAsset({ publicId: oldId }, actorId, store, provider),
    ).rejects.toMatchObject({ status: 409 });
    expect(provider.destroy).not.toHaveBeenCalled();
  });

  it("caps galleries without blocking an in-place replacement", async () => {
    const store = seeded();
    const provider = fakeProvider();
    const images = Array.from({ length: 12 }, (_, index) => ({
      ...demoProducts[0].images[0],
      src: `/images/local-${index}.webp`,
    }));
    await store.set("products", productId, { ...demoProducts[0], images });
    const signed = await signMediaUpload({ productId }, actorId, store, provider);
    const input = { ticketId: signed.ticketId, alt: "Replacement" };
    await expect(completeMediaUpload(input, actorId, store, provider)).rejects.toMatchObject({
      status: 409,
    });
    expect(
      (await completeMediaUpload({ ...input, replaceSrc: images[0].src }, actorId, store, provider))
        .images,
    ).toHaveLength(12);
  });
});

describe("gallery and deletion consistency", () => {
  it("reorders only the exact gallery and permits detaching local images", async () => {
    const store = seeded();
    const sources = demoProducts[0].images.map((image) => image.src);
    await expect(
      updateMediaGallery(
        { productId, action: "reorder", sources: [sources[0], "https://untrusted.example/x"] },
        actorId,
        store,
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      updateMediaGallery(
        { productId, action: "reorder", sources: [sources[0], sources[0]] },
        actorId,
        store,
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      updateMediaGallery(
        { productId, action: "remove", src: "https://untrusted.example/x" },
        actorId,
        store,
      ),
    ).rejects.toMatchObject({ status: 409 });
    const reordered = await updateMediaGallery(
      { productId, action: "reorder", sources: [...sources].reverse() },
      actorId,
      store,
    );
    expect(reordered.images.map((image) => image.src)).toEqual([...sources].reverse());
    const detached = await updateMediaGallery(
      { productId, action: "remove", src: sources[0] },
      actorId,
      store,
    );
    expect(detached.images.map((image) => image.src)).toEqual([sources[1]]);
  });

  it("refuses referenced, untracked, and out-of-scope asset deletion", async () => {
    const store = seeded();
    const provider = fakeProvider();
    const id = "vela/products/referenced";
    await store.set("media", mediaDocumentId(id), assetFor(id, [productId]));
    await expect(
      deleteMediaAsset({ publicId: id }, actorId, store, provider),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      deleteMediaAsset({ publicId: "vela/products/untracked" }, actorId, store, provider),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      deleteMediaAsset({ publicId: "other-store/private" }, actorId, store, provider),
    ).rejects.toThrow();
    expect(provider.destroy).not.toHaveBeenCalled();
  });

  it("keeps a retryable deletion lock on provider failure and records success once", async () => {
    const store = seeded();
    const provider = fakeProvider();
    const id = "vela/products/unreferenced";
    await store.set("media", mediaDocumentId(id), assetFor(id));
    provider.destroy.mockRejectedValueOnce(new AppError(502, "Provider timeout"));
    await expect(
      deleteMediaAsset({ publicId: id }, actorId, store, provider),
    ).rejects.toMatchObject({ status: 502 });
    expect((await store.get<TrackedMediaAsset>("media", mediaDocumentId(id)))?.state).toBe(
      "deleting",
    );
    expect(await store.list("auditLogs")).toHaveLength(0);
    await deleteMediaAsset({ publicId: id }, actorId, store, provider);
    await deleteMediaAsset({ publicId: id }, actorId, store, provider);
    expect(provider.destroy).toHaveBeenCalledTimes(2);
    expect((await store.get<TrackedMediaAsset>("media", mediaDocumentId(id)))?.deletedAt).toEqual(
      expect.any(Number),
    );
    expect(await store.list("auditLogs")).toHaveLength(1);
  });

  it("blocks a metadata-prefetch completion after deletion wins the race", async () => {
    const store = seeded();
    const provider = fakeProvider();
    const signed = await signMediaUpload({ productId }, actorId, store, provider);
    const id = signed.fields.public_id;
    await store.set("media", mediaDocumentId(id), assetFor(id));
    let release!: () => void;
    let fetched!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      fetched = resolve;
    });
    provider.resource.mockImplementationOnce(async (publicId) => {
      const metadata = resource(publicId);
      fetched();
      await held;
      return metadata;
    });
    const completion = completeMediaUpload(
      { ticketId: signed.ticketId, alt: "Should not attach" },
      actorId,
      store,
      provider,
    ).catch((error: unknown) => error);
    await started;
    await deleteMediaAsset({ publicId: id }, actorId, store, provider);
    release();
    expect(await completion).toMatchObject({ status: 409 });
    expect((await store.get<Product>("products", productId))?.images).toEqual(
      demoProducts[0].images,
    );
    expect(
      (await store.get<MediaUploadTicket>("mediaUploads", signed.ticketId))?.completedAt,
    ).toBeNull();
  });
});

describe("media HTTP authorization", () => {
  const routes = [
    ["POST", "/api/admin/media/sign", signRoute, { productId }],
    ["POST", "/api/admin/media/complete", completeRoute, { ticketId: "ticket", alt: "Image" }],
    [
      "PATCH",
      "/api/admin/media/gallery",
      galleryRoute,
      { productId, action: "remove", src: "/images/x.webp" },
    ],
    ["DELETE", "/api/admin/media", deleteRoute, { publicId: "vela/products/test" }],
  ] as const;

  it.each(routes)(
    "requires administrator session for %s %s",
    async (method, path, handler, body) => {
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://127.0.0.1:3000");
      vi.mocked(requireAdmin).mockRejectedValue(
        new AppError(403, "Administrator access is required."),
      );
      const response = await handler(
        new Request(`http://127.0.0.1:3000${path}`, {
          method,
          headers: { Origin: "http://127.0.0.1:3000", "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
      expect(response.status).toBe(403);
    },
  );

  it("rejects cross-origin signature requests before authorization or provider access", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://127.0.0.1:3000");
    const response = await signRoute(
      new Request("http://127.0.0.1:3000/api/admin/media/sign", {
        method: "POST",
        headers: { Origin: "https://untrusted.example", "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      }),
    );
    expect(response.status).toBe(403);
    expect(requireAdmin).not.toHaveBeenCalled();
  });
});
