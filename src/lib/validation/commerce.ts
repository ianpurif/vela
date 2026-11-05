import { z } from "zod";

export const documentId = z
  .string()
  .regex(/^[a-zA-Z0-9_-]{1,120}$/, "Use letters, numbers, hyphens or underscores.");
export const slugSchema = z
  .string()
  .min(2)
  .max(90)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const cartItemSchema = z
  .object({ productId: documentId, quantity: z.number().int().min(1).max(10) })
  .strict();
export const cartSchema = z
  .array(cartItemSchema)
  .min(1)
  .max(20)
  .refine(
    (items) => new Set(items.map((x) => x.productId)).size === items.length,
    "Duplicate products are not allowed.",
  );
export const addressSchema = z
  .object({
    id: documentId,
    name: z.string().trim().min(2).max(100),
    line1: z.string().trim().min(3).max(150),
    line2: z.string().trim().max(150),
    city: z.string().trim().min(2).max(80),
    state: z.string().trim().max(80),
    postalCode: z.string().trim().min(2).max(20),
    country: z.string().regex(/^[A-Z]{2}$/),
  })
  .strict();
export const profileSchema = z
  .object({ name: z.string().trim().min(2).max(100), addresses: z.array(addressSchema).max(5) })
  .strict();
export const productInputSchema = z
  .object({
    slug: slugSchema,
    name: z.string().trim().min(3).max(100),
    category: slugSchema,
    subtitle: z.string().trim().min(3).max(120),
    description: z.string().trim().min(15).max(3000),
    price: z.number().int().min(100).max(1000000),
    size: z.string().trim().min(2).max(40),
    ingredients: z.array(z.string().trim().min(1).max(100)).min(1).max(60),
    benefits: z.array(z.string().trim().min(1).max(160)).min(1).max(8),
    usage: z.string().trim().min(10).max(1000),
    skinTypes: z
      .array(z.enum(["dry", "oily", "combination", "balanced"]))
      .min(1)
      .max(4),
    concerns: z
      .array(z.enum(["dryness", "dullness", "texture", "comfort"]))
      .min(1)
      .max(4),
    fragranceFree: z.boolean(),
    status: z.enum(["draft", "published", "archived"]),
    featured: z.boolean(),
    rank: z.number().int().min(0).max(999),
  })
  .strict();
export const categorySchema = z
  .object({
    id: slugSchema,
    name: z.string().trim().min(2).max(60),
    description: z.string().trim().max(300),
    rank: z.number().int().min(0).max(99),
  })
  .strict();
