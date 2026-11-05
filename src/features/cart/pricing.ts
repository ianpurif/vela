export const FREE_SHIPPING_THRESHOLD = 7500;
export const STANDARD_SHIPPING = 600;
/** All values are integer USD cents; the server recalculates this from stored products. */
export function calculateTotals(lines: { unitPrice: number; quantity: number }[]) {
  const subtotal = lines.reduce((sum, line) => {
    if (
      !Number.isSafeInteger(line.unitPrice) ||
      line.unitPrice < 0 ||
      !Number.isSafeInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > 10
    )
      throw new Error("Invalid price or quantity.");
    return sum + line.unitPrice * line.quantity;
  }, 0);
  if (!Number.isSafeInteger(subtotal)) throw new Error("Order total is too large.");
  const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING;
  return { subtotal, shipping, total: subtotal + shipping };
}
