import type { Product } from "@/types/commerce";

export const concernLabels = {
  dryness: "Dryness",
  dullness: "Dullness",
  texture: "Uneven texture",
  comfort: "Skin comfort",
} as const;
export const sortLabels = {
  featured: "Our edit",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
  name: "Name: A to Z",
} as const;
export type CatalogFilters = {
  q: string;
  category: string;
  concern: string;
  sort: keyof typeof sortLabels;
  available: boolean;
};
export type SearchValues = Record<string, string | string[] | undefined>;

export function parseCatalogFilters(values: SearchValues): CatalogFilters {
  const first = (key: string) => (typeof values[key] === "string" ? (values[key] as string) : "");
  const sort = first("sort");
  return {
    q: first("q").trim().slice(0, 100),
    category: first("category").slice(0, 90),
    concern: Object.hasOwn(concernLabels, first("concern")) ? first("concern") : "",
    sort: Object.hasOwn(sortLabels, sort) ? (sort as CatalogFilters["sort"]) : "featured",
    available: first("available") === "1",
  };
}

export function filterProducts(products: Product[], filters: CatalogFilters): Product[] {
  const terms = filters.q.toLocaleLowerCase("en-US").split(/\s+/).filter(Boolean);
  return products
    .filter((product) => {
      const haystack = [
        product.name,
        product.subtitle,
        product.description,
        product.category,
        ...product.ingredients,
      ]
        .join(" ")
        .toLocaleLowerCase("en-US");
      return (
        product.status === "published" &&
        (!filters.category || product.category === filters.category) &&
        (!filters.concern || product.concerns.some((concern) => concern === filters.concern)) &&
        (!filters.available || product.stock - product.reserved > 0) &&
        terms.every((term) => haystack.includes(term))
      );
    })
    .sort((a, b) => {
      if (filters.sort === "price-asc") return a.price - b.price || a.name.localeCompare(b.name);
      if (filters.sort === "price-desc") return b.price - a.price || a.name.localeCompare(b.name);
      if (filters.sort === "name") return a.name.localeCompare(b.name);
      return (
        Number(b.featured) - Number(a.featured) || a.rank - b.rank || a.name.localeCompare(b.name)
      );
    });
}

export function catalogHref(filters: CatalogFilters, change: Partial<CatalogFilters> = {}): string {
  const next = { ...filters, ...change };
  const query = new URLSearchParams();
  if (next.q) query.set("q", next.q);
  if (next.category) query.set("category", next.category);
  if (next.concern) query.set("concern", next.concern);
  if (next.sort !== "featured") query.set("sort", next.sort);
  if (next.available) query.set("available", "1");
  return `/shop${query.size ? `?${query}` : ""}`;
}
