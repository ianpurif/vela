import { parseArgs } from "node:util";
import { deleteApp } from "firebase-admin/app";
import { FieldPath, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { getScriptAdmin } from "./firebase-script-admin";

async function main() {
  const { values } = parseArgs({
    options: { project: { type: "string" }, apply: { type: "boolean", default: false } },
    strict: true,
    allowPositionals: false,
  });
  const { app, db, projectId } = getScriptAdmin(values.project);
  let inspected = 0;
  let changed = 0;
  let skipped = 0;
  let cursor: QueryDocumentSnapshot | undefined;
  try {
    for (;;) {
      const base = db.collection("users").orderBy(FieldPath.documentId()).limit(200);
      const page = await (cursor ? base.startAfter(cursor) : base).get();
      if (page.empty) break;
      for (const document of page.docs) {
        inspected += 1;
        const row = document.data();
        if (typeof row.name !== "string" || typeof row.email !== "string") {
          skipped += 1;
          continue;
        }
        const expected = {
          searchName: row.name.normalize("NFKC").trim().toLowerCase(),
          searchEmail: row.email.normalize("NFKC").trim().toLowerCase(),
        };
        if (row.searchName === expected.searchName && row.searchEmail === expected.searchEmail)
          continue;
        if (!values.apply) {
          changed += 1;
          continue;
        }
        const updated = await db.runTransaction(async (tx) => {
          const latest = await tx.get(document.ref);
          const current = latest.data();
          if (!current || typeof current.name !== "string" || typeof current.email !== "string")
            return false;
          const searchName = current.name.normalize("NFKC").trim().toLowerCase();
          const searchEmail = current.email.normalize("NFKC").trim().toLowerCase();
          if (current.searchName === searchName && current.searchEmail === searchEmail)
            return false;
          tx.update(document.ref, { searchName, searchEmail });
          return true;
        });
        if (updated) changed += 1;
      }
      cursor = page.docs.at(-1);
    }
    console.info(
      `${values.apply ? "Updated" : "Would update"} ${changed} customer search records in ${projectId}; inspected ${inspected}, invalid profiles skipped ${skipped}.`,
    );
    if (!values.apply)
      console.info(
        "Dry run only. Pass --apply with the same explicit --project to write search fields.",
      );
    if (skipped) process.exitCode = 1;
  } finally {
    await deleteApp(app);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Customer search backfill failed.");
  process.exitCode = 1;
});
