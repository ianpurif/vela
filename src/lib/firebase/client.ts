"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import {
  browserSessionPersistence,
  connectAuthEmulator,
  getAuth,
  setPersistence,
  type Auth,
} from "firebase/auth";

export class AuthConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthConfigurationError";
  }
}

let pendingAuth: Promise<Auth> | undefined;

/** Initialize only when authentication is requested; the public store needs no auth SDK connection. */
export async function getClientAuth(): Promise<Auth> {
  if (typeof window === "undefined")
    throw new AuthConfigurationError("Please open sign-in in your browser.");
  if (pendingAuth) return pendingAuth;
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  if (!config.apiKey || !config.authDomain || !config.projectId || !config.appId) {
    throw new AuthConfigurationError(
      "Account services are not connected yet. You can still explore the collection and save your bag. Please try signing in once Firebase is configured.",
    );
  }
  let emulatorUrl: string | undefined;
  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true") {
    const loopback = ["localhost", "127.0.0.1", "[::1]"];
    try {
      const url = new URL(
        process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL || "http://127.0.0.1:9099",
      );
      if (
        !config.projectId.startsWith("demo-") ||
        !loopback.includes(window.location.hostname) ||
        !loopback.includes(url.hostname) ||
        url.protocol !== "http:" ||
        url.username ||
        url.password ||
        url.pathname !== "/" ||
        url.search ||
        url.hash
      )
        throw new Error("Unsafe emulator configuration");
      emulatorUrl = url.origin;
    } catch {
      throw new AuthConfigurationError(
        "Local authentication is configured incorrectly. Emulators require a demo project and a local browser address.",
      );
    }
  }
  const app = getApps().some((candidate) => candidate.name === "[DEFAULT]")
    ? getApp()
    : initializeApp(config);
  const auth = getAuth(app);
  if (emulatorUrl && !auth.emulatorConfig)
    connectAuthEmulator(auth, emulatorUrl, { disableWarnings: true });
  pendingAuth = setPersistence(auth, browserSessionPersistence)
    .then(async () => {
      await auth.authStateReady();
      return auth;
    })
    .catch((error) => {
      pendingAuth = undefined;
      throw error;
    });
  return pendingAuth;
}
