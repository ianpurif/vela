import { parseArgs } from "node:util";
import { deleteApp } from "firebase-admin/app";
import type { DocumentData, Firestore } from "firebase-admin/firestore";
import type { Auth, UserRecord } from "firebase-admin/auth";
import { demoCategories, demoProducts, defaultContent } from "../src/features/catalog/fixtures";
import { getScriptAdmin } from "./firebase-script-admin";

/** create() and the preceding read share a transaction, preserving concurrent edits. */
async function createMissing(db: Firestore, path: string, data: DocumentData) {
  return db.runTransaction(async (transaction) => {
    const ref = db.doc(path);
    if ((await transaction.get(ref)).exists) return false;
    transaction.create(ref, data);
    return true;
  });
}

async function createEmulatorUser(auth: Auth, email: string, uid: string, name: string) {
  try {
    return { user: await auth.getUserByEmail(email), created: false };
  } catch (error) {
    if ((error as { code?: string }).code !== "auth/user-not-found") throw error;
    const user = await auth.createUser({
      uid,
      email,
      displayName: name,
      emailVerified: true,
      password: "Vela-local-2026!",
    });
    return { user, created: true };
  }
}

async function seedProfile(db: Firestore, user: UserRecord, now: number) {
  return createMissing(db, `users/${user.uid}`, {
    id: user.uid,
    email: user.email ?? "",
    name: user.displayName ?? "",
    addresses: [],
    createdAt: now,
    updatedAt: now,
  });
}

async function main() {
  const { values } = parseArgs({
    options: { project: { type: "string" } },
    strict: true,
    allowPositionals: false,
  });
  const { app, db, auth, emulator, projectId } = getScriptAdmin(values.project);
  try {
    const now = Date.now();
    let created = 0;
    for (const product of demoProducts) {
      if (
        await createMissing(db, `products/${product.id}`, {
          ...product,
          createdAt: now,
          updatedAt: now,
        })
      )
        created += 1;
    }
    for (const category of demoCategories) {
      if (await createMissing(db, `categories/${category.id}`, category)) created += 1;
    }
    if (await createMissing(db, "settings/home", { ...defaultContent, updatedAt: now })) {
      created += 1;
    }

    if (emulator) {
      // This branch is reachable only after strict host/project/VERCEL validation.
      const customer = await createEmulatorUser(
        auth,
        "customer@example.test",
        "vela-customer",
        "VELA Customer",
      );
      const admin = await createEmulatorUser(
        auth,
        "admin@example.test",
        "vela-admin",
        "VELA Administrator",
      );
      // Existing accounts retain all claims. Explicit grant-admin handles changes.
      if (admin.created) {
        await auth.setCustomUserClaims(admin.user.uid, {
          ...admin.user.customClaims,
          admin: true,
        });
      }
      await seedProfile(db, customer.user, now);
      await seedProfile(db, admin.user, now);
      console.info("Local fixture accounts are available; see docs/FIREBASE.md.");
    }
    console.info(`Seeded ${created} missing catalog/content documents in ${projectId}.`);
    console.info("Existing products, categories, content, profiles, and passwords were preserved.");
  } finally {
    await deleteApp(app);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Firebase seed failed.");
  process.exitCode = 1;
});
