import { parseArgs } from "node:util";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { deleteApp } from "firebase-admin/app";
import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";
import { getScriptAdmin } from "./firebase-script-admin";
import { mediaDocumentId, validateCloudinaryResource } from "../src/lib/cloudinary/shared";
import type { Product, ProductImage, MediaAsset } from "../src/types/commerce";

const imageRoot = path.resolve("public/images");
async function localBytes(src: string) {
  if (!src.startsWith("/images/")) throw new Error("Only provided local images can be imported.");
  const absolute = path.resolve("public", src.slice(1));
  const relative = path.relative(imageRoot, absolute);
  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    !/\.(webp|png|jpe?g|avif|svg)$/i.test(absolute)
  )
    throw new Error("Image path is outside the allowed asset directory.");
  const input = await readFile(absolute);
  if (input.byteLength > 8 * 1024 * 1024) throw new Error("Local image exceeds 8 MB.");
  // Rasterize the accurate Clear Day illustration; do not import unsupported SPF packaging.
  return absolute.endsWith(".svg") ? sharp(input).webp({ quality: 92 }).toBuffer() : input;
}

async function main() {
  const { values } = parseArgs({
    options: { project: { type: "string" }, apply: { type: "boolean", default: false } },
    strict: true,
  });
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (
    values.apply &&
    (!cloudName || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET)
  )
    throw new Error("Configure all three Cloudinary variables before using --apply.");
  const { app, db, projectId } = getScriptAdmin(values.project);
  try {
    const snapshots = await db.collection("products").limit(1000).get();
    const products = snapshots.docs.map((doc) => doc.data() as Product);
    const jobs = products.filter((product) =>
      product.images.some((image) => image.src.startsWith("/images/")),
    );
    for (const product of jobs) {
      if (product.images.length > 12)
        throw new Error(`Gallery for ${product.id} exceeds 12 images.`);
      for (const image of product.images.filter((image) => image.src.startsWith("/images/")))
        await localBytes(image.src);
      console.info(
        `${product.name}: ${product.images.filter((image) => image.src.startsWith("/images/")).length} local images`,
      );
    }
    if (!values.apply) {
      console.info(
        `Dry run complete for ${projectId}. Add --apply to upload and update existing product galleries.`,
      );
      return;
    }
    cloudinary.config({
      cloud_name: cloudName,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    for (const product of jobs) {
      const prepared = new Map<
        string,
        { image: ProductImage; asset: Omit<MediaAsset, "refs" | "state" | "createdAt"> }
      >();
      for (const original of product.images.filter((image) => image.src.startsWith("/images/"))) {
        const bytes = await localBytes(original.src);
        const publicId = `vela/products/import-${createHash("sha256").update(bytes).digest("hex").slice(0, 32)}`;
        let resource: unknown;
        try {
          resource = await cloudinary.api.resource(publicId, { resource_type: "image" });
        } catch (error) {
          if (
            !error ||
            typeof error !== "object" ||
            !("http_code" in error) ||
            error.http_code !== 404
          )
            throw error;
          const extension = path.extname(original.src).slice(1).toLowerCase();
          const format = extension === "svg" ? "webp" : extension === "jpg" ? "jpeg" : extension;
          resource = await cloudinary.uploader.upload(
            `data:image/${format};base64,${bytes.toString("base64")}`,
            {
              public_id: publicId,
              resource_type: "image",
              overwrite: false,
              allowed_formats: ["jpg", "png", "webp", "avif"],
            },
          );
        }
        const verified = validateCloudinaryResource(resource, publicId, cloudName!);
        const asset = {
          id: mediaDocumentId(publicId),
          publicId,
          assetId: verified.assetId,
          src: verified.src,
          width: verified.width,
          height: verified.height,
          bytes: verified.bytes,
        };
        prepared.set(original.src, {
          image: {
            src: asset.src,
            alt: original.alt,
            width: asset.width,
            height: asset.height,
            publicId,
            assetId: asset.assetId,
          },
          asset,
        });
      }
      await db.runTransaction(async (tx) => {
        const ref = db.collection("products").doc(product.id);
        const currentSnapshot = await tx.get(ref);
        if (!currentSnapshot.exists)
          throw new Error(`Product ${product.id} was removed during import.`);
        const current = currentSnapshot.data() as Product;
        const uniqueAssets = [
          ...new Map([...prepared.values()].map((value) => [value.asset.id, value.asset])).values(),
        ];
        const oldAssets = await Promise.all(
          uniqueAssets.map((asset) => tx.get(db.collection("media").doc(asset.id))),
        );
        if (oldAssets.some((snapshot) => snapshot.exists && snapshot.data()?.state === "deleting"))
          throw new Error(
            "An imported asset is being deleted or has a deletion tombstone. Resolve this asset before importing again.",
          );
        const images = current.images.map((image) => prepared.get(image.src)?.image || image);
        const now = Date.now();
        uniqueAssets.forEach((asset, index) => {
          const old = oldAssets[index].data() as MediaAsset | undefined;
          const referenced = images.some((image) => image.publicId === asset.publicId);
          const refs = new Set(old?.refs || []);
          if (referenced) refs.add(current.id);
          tx.set(db.collection("media").doc(asset.id), {
            ...asset,
            refs: [...refs],
            state: "ready",
            createdAt: old?.createdAt || now,
          });
        });
        tx.set(ref, { ...current, images, updatedAt: now });
        const id = randomUUID();
        tx.set(db.collection("auditLogs").doc(id), {
          id,
          actorId: "import-cli",
          action: "media.imported",
          entityId: current.id,
          details: { imageCount: images.length },
          createdAt: now,
        });
      });
      console.info(`Imported ${product.name}; local source files preserved.`);
    }
  } finally {
    await deleteApp(app);
  }
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Media import failed.");
  process.exitCode = 1;
});
