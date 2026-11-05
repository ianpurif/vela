import "server-only";
import { demoCategories, demoProducts, defaultContent } from "@/features/catalog/fixtures";
import type { Category, Product, SiteContent } from "@/types/commerce";
import { AppError } from "@/lib/errors";
import { firestoreStore } from "./firestore-store";
import { slugSchema } from "@/lib/validation/commerce";

export interface CatalogRepository {
  list(): Promise<Product[]>;
  getBySlug(slug: string): Promise<Product | null>;
  categories(): Promise<Category[]>;
  content(): Promise<SiteContent>;
}
const demo: CatalogRepository = {
  list: async () => structuredClone(demoProducts),
  getBySlug: async (slug) => structuredClone(demoProducts.find((p) => p.slug === slug) || null),
  categories: async () => structuredClone(demoCategories),
  content: async () => structuredClone(defaultContent),
};
export function getCatalogRepository(): CatalogRepository {
  if (process.env.VELA_DATA_MODE === "demo") return demo;
  if (process.env.VELA_DATA_MODE === "firebase")
    return {
      list: () =>
        firestoreStore.list<Product>(
          "products",
          [{ field: "status", op: "==", value: "published" }],
          { orderBy: "rank", limit: 200 },
        ),
      async getBySlug(slug) {
        if (!slugSchema.safeParse(slug).success) return null;
        const product = await firestoreStore.get<Product>("products", slug);
        return product?.status === "published" ? product : null;
      },
      categories: () =>
        firestoreStore.list<Category>("categories", [], { orderBy: "rank", limit: 50 }),
      async content() {
        return (await firestoreStore.get<SiteContent>("settings", "home")) || defaultContent;
      },
    };
  throw new AppError(
    503,
    "The catalog is not configured. Choose explicit demo mode or configure Firebase.",
    "CONFIGURATION_REQUIRED",
  );
}
