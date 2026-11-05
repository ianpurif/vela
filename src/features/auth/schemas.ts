import { z } from "zod";

const email = z.string().trim().email("Enter a valid email address.").max(254);
export const signInSchema = z.object({
  name: z.string(),
  email,
  password: z.string().min(1, "Enter your password.").max(128),
  confirmPassword: z.string(),
});
export const registrationSchema = z
  .object({
    name: z.string().trim().min(2, "Please enter your name.").max(100),
    email,
    password: z.string().min(8, "Use at least 8 characters.").max(128),
    confirmPassword: z.string().min(1, "Please repeat your password."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Your passwords don’t match.",
  });
export const resetPasswordSchema = z.object({ email });
export type AuthFormValues = z.infer<typeof signInSchema>;

export function authErrorMessage(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const messages: Record<string, string> = {
    "auth/invalid-credential":
      "That email and password didn’t match. Please try again or reset your password.",
    "auth/user-not-found":
      "That email and password didn’t match. Please try again or reset your password.",
    "auth/wrong-password":
      "That email and password didn’t match. Please try again or reset your password.",
    "auth/email-already-in-use":
      "An account already uses this email. Sign in or reset your password to continue.",
    "auth/weak-password": "Please choose a stronger password with at least 8 characters.",
    "auth/invalid-email": "Please check your email address.",
    "auth/too-many-requests":
      "There have been too many attempts. Please wait a little and try again.",
    "auth/network-request-failed":
      "We couldn’t connect. Check your internet connection and try again.",
    "auth/popup-closed-by-user":
      "Google sign-in was closed. You can try again or sign in with email.",
    "auth/cancelled-popup-request": "Google sign-in was interrupted. Please try again.",
    "auth/popup-blocked":
      "Your browser blocked Google sign-in. Allow pop-ups for this site and try again.",
    "auth/operation-not-allowed":
      "This sign-in method isn’t available yet. Please try another method.",
    "auth/unauthorized-domain":
      "Sign-in isn’t configured for this website address yet. Please contact VELA support.",
    "auth/account-exists-with-different-credential":
      "This email uses another sign-in method. Sign in with the method you used before.",
    "auth/requires-recent-login": "Please sign out and sign in again to complete this change.",
    "auth/user-disabled": "This account is currently unavailable. Please contact VELA support.",
  };
  if (messages[code]) return messages[code];
  if (error instanceof Error && ["AuthConfigurationError", "AuthRequestError"].includes(error.name))
    return error.message;
  return "We couldn’t complete that request. Please try again in a moment.";
}
