import { isDeepStrictEqual } from "node:util";
import type {
  CommerceStore,
  Filter,
  QueryOptions,
  TransactionStore,
} from "@/server/repositories/store";

type StoredDocument = object;
type Collections = Map<string, Map<string, StoredDocument>>;
export type MemoryStoreSeed = Record<string, Record<string, StoredDocument>>;

function fieldValue(document: object, field: string): unknown {
  let value: unknown = document;
  for (const part of field.split(".")) {
    if (value === null || typeof value !== "object" || !Object.hasOwn(value, part)) {
      return undefined;
    }
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}

function compare(left: unknown, right: unknown): number {
  if (isDeepStrictEqual(left, right)) return 0;
  if (left === null) return -1;
  if (right === null) return 1;
  if (left instanceof Date && right instanceof Date) return left.getTime() - right.getTime();
  if (typeof left === "number" && typeof right === "number") return left - right;
  if (typeof left === "boolean" && typeof right === "boolean") return Number(left) - Number(right);
  if (typeof left === "string" && typeof right === "string") return left < right ? -1 : 1;
  throw new Error("MemoryStore ordering supports matching scalar types and Date values only.");
}

function matches(document: object, filter: Filter): boolean {
  const actual = fieldValue(document, filter.field);
  if (actual === undefined) return false;
  switch (filter.op) {
    case "==":
      return isDeepStrictEqual(actual, filter.value);
    case "<=":
      return compare(actual, filter.value) <= 0;
    case ">=":
      return compare(actual, filter.value) >= 0;
    case "in":
      if (!Array.isArray(filter.value)) throw new Error("An 'in' filter requires an array.");
      return filter.value.some((item) => isDeepStrictEqual(actual, item));
    case "array-contains":
      return Array.isArray(actual) && actual.some((item) => isDeepStrictEqual(item, filter.value));
  }
}

function put(collections: Collections, collection: string, id: string, value: object) {
  let documents = collections.get(collection);
  if (!documents) {
    documents = new Map();
    collections.set(collection, documents);
  }
  documents.set(id, structuredClone(value));
}

/**
 * Test-only implementation of the repository contract. Mutations serialize;
 * transactions commit an isolated snapshot only after their callback succeeds.
 * It deliberately rejects reads after writes, like Firestore transactions.
 */
export class MemoryStore implements CommerceStore {
  private collections: Collections = new Map();
  private tail: Promise<void> = Promise.resolve();

  constructor(seed: MemoryStoreSeed = {}) {
    for (const [collection, documents] of Object.entries(seed)) {
      for (const [id, value] of Object.entries(documents)) {
        put(this.collections, collection, id, value);
      }
    }
  }

  async get<T>(collection: string, id: string): Promise<T | null> {
    const document = this.collections.get(collection)?.get(id);
    return document === undefined ? null : (structuredClone(document) as T);
  }

  async list<T>(
    collection: string,
    filters: Filter[] = [],
    options: QueryOptions = {},
  ): Promise<T[]> {
    if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit < 1)) {
      throw new Error("A query limit must be a positive integer.");
    }
    const rows = [...(this.collections.get(collection)?.entries() ?? [])].filter(([, value]) => {
      if (options.orderBy && fieldValue(value, options.orderBy) === undefined) return false;
      return filters.every((filter) => matches(value, filter));
    });
    const direction = options.direction === "desc" ? -1 : 1;
    rows.sort(([leftId, left], [rightId, right]) => {
      const comparison = options.orderBy
        ? compare(fieldValue(left, options.orderBy), fieldValue(right, options.orderBy))
        : 0;
      return (comparison || compare(leftId, rightId)) * direction;
    });
    return rows.slice(0, options.limit).map(([, value]) => structuredClone(value) as T);
  }

  async set(collection: string, id: string, value: object): Promise<void> {
    // Clone before waiting for the queue: callers may mutate their input meanwhile.
    const snapshot = structuredClone(value);
    await this.exclusive(async () => {
      put(this.collections, collection, id, snapshot);
    });
  }

  async transaction<T>(work: (tx: TransactionStore) => Promise<T>): Promise<T> {
    return this.exclusive(async () => {
      const snapshot = structuredClone(this.collections);
      let written = false;
      let active = true;
      const assertActive = () => {
        if (!active) throw new Error("This transaction has already finished.");
      };
      const tx: TransactionStore = {
        get: async <Document>(collection: string, id: string) => {
          assertActive();
          if (written) throw new Error("Firestore transactions require all reads before writes.");
          const value = snapshot.get(collection)?.get(id);
          return value === undefined ? null : (structuredClone(value) as Document);
        },
        set: (collection, id, value) => {
          assertActive();
          written = true;
          put(snapshot, collection, id, value);
        },
        delete: (collection, id) => {
          assertActive();
          written = true;
          snapshot.get(collection)?.delete(id);
        },
      };
      try {
        const result = await work(tx);
        this.collections = snapshot;
        return result;
      } finally {
        active = false;
      }
    });
  }

  private async exclusive<T>(work: () => Promise<T>): Promise<T> {
    const preceding = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await preceding;
    try {
      return await work();
    } finally {
      release();
    }
  }
}

export { MemoryStore as MemoryCommerceStore };
