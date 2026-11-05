import { z } from "zod";
import { contentInputSchema } from "@/lib/validation/operations";
import type { SiteContent } from "@/types/commerce";

// Approved editorial configuration for explicit initialization, never a runtime fallback.
export const initialHomeContent = {
  announcement: "A little care, delivered. Complimentary US shipping on orders $75+",
  heroEyebrow: "Considered skincare. Everyday rituals.",
  heroTitle: "Good skin.",
  heroItalic: "A softer pace.",
  heroDescription:
    "Thoughtfully made essentials. Beautifully simple rituals. A moment to come back to yourself.",
  promotionTitle: "Your skin. Your rhythm.",
  promotionText: "A few thoughtful questions. A ritual that feels like you.",
  featuredCategory: "",
} satisfies z.infer<typeof contentInputSchema>;

const timestamp = z.number().int().nonnegative();
const settingsSchema = contentInputSchema
  .omit({ promotionTitle: true, promotionText: true })
  .extend({ id: z.literal("home"), updatedAt: timestamp })
  .strip();
const promotionSchema = z.object({
  id: z.literal("home"),
  title: contentInputSchema.shape.promotionTitle,
  text: contentInputSchema.shape.promotionText,
  updatedAt: timestamp,
});

/** Validate persisted fields before they reach rendering or the administrator form. */
export function resolveHomeContent(settings: unknown, promotion: unknown): SiteContent {
  const fields = settingsSchema.parse(settings);
  if (promotion == null) {
    const legacy = contentInputSchema
      .pick({ promotionTitle: true, promotionText: true })
      .strip()
      .parse(settings);
    return { ...fields, ...legacy };
  }
  const section = promotionSchema.parse(promotion);
  return {
    ...fields,
    promotionTitle: section.title,
    promotionText: section.text,
    updatedAt: Math.max(fields.updatedAt, section.updatedAt),
  };
}
