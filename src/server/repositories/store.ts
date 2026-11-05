export type Filter = {
  field: string;
  op: "==" | "<=" | ">=" | "in" | "array-contains";
  value: unknown;
};
export type QueryOptions = { orderBy?: string; direction?: "asc" | "desc"; limit?: number };
export interface TransactionStore {
  get<T>(collection: string, id: string): Promise<T | null>;
  set(collection: string, id: string, value: object): void;
  delete(collection: string, id: string): void;
}
export interface CommerceStore {
  get<T>(collection: string, id: string): Promise<T | null>;
  list<T>(collection: string, filters?: Filter[], options?: QueryOptions): Promise<T[]>;
  set(collection: string, id: string, value: object): Promise<void>;
  transaction<T>(work: (tx: TransactionStore) => Promise<T>): Promise<T>;
}
