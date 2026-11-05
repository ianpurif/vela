import { parseArgs } from "node:util";
import { deleteApp } from "firebase-admin/app";
import type { DocumentData, Firestore } from "firebase-admin/firestore";
import type { Auth, UserRecord } from "firebase-admin/auth";
import { demoCategories, demoProducts } from "../src/features/catalog/fixtures";
import { initialHomeContent, resolveHomeContent } from "../src/features/content/home";
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

/** Repair only absent editorial fields; preserve edits and reject invalid existing values. */
async function initializeHomeContent(db: Firestore) {
  return db.runTransaction(async (transaction) => {
    const settingsRef = db.doc("settings/home");
    const promotionRef = db.doc("promotions/home");
    const [settingsSnapshot, promotionSnapshot] = await transaction.getAll(
      settingsRef,
      promotionRef,
    );
    const previousSettings = settingsSnapshot.data() ?? {};
    const previousPromotion = promotionSnapshot.data() ?? {};
    const { promotionTitle, promotionText, ...fields } = initialHomeContent;
    const settingsDefaults = { id: "home", ...fields };
    const promotionDefaults = {
      id: "home",
      title: previousSettings.promotionTitle ?? promotionTitle,
      text: previousSettings.promotionText ?? promotionText,
    };
    const settingsMissing =
      previousSettings.updatedAt === undefined ||
      Object.keys(settingsDefaults).some((key) => previousSettings[key] === undefined);
    const promotionMissing =
      previousPromotion.updatedAt === undefined ||
      Object.keys(promotionDefaults).some((key) => previousPromotion[key] === undefined);
    const now = Date.now();
    const settings = {
      ...settingsDefaults,
      ...previousSettings,
      updatedAt: settingsMissing ? now : previousSettings.updatedAt,
    };
    const promotion = {
      ...promotionDefaults,
      ...previousPromotion,
      updatedAt: promotionMissing ? now : previousPromotion.updatedAt,
    };
    resolveHomeContent(settings, promotion);
    if (settingsMissing) transaction.set(settingsRef, settings, { merge: true });
    if (promotionMissing) transaction.set(promotionRef, promotion, { merge: true });
    return Number(settingsMissing) + Number(promotionMissing);
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
    searchEmail: (user.email ?? "").normalize("NFKC").trim().toLowerCase(),
    searchName: (user.displayName ?? "").normalize("NFKC").trim().toLowerCase(),
    addresses: [],
    createdAt: now,
    updatedAt: now,
  });
}

async function main() {
  const { values } = parseArgs({
    options: {
      project: { type: "string" },
      "content-only": { type: "boolean", default: false },
    },
    strict: true,
    allowPositionals: false,
  });
  const { app, db, auth, emulator, projectId } = getScriptAdmin(values.project);
  try {
    const now = Date.now();
    let created = 0;
    for (const product of values["content-only"] ? [] : demoProducts) {
      if (
        await createMissing(db, `products/${product.id}`, {
          ...product,
          createdAt: now,
          updatedAt: now,
        })
      )
        created += 1;
    }
    for (const category of values["content-only"] ? [] : demoCategories) {
      if (await createMissing(db, `categories/${category.id}`, category)) created += 1;
    }
    created += await initializeHomeContent(db);

    if (emulator && !values["content-only"]) {
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
    console.info(
      `Initialized ${created} missing or incomplete catalog/content documents in ${projectId}.`,
    );
    console.info("Existing products, categories, content, profiles, and passwords were preserved.");
  } finally {
    await deleteApp(app);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Firebase seed failed.");
  process.exitCode = 1;
});
