import type { MetadataRoute } from "next";
import { getApplicationUrl } from "@/server/application-url";
import { getCatalogRepository } from "@/server/repositories/catalog";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = getApplicationUrl();
  const products = await getCatalogRepository().list();
  const pages = [
    "/",
    "/shop",
    "/about",
    "/routine",
    "/contact",
    "/faq",
    "/shipping",
    "/returns",
    "/privacy",
    "/terms",
  ];
  return [
    ...pages.map((path) => ({ url: new URL(path, origin).href })),
    ...products
      .filter((product) => product.status === "published")
      .map((product) => ({
        url: new URL(`/products/${product.slug}`, origin).href,
        ...(Number.isFinite(product.updatedAt) && product.updatedAt > 0
          ? { lastModified: new Date(product.updatedAt) }
          : {}),
        images: product.images.map((image) => new URL(image.src, origin).href),
      })),
  ];
}
