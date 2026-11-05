import { describe, expect, it } from "vitest";
import type { TransactionStore } from "@/server/repositories/store";
import { MemoryStore } from "./helpers/memory-store";

describe("test CommerceStore transaction semantics", () => {
  it("commits a successful transaction and returns its result", async () => {
    const store = new MemoryStore({ products: { serum: { stock: 2 } } });
    const result = await store.transaction(async (tx) => {
      const product = await tx.get<{ stock: number }>("products", "serum");
      tx.set("products", "serum", { stock: product!.stock - 1 });
      tx.set("orders", "new", { total: 4800 });
      return "new";
    });
    expect(result).toBe("new");
    expect(await store.get("products", "serum")).toEqual({ stock: 1 });
    expect(await store.get("orders", "new")).toEqual({ total: 4800 });
  });

  it("rolls back replacement, creation, and deletion when a callback fails", async () => {
    const store = new MemoryStore({ products: { serum: { stock: 2 }, cream: { stock: 4 } } });
    await expect(
      store.transaction(async (tx) => {
        tx.set("products", "serum", { stock: 0 });
        tx.set("orders", "uncommitted", { total: 4800 });
        tx.delete("products", "cream");
        throw new Error("payment preparation failed");
      }),
    ).rejects.toThrow("payment preparation failed");
    expect(await store.get("products", "serum")).toEqual({ stock: 2 });
    expect(await store.get("products", "cream")).toEqual({ stock: 4 });
    expect(await store.get("orders", "uncommitted")).toBeNull();
    await store.set("orders", "after-failure", { total: 2900 });
    expect(await store.get("orders", "after-failure")).toEqual({ total: 2900 });
  });

  it.each(["set", "delete"] as const)("rejects reads after a transaction %s", async (operation) => {
    const store = new MemoryStore({ products: { serum: { stock: 2 } } });
    await expect(
      store.transaction(async (tx) => {
        if (operation === "set") tx.set("products", "serum", { stock: 1 });
        else tx.delete("products", "serum");
        await tx.get("products", "serum");
      }),
    ).rejects.toThrow("all reads before writes");
    expect(await store.get("products", "serum")).toEqual({ stock: 2 });
  });

  it("serializes concurrent transactions without lost inventory updates", async () => {
    const store = new MemoryStore({ counts: { orders: { count: 0 } } });
    await Promise.all(
      Array.from({ length: 30 }, () =>
        store.transaction(async (tx) => {
          const current = await tx.get<{ count: number }>("counts", "orders");
          await Promise.resolve();
          tx.set("counts", "orders", { count: current!.count + 1 });
        }),
      ),
    );
    expect(await store.get("counts", "orders")).toEqual({ count: 30 });
  });

  it("serializes ordinary writes with transactions and exposes no dirty reads", async () => {
    const store = new MemoryStore({ products: { serum: { stock: 1 } } });
    let release!: () => void;
    let started!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const running = new Promise<void>((resolve) => {
      started = resolve;
    });
    const transaction = store.transaction(async (tx) => {
      tx.set("products", "serum", { stock: 2 });
      started();
      await pending;
    });
    await running;
    expect(await store.get("products", "serum")).toEqual({ stock: 1 });
    const value = { stock: 3 };
    const write = store.set("products", "serum", value);
    value.stock = 999;
    release();
    await Promise.all([transaction, write]);
    expect(await store.get("products", "serum")).toEqual({ stock: 3 });
  });

  it("does not permit a retained transaction object to mutate committed state", async () => {
    const store = new MemoryStore();
    let saved!: TransactionStore;
    await store.transaction(async (tx) => {
      saved = tx;
    });
    expect(() => saved.set("orders", "late", { total: 1 })).toThrow("already finished");
    await expect(saved.get("orders", "late")).rejects.toThrow("already finished");
    expect(await store.get("orders", "late")).toBeNull();
  });
});

describe("test CommerceStore data isolation and queries", () => {
  it("clones seeded documents, ordinary reads, and list results deeply", async () => {
    const initial = { details: { price: 4800 }, tags: ["serum"] };
    const store = new MemoryStore({ products: { serum: initial } });
    initial.details.price = 1;
    const fetched = await store.get<typeof initial>("products", "serum");
    fetched!.details.price = 2;
    const listed = await store.list<typeof initial>("products");
    listed[0].tags.push("altered");
    expect(await store.get("products", "serum")).toEqual({
      details: { price: 4800 },
      tags: ["serum"],
    });
  });

  it("clones transaction reads and writes without implicit persistence", async () => {
    const store = new MemoryStore({ products: { serum: { nested: { stock: 4 } } } });
    await store.transaction(async (tx) => {
      const fetched = await tx.get<{ nested: { stock: number } }>("products", "serum");
      fetched!.nested.stock = 999;
    });
    expect(await store.get("products", "serum")).toEqual({ nested: { stock: 4 } });
    await store.transaction(async (tx) => {
      const value = { nested: { stock: 3 } };
      tx.set("products", "serum", value);
      value.nested.stock = 999;
    });
    expect(await store.get("products", "serum")).toEqual({ nested: { stock: 3 } });
  });

  it("combines filters, ordering, and limits across nested fields", async () => {
    const store = new MemoryStore({
      products: {
        serum: {
          id: "serum",
          status: "published",
          category: "serums",
          price: 4800,
          metadata: { rank: 2 },
          concerns: ["dryness"],
        },
        cream: {
          id: "cream",
          status: "published",
          category: "moisturizers",
          price: 4200,
          metadata: { rank: 1 },
          concerns: ["dryness", "comfort"],
        },
        draft: {
          id: "draft",
          status: "draft",
          category: "serums",
          price: 1000,
          metadata: { rank: 3 },
          concerns: ["dryness"],
        },
        noRank: {
          id: "noRank",
          status: "published",
          category: "serums",
          price: 4200,
          concerns: ["dryness"],
        },
      },
    });
    const results = await store.list<{ id: string }>(
      "products",
      [
        { field: "status", op: "==", value: "published" },
        { field: "category", op: "in", value: ["serums", "moisturizers"] },
        { field: "price", op: ">=", value: 4200 },
        { field: "price", op: "<=", value: 4800 },
        { field: "concerns", op: "array-contains", value: "dryness" },
      ],
      { orderBy: "metadata.rank", direction: "desc", limit: 1 },
    );
    expect(results.map((product) => product.id)).toEqual(["serum"]);
    expect(
      (await store.list<{ id: string }>("products", [], { orderBy: "metadata.rank" })).map(
        (item) => item.id,
      ),
    ).toEqual(["cream", "serum", "draft"]);
    expect(await store.get("missing", "missing")).toBeNull();
    expect(await store.list("missing")).toEqual([]);
  });

  it("rejects invalid query limits", async () => {
    const store = new MemoryStore();
    await expect(store.list("products", [], { limit: 0 })).rejects.toThrow("positive integer");
    await expect(store.list("products", [], { limit: 1.5 })).rejects.toThrow("positive integer");
  });
  it("uses the document ID to paginate equal timestamps without repeats", async () => {
    const store = new MemoryStore({
      orders: {
        a: { id: "a", createdAt: 1 },
        b: { id: "b", createdAt: 2 },
        c: { id: "c", createdAt: 2 },
        d: { id: "d", createdAt: 3 },
      },
    });
    const first = await store.list<{ id: string; createdAt: number }>("orders", [], {
      orderBy: "createdAt",
      direction: "desc",
      limit: 2,
    });
    expect(first.map((row) => row.id)).toEqual(["d", "c"]);
    const second = await store.list<{ id: string }>("orders", [], {
      orderBy: "createdAt",
      direction: "desc",
      limit: 2,
      startAfter: { value: 2, id: "c" },
    });
    expect(second.map((row) => row.id)).toEqual(["b", "a"]);
    await expect(store.list("orders", [], { startAfter: { value: 2, id: "b" } })).rejects.toThrow(
      "ordered query",
    );
  });
});
