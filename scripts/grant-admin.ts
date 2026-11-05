import { parseArgs } from "node:util";
import { deleteApp } from "firebase-admin/app";
import { getScriptAdmin } from "./firebase-script-admin";

async function main() {
  const { values } = parseArgs({
    options: {
      project: { type: "string" },
      uid: { type: "string" },
      email: { type: "string" },
    },
    strict: true,
    allowPositionals: false,
  });
  if (Boolean(values.uid) === Boolean(values.email)) {
    throw new Error("Pass exactly one of --uid or --email for an existing Firebase user.");
  }
  const { app, auth, db, projectId } = getScriptAdmin(values.project);
  try {
    const user = values.uid
      ? await auth.getUser(values.uid)
      : await auth.getUserByEmail(values.email!);
    if (user.disabled)
      throw new Error("Cannot assign administrator privileges to a disabled user.");
    if (!user.emailVerified) {
      throw new Error(
        "The target user must verify their email before receiving administrator privileges.",
      );
    }
    console.info(`Granting administrator access to uid ${user.uid} in project ${projectId}.`);
    await auth.setCustomUserClaims(user.uid, { ...user.customClaims, admin: true });
    await auth.revokeRefreshTokens(user.uid);
    const audit = db.collection("auditLogs").doc();
    await audit.create({
      id: audit.id,
      actorId: "bootstrap-cli",
      action: "admin.claim.granted",
      entityId: user.uid,
      details: { projectId, previousAdmin: user.customClaims?.admin === true },
      createdAt: Date.now(),
    });
    console.info("Administrator claim assigned. Existing sessions revoked; sign in again.");
  } finally {
    await deleteApp(app);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Administrator assignment failed.");
  process.exitCode = 1;
});
