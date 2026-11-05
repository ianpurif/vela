import { describe, expect, it } from "vitest";
import { calculateTotals } from "@/features/cart/pricing";
import { cartSchema, productInputSchema } from "@/lib/validation/commerce";
import { demoProducts } from "@/features/catalog/fixtures";

describe("commerce contracts", () => {
  it("computes exact cents at the shipping threshold", () => {
    expect(calculateTotals([{ unitPrice: 2900, quantity: 1 }])).toEqual({
      subtotal: 2900,
      shipping: 600,
      total: 3500,
    });
    expect(calculateTotals([{ unitPrice: 7500, quantity: 1 }])).toEqual({
      subtotal: 7500,
      shipping: 0,
      total: 7500,
    });
    expect(calculateTotals([]).total).toBe(0);
    expect(() => calculateTotals([{ unitPrice: 12.5, quantity: 1 }])).toThrow();
  });
  it("rejects tampered cart prices, duplicate lines and unbounded quantities", () => {
    expect(cartSchema.safeParse([{ productId: "serum", quantity: 1, price: 1 }]).success).toBe(
      false,
    );
    expect(
      cartSchema.safeParse([
        { productId: "serum", quantity: 1 },
        { productId: "serum", quantity: 1 },
      ]).success,
    ).toBe(false);
    expect(cartSchema.safeParse([{ productId: "serum", quantity: 11 }]).success).toBe(false);
  });
  it("seeded products satisfy the same editing contract as Firestore products", () => {
    for (const product of demoProducts) {
      const input = Object.fromEntries(
        Object.keys(productInputSchema.shape).map((key) => [key, product[key as keyof typeof product]]),
      );
      expect(productInputSchema.safeParse(input).success, product.name).toBe(true);
    }
  });
});
