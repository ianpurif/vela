import { z } from "zod";

export const supportEmailSchema = z
  .string()
  .trim()
  .max(254)
  .email("Enter a valid email address.")
  .toLowerCase();
export const contactFieldsSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your name.").max(100),
    email: supportEmailSchema,
    subject: z.string().trim().min(3, "Add a short subject.").max(160),
    message: z.string().trim().min(10, "Please include a little more detail.").max(5000),
  })
  .strict();
export const contactInputSchema = contactFieldsSchema
  .extend({ requestKey: z.string().uuid() })
  .strict();
export const preferenceKeySchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/, "Open your private preferences link to manage this signup.");
export const newsletterInputSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("subscribe"),
      email: supportEmailSchema,
      consent: z.literal(true, { error: "Please agree before saving your signup." }),
      preferenceKey: preferenceKeySchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("unsubscribe"),
      email: supportEmailSchema,
      preferenceKey: preferenceKeySchema,
    })
    .strict(),
]);
export const contactIdSchema = z.string().regex(/^c_[a-f0-9]{64}$/);
export const contactStatusSchema = z.enum(["new", "reviewing", "closed"]);
export const supportStatusInputSchema = z
  .object({ id: contactIdSchema, status: contactStatusSchema })
  .strict();
export type ContactFields = z.infer<typeof contactFieldsSchema>;
export type ContactInput = z.infer<typeof contactInputSchema>;
export type NewsletterInput = z.infer<typeof newsletterInputSchema>;
export type SupportStatusInput = z.infer<typeof supportStatusInputSchema>;
