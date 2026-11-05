import { createHash } from "node:crypto";
import { z } from "zod";
import { AppError } from "@/lib/errors";

export { cloudinaryDeliveryUrl } from "./delivery";
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 8000;
export const MAX_PRODUCT_IMAGES = 12;
export const ALLOWED_IMAGE_FORMATS = ["jpg", "png", "webp", "avif"] as const;
export const publicIdSchema = z.string().regex(/^vela\/products\/[a-zA-Z0-9_-]{1,120}$/);

/** Node/CLI shared helper: Cloudinary public IDs contain slashes, Firestore IDs cannot. */
export function mediaDocumentId(publicId: string): string {
  return createHash("sha256").update(publicIdSchema.parse(publicId)).digest("hex");
}

const resourceSchema = z.object({
  public_id: publicIdSchema,
  asset_id: z.string().min(1).max(160),
  resource_type: z.literal("image"),
  type: z.literal("upload"),
  format: z.enum(ALLOWED_IMAGE_FORMATS),
  version: z.number().int().positive(),
  width: z.number().int().min(1).max(MAX_IMAGE_DIMENSION),
  height: z.number().int().min(1).max(MAX_IMAGE_DIMENSION),
  bytes: z.number().int().min(1).max(MAX_IMAGE_BYTES),
  secure_url: z.string().url(),
});

export type ValidatedCloudinaryResource = {
  publicId: string;
  assetId: string;
  src: string;
  width: number;
  height: number;
  bytes: number;
  format: (typeof ALLOWED_IMAGE_FORMATS)[number];
  version: number;
};

/** Validate trusted-provider metadata, never the browser's upload response. No env or SDK init. */
export function validateCloudinaryResource(
  resource: unknown,
  expectedPublicId: string,
  cloudName: string,
): ValidatedCloudinaryResource {
  const parsed = resourceSchema.safeParse(resource);
  if (!parsed.success || !/^[a-z0-9_-]{1,100}$/.test(cloudName)) {
    throw new AppError(
      400,
      "Use a JPG, PNG, WebP, or AVIF image up to 8 MB and 8,000 pixels per side.",
      "INVALID_IMAGE",
    );
  }
  const data = parsed.data;
  const src = `https://res.cloudinary.com/${cloudName}/image/upload/v${data.version}/${data.public_id}.${data.format}`;
  if (data.public_id !== expectedPublicId || data.secure_url !== src) {
    throw new AppError(
      400,
      "The uploaded image does not match this store's upload request.",
      "INVALID_IMAGE_ORIGIN",
    );
  }
  return {
    publicId: data.public_id,
    assetId: data.asset_id,
    src,
    width: data.width,
    height: data.height,
    bytes: data.bytes,
    format: data.format,
    version: data.version,
  };
}
