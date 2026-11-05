import { z } from "zod";
import { documentId, slugSchema } from "./commerce";

export const paymentStatusSchema = z.enum(["pending", "paid", "failed", "cancelled", "expired"]);
export const fulfillmentStatusSchema = z.enum([
  "unfulfilled",
  "processing",
  "shipped",
  "delivered",
]);
export const orderFiltersSchema = z
  .object({
    paymentStatus: paymentStatusSchema.optional(),
    fulfillmentStatus: fulfillmentStatusSchema.optional(),
    after: documentId.optional(),
  })
  .strict();
export const fulfillmentInputSchema = z
  .object({
    id: documentId,
    fulfillmentStatus: fulfillmentStatusSchema,
    trackingNumber: z
      .string()
      .trim()
      .max(100)
      .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "Use a plain tracking number."),
  })
  .strict()
  .refine(
    (value) =>
      !["shipped", "delivered"].includes(value.fulfillmentStatus) ||
      value.trackingNumber.length > 0,
    { message: "Add a tracking number before shipping or delivery.", path: ["trackingNumber"] },
  );
export const contentInputSchema = z
  .object({
    announcement: z.string().trim().max(180),
    heroEyebrow: z.string().trim().min(2).max(120),
    heroTitle: z.string().trim().min(1).max(100),
    heroItalic: z.string().trim().min(1).max(100),
    heroDescription: z.string().trim().min(10).max(500),
    promotionTitle: z.string().trim().min(2).max(160),
    promotionText: z.string().trim().min(10).max(600),
    featuredCategory: z.union([slugSchema, z.literal("")]),
  })
  .strict();
export type FulfillmentInput = z.infer<typeof fulfillmentInputSchema>;
export type HomeContentInput = z.infer<typeof contentInputSchema>;
