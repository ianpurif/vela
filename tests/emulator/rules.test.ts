import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let environment: RulesTestEnvironment;

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: "demo-vela-rules",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, "products/published"), { status: "published", price: 2900 }),
      setDoc(doc(db, "products/draft"), { status: "draft", price: 2900 }),
      setDoc(doc(db, "products/archived"), { status: "archived", price: 2900 }),
      setDoc(doc(db, "categories/cleansers"), { name: "Cleansers" }),
      setDoc(doc(db, "settings/home"), { heroTitle: "Good skin." }),
      setDoc(doc(db, "settings/private"), { internal: true }),
      setDoc(doc(db, "users/alice"), { id: "alice", name: "Alice", role: "admin", admin: true }),
      setDoc(doc(db, "users/bob"), { id: "bob", name: "Bob" }),
      setDoc(doc(db, "orders/alice-order"), { userId: "alice", paymentStatus: "paid" }),
      setDoc(doc(db, "orders/bob-order"), { userId: "bob", paymentStatus: "pending" }),
      setDoc(doc(db, "auditLogs/example"), { actorId: "admin" }),
      setDoc(doc(db, "inventoryReservations/example"), { status: "active" }),
      setDoc(doc(db, "stripeWebhookEvents/example"), { type: "checkout.session.completed" }),
      setDoc(doc(db, "rateLimits/example"), { count: 1 }),
      setDoc(doc(db, "media/example"), { publicId: "vela/products/example" }),
      setDoc(doc(db, "promotions/example"), { internal: true }),
    ]);
  });
});

afterAll(async () => {
  await environment?.cleanup();
});

describe("public catalog access", () => {
  it("allows published product documents and constrained catalog queries", async () => {
    const db = environment.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, "products/published")));
    const result = await assertSucceeds(
      getDocs(query(collection(db, "products"), where("status", "==", "published"))),
    );
    expect(result.docs.map((item) => item.id)).toEqual(["published"]);
  });

  it("denies draft, archived, and unconstrained product reads", async () => {
    const db = environment.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "products/draft")));
    await assertFails(getDoc(doc(db, "products/archived")));
    await assertFails(getDocs(collection(db, "products")));
  });

  it("exposes categories and only the public homepage setting", async () => {
    const db = environment.unauthenticatedContext().firestore();
    await assertSucceeds(getDocs(collection(db, "categories")));
    await assertSucceeds(getDoc(doc(db, "settings/home")));
    await assertFails(getDoc(doc(db, "settings/private")));
    await assertFails(getDocs(collection(db, "settings")));
  });
});

describe("customer isolation", () => {
  it("rejects anonymous profile and order reads", async () => {
    const db = environment.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "users/alice")));
    await assertFails(getDocs(collection(db, "users")));
    await assertFails(getDoc(doc(db, "orders/alice-order")));
  });

  it("allows only the customer's own profile and own constrained profile query", async () => {
    const db = environment.authenticatedContext("alice").firestore();
    await assertSucceeds(getDoc(doc(db, "users/alice")));
    await assertSucceeds(
      getDocs(query(collection(db, "users"), where(documentId(), "==", "alice"))),
    );
    await assertFails(getDoc(doc(db, "users/bob")));
    await assertFails(getDocs(collection(db, "users")));
  });

  it("requires an ownership filter on order queries", async () => {
    const db = environment.authenticatedContext("alice").firestore();
    await assertSucceeds(getDoc(doc(db, "orders/alice-order")));
    const ownOrders = await assertSucceeds(
      getDocs(query(collection(db, "orders"), where("userId", "==", "alice"))),
    );
    expect(ownOrders.docs.map((order) => order.id)).toEqual(["alice-order"]);
    await assertFails(getDoc(doc(db, "orders/bob-order")));
    await assertFails(getDocs(collection(db, "orders")));
    await assertFails(getDocs(query(collection(db, "orders"), where("userId", "==", "bob"))));
  });

  it("rejects profile self-promotion and direct order payment changes", async () => {
    const db = environment.authenticatedContext("alice").firestore();
    await assertFails(updateDoc(doc(db, "users/alice"), { admin: true }));
    await assertFails(updateDoc(doc(db, "users/alice"), { name: "Changed" }));
    await assertFails(setDoc(doc(db, "users/new-user"), { admin: true }));
    await assertFails(updateDoc(doc(db, "orders/alice-order"), { paymentStatus: "paid" }));
    await assertFails(setDoc(doc(db, "orders/forged"), { userId: "alice", paymentStatus: "paid" }));
  });

  it("does not trust a string admin claim or a profile role", async () => {
    const db = environment.authenticatedContext("alice", { admin: "true" }).firestore();
    await assertFails(getDoc(doc(db, "products/draft")));
    await assertFails(getDoc(doc(db, "users/bob")));
  });
});

describe("administrator boundaries", () => {
  it("allows verified administrator claims to read operational records", async () => {
    const db = environment.authenticatedContext("admin", { admin: true }).firestore();
    await assertSucceeds(getDocs(collection(db, "products")));
    await assertSucceeds(getDocs(collection(db, "users")));
    await assertSucceeds(getDocs(collection(db, "orders")));
    await assertSucceeds(getDocs(collection(db, "settings")));
    await assertSucceeds(getDoc(doc(db, "auditLogs/example")));
  });

  it("keeps every browser mutation server-only, including administrators", async () => {
    const db = environment.authenticatedContext("admin", { admin: true }).firestore();
    await assertFails(updateDoc(doc(db, "products/published"), { stock: 999 }));
    await assertFails(setDoc(doc(db, "products/new-product"), { status: "published" }));
    await assertFails(deleteDoc(doc(db, "products/draft")));
    await assertFails(setDoc(doc(db, "categories/new"), { name: "New" }));
    await assertFails(updateDoc(doc(db, "settings/home"), { heroTitle: "Changed" }));
    await assertFails(updateDoc(doc(db, "orders/bob-order"), { paymentStatus: "paid" }));
    await assertFails(updateDoc(doc(db, "users/alice"), { admin: true }));
    await assertFails(setDoc(doc(db, "auditLogs/new"), { action: "forged" }));
  });

  it.each([
    "inventoryReservations",
    "stripeWebhookEvents",
    "rateLimits",
    "media",
    "promotions",
    "unlistedCollection",
  ])("denies client access to %s even for administrators", async (name) => {
    const db = environment.authenticatedContext("admin", { admin: true }).firestore();
    await assertFails(getDoc(doc(db, `${name}/example`)));
    await assertFails(getDocs(collection(db, name)));
    await assertFails(setDoc(doc(db, `${name}/example`), { forged: true }));
  });

  it("hides audit logs from customers", async () => {
    const db = environment.authenticatedContext("alice").firestore();
    await assertFails(getDoc(doc(db, "auditLogs/example")));
    await assertFails(getDocs(collection(db, "auditLogs")));
  });
});
