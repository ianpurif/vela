import type { CartItem, Product } from "@/types/commerce";

export type RoutineCartResult =
  | { ok: true; items: CartItem[]; added: number }
  | {
      ok: false;
      code:
        | "EMPTY_ROUTINE"
        | "INVALID_ROUTINE"
        | "INVALID_CART"
        | "LINE_LIMIT"
        | "QUANTITY_LIMIT"
        | "UNAVAILABLE";
      message: string;
    };
const validId = /^[a-zA-Z0-9_-]{1,120}$/;

/** Validate the complete batch first; never cap, skip, or partially add a routine. */
export function prepareRoutineCart(
  current: readonly CartItem[],
  products: readonly Product[],
): RoutineCartResult {
  if (products.length === 0)
    return { ok: false, code: "EMPTY_ROUTINE", message: "There are no products to add yet." };
  if (
    products.length > 4 ||
    new Set(products.map((product) => product.id)).size !== products.length ||
    products.some((product) => !validId.test(product.id))
  ) {
    return {
      ok: false,
      code: "INVALID_ROUTINE",
      message: "Refresh your ritual before adding it to the bag.",
    };
  }
  if (
    current.length > 20 ||
    new Set(current.map((item) => item.productId)).size !== current.length ||
    current.some(
      (item) =>
        !validId.test(item.productId) ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 10,
    )
  ) {
    return {
      ok: false,
      code: "INVALID_CART",
      message: "Review your bag before adding this ritual. Nothing has been added.",
    };
  }
  const quantities = new Map(current.map((item) => [item.productId, item.quantity]));
  for (const product of products) {
    const quantity = (quantities.get(product.id) ?? 0) + 1;
    if (quantity > 10)
      return {
        ok: false,
        code: "QUANTITY_LIMIT",
        message: `${product.name} would exceed the limit of 10 per product. Adjust your bag first; nothing has been added.`,
      };
    if (
      product.status !== "published" ||
      !Number.isInteger(product.stock) ||
      !Number.isInteger(product.reserved) ||
      product.stock < 0 ||
      product.reserved < 0 ||
      quantity > product.stock - product.reserved
    ) {
      return {
        ok: false,
        code: "UNAVAILABLE",
        message: `There is not enough available stock for ${product.name} and the quantity already in your bag. Nothing has been added.`,
      };
    }
    quantities.set(product.id, quantity);
  }
  if (quantities.size > 20)
    return {
      ok: false,
      code: "LINE_LIMIT",
      message:
        "Your bag can hold 20 different products. Make room for the whole ritual first; nothing has been added.",
    };
  return {
    ok: true,
    items: [...quantities].map(([productId, quantity]) => ({ productId, quantity })),
    added: products.length,
  };
}
