import "server-only";
import type { Query, DocumentData } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import type { CommerceStore, Filter, QueryOptions } from "./store";

const doc = (collection: string, id: string) => {
  if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(collection) || !/^[a-zA-Z0-9_-]{1,160}$/.test(id))
    throw new Error("Invalid document path.");
  return getAdminDb().collection(collection).doc(id);
};
export const firestoreStore: CommerceStore = {
  async get<T>(collection: string, id: string) {
    const snap = await doc(collection, id).get();
    return snap.exists ? (snap.data() as T) : null;
  },
  async list<T>(collection: string, filters: Filter[] = [], options: QueryOptions = {}) {
    let query: Query<DocumentData> = getAdminDb().collection(collection);
    for (const filter of filters) query = query.where(filter.field, filter.op, filter.value);
    if (options.orderBy) query = query.orderBy(options.orderBy, options.direction || "asc");
    query = query.limit(Math.min(options.limit || 200, 1000));
    const result = await query.get();
    return result.docs.map((snap) => snap.data() as T);
  },
  async set(collection, id, value) {
    await doc(collection, id).set(value);
  },
  transaction: (work) =>
    getAdminDb().runTransaction((tx) =>
      work({
        async get<T>(collection: string, id: string) {
          const snap = await tx.get(doc(collection, id));
          return snap.exists ? (snap.data() as T) : null;
        },
        set(collection, id, value) {
          tx.set(doc(collection, id), value);
        },
        delete(collection, id) {
          tx.delete(doc(collection, id));
        },
      }),
    ),
};
