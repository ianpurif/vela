"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, LogOut, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { refreshVerification, resendVerification, signOutCustomer } from "@/features/auth/client";
import { authErrorMessage } from "@/features/auth/schemas";

export function AccountActions() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    setPending(true);
    setError("");
    try {
      await signOutCustomer();
      router.replace("/sign-in");
      router.refresh();
    } catch (failure) {
      setError(authErrorMessage(failure));
      setPending(false);
    }
  }
  return (
    <div className="mt-8 border-t border-olive/15 pt-7">
      <p className="eyebrow mb-5">Account & security</p>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Link href="/reset-password" className="text-xs underline underline-offset-4">
          Reset your password
        </Link>
        <button
          type="button"
          disabled={pending}
          onClick={logout}
          className="inline-flex items-center gap-2 py-2 text-xs text-olive/75 underline underline-offset-4 disabled:opacity-50"
        >
          <LogOut size={13} />
          {pending ? "Signing out…" : "Sign out"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-4 text-xs leading-6 text-[#8c4b32]">
          {error}
        </p>
      )}
    </div>
  );
}

export function EmailVerification({ emailVerified, uid }: { emailVerified: boolean; uid: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<"send" | "check" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  if (emailVerified)
    return (
      <p className="mb-8 flex items-center gap-2 text-xs text-olive/80">
        <Check size={14} className="text-sage" />
        Email verified
      </p>
    );
  async function verify(action: "send" | "check") {
    setPending(action);
    setError("");
    setMessage("");
    try {
      if (action === "send") {
        await resendVerification(uid);
        setMessage("Verification email sent. Please check your inbox and spam folder.");
      } else if (await refreshVerification(uid)) {
        setMessage("Your email is verified.");
        router.refresh();
      } else
        setMessage(
          "Your email isn’t verified yet. Open the verification link in your inbox, then check again.",
        );
    } catch (failure) {
      setError(authErrorMessage(failure));
    } finally {
      setPending(null);
    }
  }
  return (
    <div className="mb-9 border-l-2 border-sage bg-sage/10 p-5 sm:p-6">
      <div className="mb-2 flex items-center gap-3">
        <Mail size={17} strokeWidth={1.4} />
        <h2 className="mb-0 font-sans text-xs font-semibold tracking-normal">
          One little step: verify your email
        </h2>
      </div>
      <p className="mb-4 text-xs leading-6 text-olive/75">
        Open the verification link in your inbox to confirm this account belongs to you.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          className="min-h-10 px-4 py-2 text-[9px]"
          disabled={!!pending}
          onClick={() => verify("send")}
        >
          {pending === "send" ? "Sending…" : "Send verification email"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="min-h-10 px-4 py-2 text-[9px]"
          disabled={!!pending}
          onClick={() => verify("check")}
        >
          {pending === "check" ? "Checking…" : "I’ve verified my email"}
        </Button>
      </div>
      {message && (
        <p role="status" className="mt-4 mb-0 text-xs leading-6">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 mb-0 text-xs leading-6 text-[#8c4b32]">
          {error}
        </p>
      )}
    </div>
  );
}
