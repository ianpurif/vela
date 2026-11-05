import { describe, expect, it } from "vitest";
import { demoProducts } from "@/features/catalog/fixtures";
import {
  buildRoutine,
  routineAnswersSchema,
  type RoutineAnswers,
} from "@/features/routine/matching";
import type { Product } from "@/types/commerce";

const answers: RoutineAnswers = {
  skinType: "dry",
  concerns: ["dryness"],
  sensitivity: "often",
  length: "balanced",
  fragrance: "fragrance-free",
};
const serum = (id: string, overrides: Partial<Product> = {}): Product => ({
  ...demoProducts[1],
  id,
  slug: id,
  name: id,
  ...overrides,
});
const selected = (products: Product[], input: RoutineAnswers = answers) =>
  buildRoutine(products, input).recommendations.map(({ product }) => product.id);

describe("explainable routine matching", () => {
  it("selects the requested category order for minimal, balanced and full rituals", () => {
    expect(
      buildRoutine(demoProducts, { ...answers, length: "minimal" }).recommendations.map(
        (item) => item.category,
      ),
    ).toEqual(["cleansers", "moisturizers"]);
    expect(selected(demoProducts)).toEqual([
      "stillwater-cleanser",
      "first-light-serum",
      "soft-landing-cream",
    ]);
    const full = buildRoutine(demoProducts, { ...answers, length: "full" });
    expect(full.recommendations.map((item) => item.category)).toEqual([
      "cleansers",
      "serums",
      "moisturizers",
      "oils",
    ]);
    expect(full.subtotal).toBe(17300);
    expect(full.missing).toEqual([]);
  });

  it("keeps skin-type compatibility strict even when another product scores higher", () => {
    const result = buildRoutine(demoProducts, { ...answers, skinType: "oily", length: "full" });
    expect(result.recommendations.map(({ product }) => product.id)).toEqual([
      "stillwater-cleanser",
      "first-light-serum",
      "clear-day-milk",
    ]);
    expect(result.missing).toEqual([{ category: "oils", name: "face oil" }]);
    expect(result.requestedSteps).toBe(4);
  });

  it("uses selected concern matches before editorial rank and explains those matches", () => {
    const products = [
      serum("dryness-choice", { concerns: ["dryness"], rank: 1 }),
      serum("texture-choice", { concerns: ["texture"], rank: 2 }),
    ];
    expect(selected(products)).toEqual(["dryness-choice"]);
    const result = buildRoutine(products, { ...answers, concerns: ["texture"] });
    expect(result.recommendations[0].product.id).toBe("texture-choice");
    expect(result.recommendations[0].reasons).toContain("Matches your focus: uneven texture.");
    expect(result.recommendations[0].reasons).toContain("Fragrance-free, as you requested.");
  });

  it("honors fragrance-free as a hard preference and applies the sensitivity filter independently", () => {
    const products = [
      serum("scented", { fragranceFree: false, rank: 0 }),
      serum("fragrance-free", { fragranceFree: true, rank: 9 }),
    ];
    const relaxed: RoutineAnswers = {
      ...answers,
      sensitivity: "rarely",
      fragrance: "no-preference",
    };
    expect(selected(products, relaxed)).toEqual(["scented"]);
    expect(selected(products, { ...relaxed, fragrance: "fragrance-free" })).toEqual([
      "fragrance-free",
    ]);
    expect(selected(products, { ...relaxed, sensitivity: "sometimes" })).toEqual([
      "fragrance-free",
    ]);
    expect(selected(products, { ...relaxed, sensitivity: "often" })).toEqual(["fragrance-free"]);
  });

  it("weights catalog comfort for sensitivity without inventing a clinical assessment", () => {
    const products = [
      serum("editorial-first", { concerns: [], rank: 0 }),
      serum("comfort-choice", { concerns: ["comfort"], rank: 5 }),
    ];
    const relaxed: RoutineAnswers = { ...answers, concerns: [], sensitivity: "rarely" };
    expect(selected(products, relaxed)).toEqual(["editorial-first"]);
    const cautious = buildRoutine(products, { ...relaxed, sensitivity: "often" });
    expect(cautious.recommendations[0].product.id).toBe("comfort-choice");
    expect(cautious.recommendations[0].reasons).toContain(
      "Includes skin comfort among its catalog concerns.",
    );
  });

  it("excludes draft, archived, unavailable, fully reserved, incompatible and unknown-category products", () => {
    const products = [
      serum("draft", { status: "draft", rank: -10 }),
      serum("archived", { status: "archived", rank: -10 }),
      serum("sold-out", { stock: 0, rank: -10 }),
      serum("reserved", { stock: 3, reserved: 3, rank: -10 }),
      serum("incompatible", { skinTypes: ["oily"], rank: -10 }),
      serum("unmapped", { category: "other", rank: -10 }),
      serum("invalid-stock", { stock: 2.5, rank: -10 }),
      serum("eligible", { stock: 3, reserved: 2 }),
    ];
    expect(selected(products)).toEqual(["eligible"]);
  });

  it("reports missing steps without substituting a second product from another category", () => {
    const products = demoProducts.filter((product) => product.category !== "serums");
    const result = buildRoutine(products, answers);
    expect(result.recommendations).toHaveLength(2);
    expect(result.missing).toEqual([{ category: "serums", name: "serum or essence" }]);
    expect(result.subtotal).toBe(7100);
    const empty = buildRoutine([], { ...answers, length: "full" });
    expect(empty.recommendations).toEqual([]);
    expect(empty.subtotal).toBe(0);
    expect(empty.missing).toHaveLength(4);
  });

  it("resolves ties by rank then ID regardless of input order, without mutating input", () => {
    const products = [
      serum("b", { rank: 2 }),
      serum("a", { rank: 2 }),
      serum("first", { rank: 1 }),
    ];
    const snapshot = JSON.stringify(products);
    expect(selected(products)).toEqual(["first"]);
    expect(selected([...products].reverse())).toEqual(["first"]);
    expect(selected(products.slice(0, 2))).toEqual(["a"]);
    expect(selected(products.slice(0, 2).reverse())).toEqual(["a"]);
    expect(JSON.stringify(products)).toBe(snapshot);
  });

  it("never selects a duplicate product ID and does not count duplicate concern selections twice", () => {
    const duplicate = {
      ...demoProducts[0],
      category: "serums",
      concerns: ["dryness" as const],
      rank: 0,
    };
    const result = buildRoutine([duplicate, ...demoProducts, demoProducts[1]], {
      ...answers,
      concerns: ["dryness", "dryness"],
    });
    expect(new Set(result.recommendations.map(({ product }) => product.id)).size).toBe(
      result.recommendations.length,
    );
    expect(result.recommendations.map(({ product }) => product.id)).toEqual(selected(demoProducts));
  });

  it("requires all five dimensions and rejects unknown answer values", () => {
    expect(routineAnswersSchema.safeParse({ ...answers, sensitivity: null }).success).toBe(false);
    expect(routineAnswersSchema.safeParse({ ...answers, fragrance: "anything" }).success).toBe(
      false,
    );
    expect(routineAnswersSchema.safeParse({ ...answers, concerns: ["diagnosis"] }).success).toBe(
      false,
    );
    expect(routineAnswersSchema.safeParse({ ...answers, concerns: [] }).success).toBe(true);
  });
});
