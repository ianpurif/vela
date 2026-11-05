import { describe, expect, it } from "vitest";
import { MemoryStore } from "./helpers/memory-store";
import { demoProducts, demoCategories } from "@/features/catalog/fixtures";
import { productInputSchema } from "@/lib/validation/commerce";
import { adjustStock, saveCategory, saveProduct } from "@/server/services/admin";
import type { Product } from "@/types/commerce";

const seeded = () => new MemoryStore({ products: { [demoProducts[0].id]: { ...demoProducts[0], stock: 5, reserved: 3 } }, categories: Object.fromEntries(demoCategories.map(c => [c.id, c])) });
const productInput = () => Object.fromEntries(Object.keys(productInputSchema.shape).map(key => [key, demoProducts[0][key as keyof Product]]));
describe("admin commerce mutations", () => {
  it("preserves stock, reservations and media when editing product copy", async () => {
    const store = seeded();
    const product = await saveProduct({ ...productInput(), name: "Updated cleanser" }, "admin", demoProducts[0].id, store);
    expect(product.stock).toBe(5); expect(product.reserved).toBe(3); expect(product.images).toEqual(demoProducts[0].images);
    expect(await store.list("auditLogs")).toHaveLength(1);
  });
  it("rejects direct stock overrides and unknown categories", async () => {
    const store = seeded();
    await expect(saveProduct({ ...productInput(), stock: 999 }, "admin", demoProducts[0].id, store)).rejects.toThrow();
    await expect(saveProduct({ ...productInput(), category: "not-a-category" }, "admin", demoProducts[0].id, store)).rejects.toMatchObject({ status: 400 });
  });
  it("never adjusts inventory below active reservations", async () => {
    const store = seeded();
    await expect(adjustStock({ productId: demoProducts[0].id, delta: -3, reason: "Damaged units" }, "admin", store)).rejects.toMatchObject({ status: 409 });
    expect((await store.get<Product>("products", demoProducts[0].id))?.stock).toBe(5);
    expect(await store.list("auditLogs")).toHaveLength(0);
    expect((await adjustStock({ productId: demoProducts[0].id, delta: -2, reason: "Damaged units" }, "admin", store)).stock).toBe(3);
  });
  it("serializes concurrent adjustments and retains every audit event", async () => {
    const store = seeded();
    await Promise.all(Array.from({ length: 10 }, () => adjustStock({ productId: demoProducts[0].id, delta: 1, reason: "Stock received" }, "admin", store)));
    expect((await store.get<Product>("products", demoProducts[0].id))?.stock).toBe(15);
    expect(await store.list("auditLogs")).toHaveLength(10);
  });
  it("rejects duplicate categories and immutable product URL edits", async () => {
    const store = seeded();
    await expect(saveCategory(demoCategories[0], "admin", true, store)).rejects.toMatchObject({ status: 409 });
    await expect(saveProduct({ ...productInput(), slug: "changed-url" }, "admin", demoProducts[0].id, store)).rejects.toMatchObject({ status: 400 });
  });
});
