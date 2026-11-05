import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { loadEnvConfig } from "@next/env";
import { deleteApp } from "firebase-admin/app";
import { FieldPath, type Query } from "firebase-admin/firestore";
import { resolveHomeContent } from "../src/features/content/home";
import { categorySchema, productInputSchema } from "../src/lib/validation/commerce";
import { getScriptAdmin } from "./firebase-script-admin";

type IndexDefinition = {
  collectionGroup: string;
  queryScope: "COLLECTION";
  fields: { fieldPath: string; order: "ASCENDING" | "DESCENDING" }[];
};

async function main() {
  const { values } = parseArgs({
    options: { project: { type: "string" }, build: { type: "boolean", default: false } },
    strict: true,
    allowPositionals: false,
  });
  if (values.build) {
    if (!process.env.VERCEL) {
      console.info(
        "Local build: use verify:production with an explicit --project for hosted checks.",
      );
      return;
    }
    // Match Next.js production environment precedence; never read emulator files in manual mode.
    loadEnvConfig(process.cwd(), false);
  }
  const project = values.project ?? (values.build ? process.env.FIREBASE_PROJECT_ID : undefined);
  if (
    process.env.VELA_DATA_MODE !== "firebase" ||
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true" ||
    !project ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== project
  ) {
    throw new Error("Hosted verification requires matching Firebase project IDs and no emulators.");
  }
  for (const key of [
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
  ]) {
    if (!process.env[key]) throw new Error(`Missing browser authentication configuration: ${key}.`);
  }

  const { app, db } = getScriptAdmin(project);
  try {
    const { indexes } = JSON.parse(await readFile("firestore.indexes.json", "utf8")) as {
      indexes: IndexDefinition[];
    };
    const checks: { name: string; run: () => Promise<void> }[] = indexes.map((index) => ({
      name: `${index.collectionGroup}: ${index.fields.map((field) => field.fieldPath).join(", ")}`,
      async run() {
        if (index.queryScope !== "COLLECTION" || index.fields.some((field) => !field.order)) {
          throw new Error("This index shape needs an explicit readiness query.");
        }
        // Multiple sort fields exercise the real composite index, even on an empty collection.
        // A deployed definition is insufficient while its backfill is still building.
        let query: Query = db.collection(index.collectionGroup);
        for (const field of index.fields) {
          query = query.orderBy(field.fieldPath, field.order === "DESCENDING" ? "desc" : "asc");
        }
        const last = index.fields[index.fields.length - 1];
        await query
          .orderBy(FieldPath.documentId(), last.order === "DESCENDING" ? "desc" : "asc")
          .limit(1)
          .get();
      },
    }));
    checks.push({
      name: "Firebase Authentication production domain",
      async run() {
        const application = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "");
        const response = await fetch(
          `https://identitytoolkit.googleapis.com/v1/projects?key=${encodeURIComponent(process.env.NEXT_PUBLIC_FIREBASE_API_KEY!)}`,
          {
            headers: { Referer: `${application.origin}/` },
            signal: AbortSignal.timeout(15000),
          },
        );
        if (!response.ok)
          throw new Error(`Firebase Auth configuration returned ${response.status}.`);
        const configuration = (await response.json()) as {
          projectId?: string;
          authorizedDomains?: string[];
        };
        const appProjectNumber = process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.split(":")[1];
        if (configuration.projectId !== project && configuration.projectId !== appProjectNumber) {
          throw new Error("The Firebase web API key belongs to a different project.");
        }
        if (!configuration.authorizedDomains?.includes(application.hostname)) {
          throw new Error(`Authorize ${application.hostname} in Firebase Authentication settings.`);
        }
      },
    });
    checks.push({
      name: "persisted homepage settings and promotion",
      async run() {
        const [settings, promotion] = await db.getAll(
          db.doc("settings/home"),
          db.doc("promotions/home"),
        );
        const content = resolveHomeContent(settings.data(), promotion.data());
        if (
          content.featuredCategory &&
          !(await db.doc(`categories/${content.featuredCategory}`).get()).exists
        ) {
          throw new Error("The homepage references a missing featured category.");
        }
      },
    });
    checks.push({
      name: "published catalog and collections",
      async run() {
        const [products, categories] = await Promise.all([
          db
            .collection("products")
            .where("status", "==", "published")
            .orderBy("rank")
            .orderBy(FieldPath.documentId())
            .limit(200)
            .get(),
          db.collection("categories").orderBy("rank").limit(50).get(),
        ]);
        categories.docs.forEach((document) => categorySchema.strip().parse(document.data()));
        for (const document of products.docs) {
          const product = document.data();
          productInputSchema.strip().parse(product);
          if (
            product.id !== document.id ||
            product.slug !== document.id ||
            !Array.isArray(product.images) ||
            !Number.isSafeInteger(product.stock) ||
            !Number.isSafeInteger(product.reserved) ||
            product.stock < 0 ||
            product.reserved < 0 ||
            product.reserved > product.stock
          ) {
            throw new Error(`Invalid published product identity or inventory: ${document.id}.`);
          }
        }
      },
    });
    const results = await Promise.allSettled(checks.map((check) => check.run()));
    const failures: string[] = [];
    results.forEach((result, index) => {
      const name = checks[index].name;
      if (result.status === "fulfilled") console.info(`Ready: ${name}`);
      else {
        const reason = result.reason instanceof Error ? result.reason.message : "Query failed.";
        failures.push(`${name}: ${reason}`);
      }
    });
    if (failures.length) {
      throw new Error(
        `Production database is not ready:\n${failures.join("\n")}\nDeploy the committed indexes and wait for readiness. Use content:init for missing editorial configuration.`,
      );
    }
    console.info(
      `Production runtime ready: ${checks.length} checks passed in ${project}. No data was written.`,
    );
  } finally {
    await deleteApp(app);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Production verification failed.");
  process.exitCode = 1;
});
