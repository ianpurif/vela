import "server-only";
import { demoCategories, demoProducts, defaultContent } from "@/features/catalog/fixtures";
import type { Category, Product, SiteContent } from "@/types/commerce";
import { AppError } from "@/lib/errors";

export interface CatalogRepository {
  list(): Promise<Product[]>;
  getBySlug(slug: string): Promise<Product | null>;
  categories(): Promise<Category[]>;
  content(): Promise<SiteContent>;
}
const demo: CatalogRepository = {
  list: async () => structuredClone(demoProducts),
  getBySlug: async (slug) => structuredClone(demoProducts.find(p => p.slug === slug) || null),
  categories: async () => structuredClone(demoCategories),
  content: async () => structuredClone(defaultContent),
};
export function getCatalogRepository(): CatalogRepository {
  if (process.env.VELA_DATA_MODE === "demo") return demo;
  throw new AppError(503, "The catalog is not configured. Choose explicit demo mode or configure Firebase.", "CONFIGURATION_REQUIRED");
}
