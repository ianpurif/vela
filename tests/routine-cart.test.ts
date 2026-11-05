// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { demoProducts } from "@/features/catalog/fixtures";
import { prepareRoutineCart } from "@/features/routine/cart";
import { useCart } from "@/stores/cart";

const routine = demoProducts.slice(0, 3);
describe("atomic routine-to-cart", () => {
  beforeEach(() => {
    localStorage.clear();
    useCart.setState({ items: [], open: false });
  });

  it("adds one of each in one state change, preserving existing lines and persisting only IDs/quantities", () => {
    useCart.setState({
      items: [
        { productId: routine[0].id, quantity: 2 },
        { productId: "another-product", quantity: 1 },
      ],
    });
    let writes = 0;
    const unsubscribe = useCart.subscribe((state, previous) => {
      if (state.items !== previous.items) writes += 1;
    });
    const result = useCart.getState().addRoutine(routine);
    unsubscribe();
    expect(result.ok).toBe(true);
    expect(writes).toBe(1);
    expect(useCart.getState().items).toEqual([
      { productId: routine[0].id, quantity: 3 },
      { productId: "another-product", quantity: 1 },
      { productId: routine[1].id, quantity: 1 },
      { productId: routine[2].id, quantity: 1 },
    ]);
    expect(JSON.parse(localStorage.getItem("vela-bag-v1")!).state).toEqual({
      items: useCart.getState().items,
    });
  });

  it("rolls back the entire batch when a later product would exceed the quantity limit", () => {
    const before = [{ productId: routine[1].id, quantity: 10 }];
    useCart.setState({ items: before });
    let writes = 0;
    const unsubscribe = useCart.subscribe(() => {
      writes += 1;
    });
    expect(useCart.getState().addRoutine(routine)).toMatchObject({
      ok: false,
      code: "QUANTITY_LIMIT",
    });
    unsubscribe();
    expect(useCart.getState().items).toBe(before);
    expect(writes).toBe(0);
  });

  it("accounts for existing bag quantities and reservations without partially adding available products", () => {
    const products = [routine[0], { ...routine[1], stock: 3, reserved: 2 }];
    useCart.setState({ items: [{ productId: routine[1].id, quantity: 1 }] });
    expect(useCart.getState().addRoutine(products)).toMatchObject({
      ok: false,
      code: "UNAVAILABLE",
    });
    expect(useCart.getState().items).toEqual([{ productId: routine[1].id, quantity: 1 }]);
  });

  it("rejects an entire routine if it would exceed the 20-line bag limit", () => {
    const current = Array.from({ length: 19 }, (_, index) => ({
      productId: `existing-${index}`,
      quantity: 1,
    }));
    useCart.setState({ items: current });
    expect(useCart.getState().addRoutine(routine)).toMatchObject({ ok: false, code: "LINE_LIMIT" });
    expect(useCart.getState().items).toBe(current);
  });

  it("rejects unpublished, empty, duplicate, invalid and oversized batches", () => {
    expect(prepareRoutineCart([], [{ ...routine[0], status: "archived" }])).toMatchObject({
      ok: false,
      code: "UNAVAILABLE",
    });
    expect(prepareRoutineCart([], [])).toMatchObject({ ok: false, code: "EMPTY_ROUTINE" });
    expect(prepareRoutineCart([], [routine[0], routine[0]])).toMatchObject({
      ok: false,
      code: "INVALID_ROUTINE",
    });
    expect(prepareRoutineCart([], [{ ...routine[0], id: "../orders" }])).toMatchObject({
      ok: false,
      code: "INVALID_ROUTINE",
    });
    expect(prepareRoutineCart([], demoProducts)).toMatchObject({
      ok: false,
      code: "INVALID_ROUTINE",
    });
    expect(prepareRoutineCart([{ productId: routine[0].id, quantity: 11 }], routine)).toMatchObject(
      { ok: false, code: "INVALID_CART" },
    );
  });

  it("checks current store state at commit time, even if an earlier preview allowed the routine", () => {
    useCart.setState({ items: [{ productId: routine[0].id, quantity: 9 }] });
    expect(prepareRoutineCart(useCart.getState().items, routine).ok).toBe(true);
    useCart.getState().setQuantity(routine[0].id, 10);
    expect(useCart.getState().addRoutine(routine)).toMatchObject({
      ok: false,
      code: "QUANTITY_LIMIT",
    });
    expect(useCart.getState().items).toEqual([{ productId: routine[0].id, quantity: 10 }]);
  });

  it("allows exact limits and does not mutate either source array", () => {
    const current = [{ productId: routine[0].id, quantity: 9 }];
    const product = { ...routine[0], stock: 11, reserved: 1 };
    const result = prepareRoutineCart(current, [product]);
    expect(result).toEqual({
      ok: true,
      items: [{ productId: routine[0].id, quantity: 10 }],
      added: 1,
    });
    expect(current).toEqual([{ productId: routine[0].id, quantity: 9 }]);
    expect(product.stock).toBe(11);
  });
});
