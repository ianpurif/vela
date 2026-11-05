import { z } from "zod";
import { concernLabels } from "@/features/catalog/filter";
import type { Product } from "@/types/commerce";

export const routineAnswersSchema = z
  .object({
    skinType: z.enum(["dry", "oily", "combination", "balanced"]),
    concerns: z.array(z.enum(["dryness", "dullness", "texture", "comfort"])).max(4),
    sensitivity: z.enum(["rarely", "sometimes", "often"]),
    length: z.enum(["minimal", "balanced", "full"]),
    fragrance: z.enum(["fragrance-free", "no-preference"]),
  })
  .strict();
export type RoutineAnswers = z.infer<typeof routineAnswersSchema>;
export type RoutineDraft = { [Key in keyof RoutineAnswers]: RoutineAnswers[Key] | null };
export const emptyRoutineDraft: RoutineDraft = {
  skinType: null,
  concerns: null,
  sensitivity: null,
  length: null,
  fragrance: null,
};

export const skinTypeLabels = {
  dry: "Dry",
  oily: "Oily",
  combination: "Combination",
  balanced: "Balanced",
} as const;
export const sensitivityLabels = {
  rarely: "Rarely sensitive",
  sometimes: "Sometimes sensitive",
  often: "Often sensitive",
} as const;
export const lengthLabels = {
  minimal: "Minimal (2 steps)",
  balanced: "Balanced (3 steps)",
  full: "Full (4 steps)",
} as const;
export const fragranceLabels = {
  "fragrance-free": "Fragrance-free only",
  "no-preference": "No fragrance preference",
} as const;

const categories = {
  cleansers: { label: "Cleanse", name: "cleanser", description: "A fresh beginning." },
  serums: { label: "Layer", name: "serum or essence", description: "A little extra care." },
  moisturizers: {
    label: "Moisturize",
    name: "moisturizer",
    description: "A comfortable finishing layer.",
  },
  oils: { label: "Finish", name: "face oil", description: "An optional evening finish." },
} as const;
export type RoutineCategory = keyof typeof categories;
export const routinePlans: Record<RoutineAnswers["length"], readonly RoutineCategory[]> = {
  minimal: ["cleansers", "moisturizers"],
  balanced: ["cleansers", "serums", "moisturizers"],
  full: ["cleansers", "serums", "moisturizers", "oils"],
};
export type RoutineRecommendation = {
  product: Product;
  category: RoutineCategory;
  label: string;
  description: string;
  reasons: string[];
};
export type RoutineResult = {
  recommendations: RoutineRecommendation[];
  missing: { category: RoutineCategory; name: string }[];
  requestedSteps: number;
  subtotal: number;
};

const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Catalog preferences only: no diagnosis, ingredient inference, or clinical suitability claim. */
export function buildRoutine(products: readonly Product[], input: RoutineAnswers): RoutineResult {
  const answers = routineAnswersSchema.parse(input);
  const concerns = [...new Set(answers.concerns)];
  const fragranceFree = answers.fragrance === "fragrance-free" || answers.sensitivity !== "rarely";
  const candidates = products
    .filter(
      (product) =>
        product.status === "published" &&
        Number.isInteger(product.stock) &&
        Number.isInteger(product.reserved) &&
        product.stock >= 0 &&
        product.reserved >= 0 &&
        product.stock - product.reserved > 0 &&
        Number.isSafeInteger(product.price) &&
        product.price >= 0 &&
        product.skinTypes.includes(answers.skinType) &&
        (!fragranceFree || product.fragranceFree) &&
        Object.hasOwn(categories, product.category),
    )
    .map((product) => {
      const matchedConcerns = concerns.filter((concern) => product.concerns.includes(concern));
      const comfort = product.concerns.includes("comfort") && answers.sensitivity !== "rarely";
      const score =
        matchedConcerns.length * 10 + (comfort ? (answers.sensitivity === "often" ? 6 : 3) : 0);
      const reasons = [
        `Listed for ${skinTypeLabels[answers.skinType].toLowerCase()} skin in the catalog.`,
      ];
      if (matchedConcerns.length)
        reasons.push(
          `Matches your focus: ${matchedConcerns.map((concern) => concernLabels[concern].toLowerCase()).join(", ")}.`,
        );
      if (fragranceFree)
        reasons.push(
          answers.fragrance === "fragrance-free"
            ? "Fragrance-free, as you requested."
            : "Fragrance-free for your sensitivity preference.",
        );
      if (comfort && !matchedConcerns.includes("comfort"))
        reasons.push("Includes skin comfort among its catalog concerns.");
      return { product, score, reasons };
    })
    // Lower editorial rank, then ID, makes ties stable regardless of repository order.
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.product.rank - b.product.rank ||
        compareText(a.product.id, b.product.id) ||
        compareText(a.product.category, b.product.category),
    );

  const recommendations: RoutineRecommendation[] = [];
  const missing: RoutineResult["missing"] = [];
  const selected = new Set<string>();
  const plan = routinePlans[answers.length];
  for (const category of plan) {
    const candidate = candidates.find(
      ({ product }) => product.category === category && !selected.has(product.id),
    );
    if (!candidate) {
      missing.push({ category, name: categories[category].name });
      continue;
    }
    selected.add(candidate.product.id);
    recommendations.push({
      product: candidate.product,
      category,
      ...categories[category],
      reasons: candidate.reasons,
    });
  }
  return {
    recommendations,
    missing,
    requestedSteps: plan.length,
    subtotal: recommendations.reduce((total, item) => total + item.product.price, 0),
  };
}
