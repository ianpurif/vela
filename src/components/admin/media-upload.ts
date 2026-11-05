"use client";

export type UploadTicket = {
  ticketId: string;
  uploadUrl: string;
  fields: Record<string, string | number | boolean>;
};
export const MAX_GALLERY_IMAGES = 12;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export function validateUploadFile(file: File): string | null {
  if (!allowedTypes.has(file.type)) return `${file.name}: choose a JPG, PNG, WebP or AVIF image.`;
  if (file.size === 0) return `${file.name}: this file is empty.`;
  if (file.size > MAX_IMAGE_BYTES) return `${file.name}: images must be 8 MB or smaller.`;
  return null;
}

export function defaultImageAlt(name: string, filename: string) {
  const label = filename
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${name} — ${label || "product image"}`.slice(0, 180);
}

/** Upload only to the image endpoint returned by our authenticated signing route. */
export async function uploadToCloudinary(ticket: UploadTicket, file: File) {
  const url = new URL(ticket.uploadUrl);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "api.cloudinary.com" ||
    !/^\/v1_1\/[^/]+\/image\/upload$/.test(url.pathname)
  )
    throw new Error("The image upload destination is not valid. Please refresh and try again.");
  const form = new FormData();
  for (const [key, value] of Object.entries(ticket.fields)) form.append(key, String(value));
  form.append("file", file);
  const response = await fetch(url, {
    method: "POST",
    body: form,
    credentials: "omit",
    signal: AbortSignal.timeout(90000),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      typeof body.error?.message === "string"
        ? `Image upload failed: ${body.error.message}`
        : "The image service couldn’t accept this file. Please try again.",
    );
  }
}
