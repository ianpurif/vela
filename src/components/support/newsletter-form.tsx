"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ArrowUpRight } from "lucide-react";
import {
  newsletterInputSchema,
  preferenceKeySchema,
  supportEmailSchema,
} from "@/lib/validation/support";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const storagePrefix = "vela:newsletter-preference:v1:";
type Credential = { email: string; key: string };
function savedKey(email: string) {
  try {
    const result = preferenceKeySchema.safeParse(localStorage.getItem(`${storagePrefix}${email}`));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
function rememberKey(email: string, key: string) {
  try {
    localStorage.setItem(`${storagePrefix}${email}`, key);
  } catch {
    /* The private link still works when browser storage is unavailable. */
  }
}
function newPreferenceKey() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
function preferencesLink(email: string, key: string) {
  const url = new URL("/newsletter", window.location.origin);
  url.hash = new URLSearchParams({ email, key }).toString();
  return url.toString();
}

export function NewsletterForm({
  tone = "light",
  compact = false,
  className,
}: {
  tone?: "light" | "dark";
  compact?: boolean;
  className?: string;
}) {
  const id = useId();
  const credential = useRef<Credential | null>(null);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [mode, setMode] = useState<"subscribe" | "unsubscribe">("subscribe");
  const [busy, setBusy] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [consentError, setConsentError] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [manageLink, setManageLink] = useState("");
  const dark = tone === "dark";
  useEffect(() => {
    let active = true;
    const hydrate = () => {
      if (!active) return;
      const params = new URLSearchParams(window.location.hash.slice(1));
      const parsedEmail = supportEmailSchema.safeParse(params.get("email"));
      const parsedKey = preferenceKeySchema.safeParse(params.get("key"));
      if (!parsedEmail.success || !parsedKey.success) return;
      credential.current = { email: parsedEmail.data, key: parsedKey.data };
      setEmail(parsedEmail.data);
      setMode("unsubscribe");
      setManageLink(preferencesLink(parsedEmail.data, parsedKey.data));
    };
    // Hash hydration changes only form state. Opening a link never changes a subscription.
    queueMicrotask(hydrate);
    window.addEventListener("hashchange", hydrate);
    return () => {
      active = false;
      window.removeEventListener("hashchange", hydrate);
    };
  }, []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailError("");
    setConsentError("");
    setError("");
    setMessage("");
    const normalized = supportEmailSchema.safeParse(email);
    if (!normalized.success) {
      setEmailError("Enter a valid email address.");
      return;
    }
    if (mode === "subscribe" && !consent) {
      setConsentError("Please agree before saving your signup.");
      return;
    }
    const address = normalized.data;
    let key =
      savedKey(address) ?? (credential.current?.email === address ? credential.current.key : null);
    if (!key && mode === "unsubscribe") {
      setError(
        "Open your private preferences link, or use the browser where you saved your signup. Contact us if you need help.",
      );
      return;
    }
    key ??= newPreferenceKey();
    credential.current = { email: address, key };
    if (mode === "subscribe") rememberKey(address, key);
    const input = newsletterInputSchema.parse(
      mode === "subscribe"
        ? { action: mode, email: address, preferenceKey: key, consent: true }
        : { action: mode, email: address, preferenceKey: key },
    );
    setBusy(true);
    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.accepted !== true)
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "Your preference could not be confirmed. Please retry.",
        );
      setManageLink(preferencesLink(address, key));
      setMessage(
        mode === "subscribe"
          ? "New signups are saved as pending. Newsletter emails are not being sent."
          : "Preference request processed. If this private link matches the saved signup, it is now unsubscribed.",
      );
    } catch (failure) {
      setError(
        failure instanceof Error && failure.message !== "Failed to fetch"
          ? failure.message
          : "Your preference could not be confirmed. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  function switchMode() {
    setMode((current) => (current === "subscribe" ? "unsubscribe" : "subscribe"));
    setError("");
    setMessage("");
    setEmailError("");
    setConsentError("");
  }
  const errorClass = dark ? "text-[#efc1a7]" : "text-[#8c4b32]";
  return (
    <form
      aria-label="Newsletter preferences"
      onSubmit={save}
      noValidate
      className={cn("space-y-4", dark ? "text-ivory" : "text-olive", className)}
    >
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <legend className="sr-only">
          {mode === "subscribe"
            ? "Save a pending newsletter signup"
            : "Manage your newsletter preference"}
        </legend>
        <div
          className={cn(
            "gap-3",
            compact ? "space-y-3" : "grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end",
          )}
        >
          <div>
            <label htmlFor={`${id}-email`} className={cn("label", dark && "text-ivory/80")}>
              Email address
            </label>
            <input
              id={`${id}-email`}
              type="email"
              autoComplete="email"
              maxLength={254}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setManageLink("");
              }}
              className={cn(
                "field",
                dark &&
                  "border-ivory/35 bg-transparent text-ivory placeholder:text-ivory/80 focus:border-ivory focus-visible:outline-ivory",
              )}
              aria-invalid={!!emailError}
              aria-describedby={emailError ? `${id}-email-error` : undefined}
            />
          </div>
          <Button
            type="submit"
            disabled={busy}
            variant={dark ? "light" : "default"}
            className={cn("w-full", !compact && "sm:w-auto")}
          >
            {busy ? "Saving preference…" : mode === "subscribe" ? "Save my signup" : "Unsubscribe"}
            <ArrowUpRight size={14} />
          </Button>
        </div>
        {emailError && (
          <p id={`${id}-email-error`} role="alert" className={cn("text-xs", errorClass)}>
            {emailError}
          </p>
        )}
        {mode === "subscribe" ? (
          <div>
            <label
              className={cn(
                "flex items-start gap-3 text-[11px] leading-6",
                dark ? "text-ivory/80" : "text-olive/80",
              )}
            >
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 accent-sage"
                aria-invalid={!!consentError}
                aria-describedby={consentError ? `${id}-consent-error` : undefined}
              />
              <span>
                I agree to receive occasional VELA emails and can unsubscribe at any time.
              </span>
            </label>
            {consentError && (
              <p id={`${id}-consent-error`} role="alert" className={cn("mt-2 text-xs", errorClass)}>
                {consentError}
              </p>
            )}
          </div>
        ) : (
          <p className={cn("mb-0 text-[11px] leading-6", dark ? "text-ivory/80" : "text-olive/80")}>
            Use your saved browser preference or private preferences link. Opening a link alone does
            not unsubscribe.
          </p>
        )}
        <p className={cn("mb-0 text-[11px] leading-6", dark ? "text-ivory/80" : "text-olive/80")}>
          Signups stay pending until email opt-in is available. No newsletter emails are being sent.
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-[11px]">
          <button type="button" onClick={switchMode} className="underline underline-offset-4">
            {mode === "subscribe" ? "Unsubscribe instead" : "Sign up instead"}
          </button>
          <Link href="/privacy" className="underline underline-offset-4">
            Privacy
          </Link>
          {mode === "unsubscribe" && (
            <Link href="/contact" className="underline underline-offset-4">
              Contact us for help
            </Link>
          )}
        </div>
      </fieldset>
      {error && (
        <p role="alert" className={cn("text-xs leading-6", errorClass)}>
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-xs leading-6">
          {message}
        </p>
      )}
      {manageLink && (
        <div
          className={cn(
            "border-t pt-4 text-[11px] leading-6",
            dark ? "border-ivory/20" : "border-olive/15",
          )}
        >
          <a href={manageLink} className="underline underline-offset-4">
            Open private preferences
          </a>
          <p
            className={cn(
              "mt-2 mb-0 text-[11px] leading-6",
              dark ? "text-ivory/80" : "text-olive/80",
            )}
          >
            Bookmark or copy this private link. For a new signup, it lets you manage its preference
            later. An existing signup needs its original link or saved browser preference.
          </p>
        </div>
      )}
    </form>
  );
}
