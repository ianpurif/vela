import "server-only";
import { demoCategories, demoProducts, defaultContent } from "@/features/catalog/fixtures";
import type { Category, HomepagePromotion, Product, SiteContent } from "@/types/commerce";
import { AppError } from "@/lib/errors";
import { firestoreStore } from "./firestore-store";
import { slugSchema } from "@/lib/validation/commerce";
import type { CommerceStore } from "./store";

/** Public homepage projection; promotion documents themselves remain server-only. */
export async function readHomeContent(store: CommerceStore = firestoreStore): Promise<SiteContent> {
  const [settings, promotion] = await Promise.all([
    store.get<
      Omit<SiteContent, "promotionTitle" | "promotionText"> &
        Partial<Pick<SiteContent, "promotionTitle" | "promotionText">>
    >("settings", "home"),
    store.get<HomepagePromotion>("promotions", "home"),
  ]);
  const promotionTitle = promotion?.title ?? settings?.promotionTitle;
  const promotionText = promotion?.text ?? settings?.promotionText;
  if (!settings || typeof promotionTitle !== "string" || typeof promotionText !== "string") {
    throw new AppError(503, "Homepage content has not been configured.", "CONTENT_UNAVAILABLE");
  }
  return {
    ...settings,
    promotionTitle,
    promotionText,
    updatedAt: Math.max(settings.updatedAt, promotion?.updatedAt ?? 0),
  };
}

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
        return readHomeContent();
      },
    };
  throw new AppError(
    503,
    "The catalog is not configured. Choose explicit demo mode or configure Firebase.",
    "CONFIGURATION_REQUIRED",
  );
}
