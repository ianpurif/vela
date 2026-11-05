import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireAdmin } from "@/server/auth";
import { firestoreStore } from "@/server/repositories/firestore-store";
import type { CommerceStore } from "@/server/repositories/store";
import { categorySchema, documentId, productInputSchema } from "@/lib/validation/commerce";
import { AppError } from "@/lib/errors";
import type { AuditLog, Category, Product } from "@/types/commerce";

export function audit(
  actorId: string,
  action: string,
  entityId: string,
  details: AuditLog["details"],
): AuditLog {
  return { id: randomUUID(), actorId, action, entityId, details, createdAt: Date.now() };
}
export async function getAdminCatalog() {
  await requireAdmin();
  const [products, categories] = await Promise.all([
    firestoreStore.list<Product>("products", [], { orderBy: "rank", limit: 1000 }),
    firestoreStore.list<Category>("categories", [], { orderBy: "rank", limit: 100 }),
  ]);
  return { products, categories };
}
export async function getInventoryHistory() {
  await requireAdmin();
  return firestoreStore.list<AuditLog>(
    "auditLogs",
    [{ field: "action", op: "==", value: "inventory.adjusted" }],
    { orderBy: "createdAt", direction: "desc", limit: 50 },
  );
}
export async function saveProduct(
  input: unknown,
  actorId: string,
  existingId?: string,
  store: CommerceStore = firestoreStore,
) {
  const data = productInputSchema.parse(input);
  if (existingId && documentId.parse(existingId) !== data.slug)
    throw new AppError(
      400,
      "A published product URL cannot be changed. Create a new product instead.",
    );
  return store.transaction(async (tx) => {
    const [existing, category] = await Promise.all([
      tx.get<Product>("products", data.slug),
      tx.get<Category>("categories", data.category),
    ]);
    if (!category) throw new AppError(400, "Choose an existing category.");
    if (existingId && !existing) throw new AppError(404, "Product not found.");
    if (!existingId && existing) throw new AppError(409, "A product already uses that URL.");
    const now = Date.now();
    const product: Product = {
      ...data,
      id: data.slug,
      images: existing?.images || [],
      stock: existing?.stock || 0,
      reserved: existing?.reserved || 0,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    const log = audit(actorId, existing ? "product.updated" : "product.created", product.id, {
      status: product.status,
      price: product.price,
      previousPrice: existing?.price ?? null,
    });
    tx.set("products", product.id, product);
    tx.set("auditLogs", log.id, log);
    return product;
  });
}
export const adjustmentSchema = z
  .object({
    productId: documentId,
    delta: z
      .number()
      .int()
      .min(-1000000)
      .max(1000000)
      .refine((value) => value !== 0, "Enter a nonzero adjustment."),
    reason: z.string().trim().min(3).max(300),
  })
  .strict();
export async function adjustStock(
  input: unknown,
  actorId: string,
  store: CommerceStore = firestoreStore,
) {
  const data = adjustmentSchema.parse(input);
  return store.transaction(async (tx) => {
    const product = await tx.get<Product>("products", data.productId);
    if (!product) throw new AppError(404, "Product not found.");
    const stock = product.stock + data.delta;
    if (stock < product.reserved || stock > 1000000)
      throw new AppError(409, "Stock cannot fall below reserved units or exceed 1,000,000.");
    const updated = { ...product, stock, updatedAt: Date.now() };
    const log = audit(actorId, "inventory.adjusted", product.id, {
      before: product.stock,
      after: stock,
      delta: data.delta,
      reserved: product.reserved,
      reason: data.reason,
    });
    tx.set("products", product.id, updated);
    tx.set("auditLogs", log.id, log);
    return updated;
  });
}
export async function saveCategory(
  input: unknown,
  actorId: string,
  create: boolean,
  store: CommerceStore = firestoreStore,
) {
  const category = categorySchema.parse(input);
  await store.transaction(async (tx) => {
    const existing = await tx.get<Category>("categories", category.id);
    if (create && existing) throw new AppError(409, "That category already exists.");
    if (!create && !existing) throw new AppError(404, "Category not found.");
    const log = audit(actorId, create ? "category.created" : "category.updated", category.id, {
      name: category.name,
    });
    tx.set("categories", category.id, category);
    tx.set("auditLogs", log.id, log);
  });
  return category;
}
