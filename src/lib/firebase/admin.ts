import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { AppError } from "@/lib/errors";

function adminApp() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId || process.env.VELA_DATA_MODE !== "firebase")
    throw new AppError(
      503,
      "Firebase is not configured. Account services are unavailable in the read-only demo.",
      "CONFIGURATION_REQUIRED",
    );
  const emulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";
  const existing = getApps().find((app) => app.name === "vela-admin");
  if (existing && existing.options.projectId !== projectId)
    throw new AppError(503, "Restart the server after changing the Firebase project.");
  if (emulator) {
    if (
      process.env.VERCEL ||
      !projectId.startsWith("demo-") ||
      process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080" ||
      process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099"
    )
      throw new AppError(
        503,
        "Local Firebase emulators require a demo project and loopback hosts.",
      );
    return existing || initializeApp({ projectId }, "vela-admin");
  }
  if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST)
    throw new AppError(503, "Unexpected emulator configuration.");
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey)
    throw new AppError(
      503,
      "Firebase Admin credentials are not configured.",
      "CONFIGURATION_REQUIRED",
    );
  return (
    existing ||
    initializeApp(
      { credential: cert({ projectId, clientEmail, privateKey }), projectId },
      "vela-admin",
    )
  );
}
export function getAdminAuth() {
  return getAuth(adminApp());
}
export function getAdminDb() {
  return getFirestore(adminApp());
}
