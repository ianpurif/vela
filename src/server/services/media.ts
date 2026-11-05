import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { getCloudinaryProvider, type MediaProvider } from "@/lib/cloudinary/provider";
import {
  MAX_PRODUCT_IMAGES,
  mediaDocumentId,
  publicIdSchema,
  validateCloudinaryResource,
} from "@/lib/cloudinary/shared";
import { documentId } from "@/lib/validation/commerce";
import { firestoreStore } from "@/server/repositories/firestore-store";
import type { CommerceStore } from "@/server/repositories/store";
import type { MediaAsset, Product, ProductImage } from "@/types/commerce";
import { audit } from "./admin";

export { mediaDocumentId, validateCloudinaryResource } from "@/lib/cloudinary/shared";

export const signMediaSchema = z.object({ productId: documentId }).strict();
export const completeMediaSchema = z
  .object({
    ticketId: documentId,
    alt: z.string().trim().min(1).max(180),
    replaceSrc: z.string().min(1).max(2048).optional(),
  })
  .strict();
export const gallerySchema = z.discriminatedUnion("action", [
  z
    .object({
      productId: documentId,
      action: z.literal("remove"),
      src: z.string().min(1).max(2048),
    })
    .strict(),
  z
    .object({
      productId: documentId,
      action: z.literal("reorder"),
      sources: z.array(z.string().min(1).max(2048)).max(MAX_PRODUCT_IMAGES),
    })
    .strict(),
]);
export const deleteMediaSchema = z.object({ publicId: publicIdSchema }).strict();

export type MediaUploadTicket = {
  id: string;
  userId: string;
  productId: string;
  publicId: string;
  cloudName: string;
  createdAt: number;
  expiresAt: number;
  completedAt: number | null;
  completion: { alt: string; replaceSrc: string | null } | null;
};
export type TrackedMediaAsset = MediaAsset & { deletedAt?: number };

function ownedTicket(ticket: MediaUploadTicket | null, actorId: string): MediaUploadTicket {
  if (!ticket || ticket.userId !== actorId) throw new AppError(404, "Upload request not found.");
  return ticket;
}

function checkCompletion(ticket: MediaUploadTicket, data: z.infer<typeof completeMediaSchema>) {
  if (ticket.completedAt !== null) {
    if (
      ticket.completion?.alt !== data.alt ||
      ticket.completion.replaceSrc !== (data.replaceSrc ?? null)
    ) {
      throw new AppError(409, "This upload request was already completed with different details.");
    }
    return true;
  }
  if (ticket.expiresAt <= Date.now())
    throw new AppError(410, "This upload request expired. Choose the image again.");
  return false;
}

export async function signMediaUpload(
  input: unknown,
  actorId: string,
  store: CommerceStore = firestoreStore,
  provider: MediaProvider = getCloudinaryProvider(),
) {
  const data = signMediaSchema.parse(input);
  const product = await store.get<Product>("products", data.productId);
  if (!product) throw new AppError(404, "Product not found.");
  const now = Date.now();
  const ticket: MediaUploadTicket = {
    id: randomUUID(),
    userId: actorId,
    productId: product.id,
    publicId: `vela/products/${randomUUID()}`,
    cloudName: provider.cloudName,
    createdAt: now,
    expiresAt: now + 15 * 60 * 1000,
    completedAt: null,
    completion: null,
  };
  const signed = provider.sign(ticket.publicId, Math.floor(now / 1000));
  await store.set("mediaUploads", ticket.id, ticket);
  return { ticketId: ticket.id, ...signed };
}

export async function completeMediaUpload(
  input: unknown,
  actorId: string,
  store: CommerceStore = firestoreStore,
  provider: MediaProvider = getCloudinaryProvider(),
) {
  const data = completeMediaSchema.parse(input);
  const initial = ownedTicket(
    await store.get<MediaUploadTicket>("mediaUploads", data.ticketId),
    actorId,
  );
  if (checkCompletion(initial, data)) {
    const current = await store.get<Product>("products", initial.productId);
    if (!current) throw new AppError(404, "Product not found.");
    return current; // Idempotent retry never restores an image subsequently removed.
  }
  if (initial.cloudName !== provider.cloudName)
    throw new AppError(409, "The image storage configuration changed. Start a new upload.");
  const metadata = validateCloudinaryResource(
    await provider.resource(initial.publicId),
    initial.publicId,
    provider.cloudName,
  );
  return store.transaction(async (tx) => {
    const ticket = ownedTicket(
      await tx.get<MediaUploadTicket>("mediaUploads", data.ticketId),
      actorId,
    );
    const product = await tx.get<Product>("products", ticket.productId);
    if (!product) throw new AppError(404, "Product not found.");
    if (checkCompletion(ticket, data)) return product;
    if (
      ticket.publicId !== initial.publicId ||
      ticket.productId !== initial.productId ||
      ticket.cloudName !== initial.cloudName
    ) {
      throw new AppError(409, "This upload request changed. Start a new upload.");
    }
    const replacementIndex = data.replaceSrc
      ? product.images.findIndex((image) => image.src === data.replaceSrc)
      : -1;
    if (data.replaceSrc && replacementIndex < 0)
      throw new AppError(409, "The image being replaced is no longer in this gallery.");
    if (!data.replaceSrc && product.images.length >= MAX_PRODUCT_IMAGES)
      throw new AppError(409, "A product can have up to 12 images.");
    if (
      product.images.some(
        (image, index) =>
          index !== replacementIndex &&
          (image.publicId === metadata.publicId || image.src === metadata.src),
      )
    ) {
      throw new AppError(409, "This image is already attached to the product.");
    }
    const oldImage = replacementIndex >= 0 ? product.images[replacementIndex] : undefined;
    const newId = mediaDocumentId(metadata.publicId);
    const oldId =
      oldImage?.publicId && oldImage.publicId !== metadata.publicId
        ? mediaDocumentId(oldImage.publicId)
        : null;
    const [existingAsset, oldAsset] = await Promise.all([
      tx.get<TrackedMediaAsset>("media", newId),
      oldId ? tx.get<TrackedMediaAsset>("media", oldId) : Promise.resolve(null),
    ]);
    if (
      existingAsset &&
      (existingAsset.state !== "ready" ||
        existingAsset.deletedAt ||
        existingAsset.assetId !== metadata.assetId)
    ) {
      throw new AppError(409, "This image is unavailable for attachment.");
    }
    const image: ProductImage = {
      src: metadata.src,
      alt: data.alt,
      width: metadata.width,
      height: metadata.height,
      publicId: metadata.publicId,
      assetId: metadata.assetId,
    };
    const images = [...product.images];
    if (replacementIndex >= 0) images[replacementIndex] = image;
    else images.push(image);
    const now = Date.now();
    const updated: Product = { ...product, images, updatedAt: now };
    const asset: MediaAsset = {
      id: newId,
      publicId: metadata.publicId,
      assetId: metadata.assetId,
      src: metadata.src,
      width: metadata.width,
      height: metadata.height,
      bytes: metadata.bytes,
      refs: [...new Set([...(existingAsset?.refs ?? []), product.id])],
      state: "ready",
      createdAt: existingAsset?.createdAt ?? now,
    };
    const log = audit(actorId, oldImage ? "media.replaced" : "media.attached", product.id, {
      publicId: metadata.publicId,
      previousSrc: oldImage?.src ?? null,
    });
    tx.set("products", product.id, updated);
    tx.set("media", newId, asset);
    if (
      oldId &&
      oldAsset &&
      !images.some((candidate) => candidate.publicId === oldAsset.publicId)
    ) {
      tx.set("media", oldId, {
        ...oldAsset,
        refs: oldAsset.refs.filter((id) => id !== product.id),
      });
    }
    tx.set("mediaUploads", ticket.id, {
      ...ticket,
      completedAt: now,
      completion: { alt: data.alt, replaceSrc: data.replaceSrc ?? null },
    });
    tx.set("auditLogs", log.id, log);
    return updated;
  });
}

export async function updateMediaGallery(
  input: unknown,
  actorId: string,
  store: CommerceStore = firestoreStore,
) {
  const data = gallerySchema.parse(input);
  return store.transaction(async (tx) => {
    const product = await tx.get<Product>("products", data.productId);
    if (!product) throw new AppError(404, "Product not found.");
    let images: ProductImage[];
    let removed: ProductImage | undefined;
    if (data.action === "remove") {
      removed = product.images.find((image) => image.src === data.src);
      if (!removed) throw new AppError(409, "This image is no longer in the product gallery.");
      images = product.images.filter((image) => image.src !== data.src);
    } else {
      if (
        data.sources.length !== product.images.length ||
        new Set(data.sources).size !== data.sources.length ||
        data.sources.some((src) => !product.images.some((image) => image.src === src))
      ) {
        throw new AppError(
          400,
          "Reorder the existing gallery images without adding or removing sources.",
        );
      }
      images = data.sources.map((src) => product.images.find((image) => image.src === src)!);
    }
    const oldId = removed?.publicId ? mediaDocumentId(removed.publicId) : null;
    const oldAsset = oldId ? await tx.get<TrackedMediaAsset>("media", oldId) : null;
    const updated: Product = { ...product, images, updatedAt: Date.now() };
    const log = audit(
      actorId,
      data.action === "remove" ? "media.detached" : "media.reordered",
      product.id,
      { source: removed?.src ?? null, imageCount: images.length },
    );
    tx.set("products", product.id, updated);
    if (oldId && oldAsset && !images.some((image) => image.publicId === oldAsset.publicId)) {
      tx.set("media", oldId, {
        ...oldAsset,
        refs: oldAsset.refs.filter((id) => id !== product.id),
      });
    }
    tx.set("auditLogs", log.id, log);
    return updated;
  });
}

export async function deleteMediaAsset(
  input: unknown,
  actorId: string,
  store: CommerceStore = firestoreStore,
  provider: MediaProvider = getCloudinaryProvider(),
) {
  const { publicId } = deleteMediaSchema.parse(input);
  const id = mediaDocumentId(publicId);
  const alreadyDeleted = await store.transaction(async (tx) => {
    const asset = await tx.get<TrackedMediaAsset>("media", id);
    if (!asset || asset.publicId !== publicId) throw new AppError(404, "Tracked image not found.");
    if (asset.refs.length > 0)
      throw new AppError(
        409,
        "This image is still referenced by a product. Remove it from every gallery first.",
      );
    if (!asset.src.startsWith(`https://res.cloudinary.com/${provider.cloudName}/image/upload/`))
      throw new AppError(409, "This image belongs to a different media configuration.");
    if (asset.deletedAt) return true;
    // Kept on provider failures and process crashes; deletion is retryable, attachment is not.
    tx.set("media", id, { ...asset, state: "deleting" });
    return false;
  });
  if (alreadyDeleted) return { ok: true as const };
  await provider.destroy(publicId);
  await store.transaction(async (tx) => {
    const asset = await tx.get<TrackedMediaAsset>("media", id);
    if (!asset || asset.state !== "deleting" || asset.refs.length > 0)
      throw new AppError(
        409,
        "The image deletion lock changed. Inspect media references before retrying.",
      );
    if (asset.deletedAt) return;
    const log = audit(actorId, "media.deleted", publicId, { assetId: asset.assetId });
    // Retain the tombstone so a completion that already fetched metadata cannot reattach it.
    tx.set("media", id, { ...asset, deletedAt: Date.now() });
    tx.set("auditLogs", log.id, log);
  });
  return { ok: true as const };
}
