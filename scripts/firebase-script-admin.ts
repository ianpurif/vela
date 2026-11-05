import { cert, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export const emulatorProjectId = "demo-vela";

/** CLI-only bootstrap. Never import this module into the application bundle. */
export function getScriptAdmin(explicitProject: string | undefined) {
  const configuredProject = process.env.FIREBASE_PROJECT_ID;
  if (!configuredProject || !explicitProject || explicitProject !== configuredProject) {
    throw new Error("Pass --project matching the configured FIREBASE_PROJECT_ID.");
  }
  if (!/^[a-z][a-z0-9-]{4,62}$/.test(configuredProject)) {
    throw new Error("FIREBASE_PROJECT_ID has an invalid format.");
  }

  const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const hasEmulatorSetting = Boolean(firestoreHost || authHost);
  const emulator =
    configuredProject === emulatorProjectId &&
    firestoreHost === "127.0.0.1:8080" &&
    authHost === "127.0.0.1:9099" &&
    !process.env.VERCEL;
  if (hasEmulatorSetting && !emulator) {
    throw new Error(
      "Emulator scripts require demo-vela, both exact loopback emulator hosts, and a non-Vercel environment.",
    );
  }
  if (configuredProject.startsWith("demo-") && !emulator) {
    throw new Error("A demo project must use the isolated local emulator configuration.");
  }

  let app: App;
  if (emulator) {
    app = initializeApp({ projectId: configuredProject }, "vela-cli");
  } else {
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (!clientEmail || !privateKey) {
      throw new Error("Set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY for this project.");
    }
    app = initializeApp(
      {
        projectId: configuredProject,
        credential: cert({
          projectId: configuredProject,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, "\n"),
        }),
      },
      "vela-cli",
    );
  }
  return {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
    projectId: configuredProject,
    emulator,
  };
}
