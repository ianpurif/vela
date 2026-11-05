"use client";

import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { getClientAuth } from "@/lib/firebase/client";

export class AuthRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthRequestError";
  }
}

export async function createCustomerSession(user: User) {
  const idToken = await user.getIdToken(true);
  const response = await fetch("/api/auth/session", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new AuthRequestError(
      typeof body.error === "string"
        ? body.error
        : "Your session couldn’t be opened. Please sign in again.",
    );
  }
}

export async function signInCustomer(email: string, password: string) {
  const auth = await getClientAuth();
  const result = await signInWithEmailAndPassword(auth, email, password);
  try {
    await createCustomerSession(result.user);
  } catch (error) {
    await signOut(auth);
    throw error;
  }
}

export async function registerCustomer(name: string, email: string, password: string) {
  const auth = await getClientAuth();
  const result = await createUserWithEmailAndPassword(auth, email, password);
  try {
    await updateProfile(result.user, { displayName: name });
    await createCustomerSession(result.user);
  } catch {
    await signOut(auth);
    throw new AuthRequestError(
      "Your account was created, but your session couldn’t be opened. Please sign in to continue.",
    );
  }
  try {
    await sendEmailVerification(result.user, { url: `${window.location.origin}/account` });
    return { verificationSent: true };
  } catch {
    return { verificationSent: false };
  }
}

export async function signInWithGoogle() {
  const auth = await getClientAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const result = await signInWithPopup(auth, provider);
  try {
    await createCustomerSession(result.user);
  } catch (error) {
    await signOut(auth);
    throw error;
  }
}

export async function requestPasswordReset(email: string) {
  const auth = await getClientAuth();
  try {
    await sendPasswordResetEmail(auth, email, { url: `${window.location.origin}/sign-in` });
  } catch (error) {
    // Give the same response for unknown accounts, including emulator configurations.
    if (!(
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "auth/user-not-found"
    ))
      throw error;
  }
}

async function signedInClientUser(expectedUid: string) {
  const auth = await getClientAuth();
  if (!auth.currentUser || auth.currentUser.uid !== expectedUid)
    throw new AuthRequestError(
      "Please sign out and sign in again in this tab to manage email verification.",
    );
  return auth.currentUser;
}

export async function resendVerification(expectedUid: string) {
  const user = await signedInClientUser(expectedUid);
  await sendEmailVerification(user, { url: `${window.location.origin}/account` });
}

export async function refreshVerification(expectedUid: string) {
  const user = await signedInClientUser(expectedUid);
  await reload(user);
  if (!user.emailVerified) return false;
  try {
    await createCustomerSession(user);
  } catch {
    throw new AuthRequestError(
      "Your email is verified. Please sign out and sign in again to refresh your account session.",
    );
  }
  return true;
}

export async function signOutCustomer() {
  // Delete the privileged HTTP session first; a client-only sign-out is insufficient.
  const response = await fetch("/api/auth/session", {
    method: "DELETE",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) throw new AuthRequestError("You couldn’t be signed out. Please try again.");
  const auth = await getClientAuth().catch(() => null);
  if (auth) await signOut(auth);
}
