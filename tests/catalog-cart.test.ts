// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { demoProducts } from "@/features/catalog/fixtures";
import { catalogHref, filterProducts, parseCatalogFilters } from "@/features/catalog/filter";
import { resolveCart, sanitizeCartItems, useCart } from "@/stores/cart";

describe("catalog discovery", () => {
  it("combines search, category and concern without changing source products", () => {
    const originals = demoProducts.map((product) => product.id);
    const filtered = filterProducts(
      demoProducts,
      parseCatalogFilters({
        q: "glycerin",
        category: "serums",
        concern: "dryness",
        sort: "price-asc",
      }),
    );
    expect(filtered.map((product) => product.name)).toEqual([
      "Dewpoint Essence",
      "First Light Serum",
    ]);
    expect(demoProducts.map((product) => product.id)).toEqual(originals);
  });

  it("searches case-insensitively, requires each search term, and excludes unpublished products", () => {
    const products = [
      ...demoProducts,
      { ...demoProducts[0], id: "draft", name: "First Light Draft", status: "draft" as const },
    ];
    expect(
      filterProducts(products, parseCatalogFilters({ q: " FIRST   LIGHT " })).map(
        (product) => product.id,
      ),
    ).toEqual(["first-light-serum"]);
    expect(
      filterProducts(products, parseCatalogFilters({ q: "first unlikelyingredient" })),
    ).toEqual([]);
  });

  it("availability accounts for active reservations", () => {
    const products = [
      { ...demoProducts[0], stock: 2, reserved: 2 },
      { ...demoProducts[1], stock: 3, reserved: 2 },
    ];
    expect(
      filterProducts(products, parseCatalogFilters({ available: "1" })).map(
        (product) => product.id,
      ),
    ).toEqual([demoProducts[1].id]);
  });

  it("validates URL options and preserves filters when changing a category", () => {
    expect(parseCatalogFilters({ sort: "toString", concern: "__proto__", q: ["a", "b"] })).toEqual({
      q: "",
      category: "",
      concern: "",
      sort: "featured",
      available: false,
    });
    const filters = parseCatalogFilters({
      q: "light serum",
      concern: "dryness",
      available: "1",
      sort: "price-desc",
    });
    const query = new URL(catalogHref(filters, { category: "serums" }), "https://vela.example")
      .searchParams;
    expect(Object.fromEntries(query)).toEqual({
      q: "light serum",
      category: "serums",
      concern: "dryness",
      sort: "price-desc",
      available: "1",
    });
    expect(catalogHref(parseCatalogFilters({}))).toBe("/shop");
  });
});

describe("persistent shopping bag", () => {
  beforeEach(() => {
    localStorage.clear();
    useCart.setState({ items: [], open: false });
  });

  it("rejects malformed stored rows, drops supplied prices, and bounds duplicate quantities", () => {
    expect(
      sanitizeCartItems([
        { productId: "serum", quantity: 8, price: 1 },
        { productId: "serum", quantity: 8 },
        { productId: "../users/admin", quantity: 1 },
        { productId: "oil", quantity: -1 },
        { productId: "milk", quantity: "2" },
        { productId: "cream", quantity: 1.5 },
        null,
      ]),
    ).toEqual([{ productId: "serum", quantity: 10 }]);
    expect(sanitizeCartItems({ productId: "serum", quantity: 1 })).toEqual([]);
    expect(
      sanitizeCartItems(
        Array.from({ length: 30 }, (_, i) => ({ productId: `product-${i}`, quantity: 1 })),
      ),
    ).toHaveLength(20);
  });

  it("adds, bounds, updates and removes lines while persisting only IDs and quantities", () => {
    useCart.getState().add("first-light-serum", 8);
    useCart.getState().add("first-light-serum", 5);
    expect(useCart.getState().items).toEqual([{ productId: "first-light-serum", quantity: 10 }]);
    useCart.getState().setQuantity("first-light-serum", 2);
    useCart.getState().setQuantity("first-light-serum", -4);
    useCart.getState().setOpen(true);
    expect(JSON.parse(localStorage.getItem("vela-bag-v1") ?? "{}")).toEqual({
      state: { items: [{ productId: "first-light-serum", quantity: 2 }] },
      version: 1,
    });
    useCart.getState().remove("first-light-serum");
    expect(useCart.getState().items).toEqual([]);
  });

  it("rehydrates saved contents without restoring injected actions or dialog state", async () => {
    localStorage.setItem(
      "vela-bag-v1",
      JSON.stringify({
        version: 1,
        state: {
          items: [{ productId: "first-light-serum", quantity: 3 }],
          open: true,
          clear: "tampered",
        },
      }),
    );
    await useCart.persist.rehydrate();
    expect(useCart.getState().items).toEqual([{ productId: "first-light-serum", quantity: 3 }]);
    expect(useCart.getState().open).toBe(false);
    expect(typeof useCart.getState().clear).toBe("function");
    useCart.getState().clear();
    expect(useCart.getState().items).toEqual([]);
  });

  it("recovers from corrupted storage instead of leaving the bag in a loading state", async () => {
    localStorage.setItem("vela-bag-v1", "{not-valid-json");
    await useCart.persist.rehydrate();
    expect(useCart.persist.hasHydrated()).toBe(true);
    expect(useCart.getState().items).toEqual([]);
    useCart.getState().add("first-light-serum");
    expect(useCart.getState().items).toEqual([{ productId: "first-light-serum", quantity: 1 }]);
  });

  it("calculates prices from catalog products and blocks unavailable or reserved stock", () => {
    const cart = resolveCart([{ productId: "first-light-serum", quantity: 2 }], demoProducts);
    expect(cart.subtotal).toBe(9600);
    expect(cart.shipping).toBe(0);
    expect(cart.unavailable).toBe(false);
    expect(
      resolveCart(
        [{ productId: "first-light-serum", quantity: 2 }],
        [{ ...demoProducts[1], stock: 2, reserved: 1 }],
      ).unavailable,
    ).toBe(true);
    expect(
      resolveCart([{ productId: "removed-product", quantity: 1 }], demoProducts).unavailable,
    ).toBe(true);
  });
});
