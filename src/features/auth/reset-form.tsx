"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestPasswordReset } from "@/features/auth/client";
import { authErrorMessage, resetPasswordSchema } from "@/features/auth/schemas";

export function ResetPasswordForm() {
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ email: string }>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email: "" },
  });
  async function submit({ email }: { email: string }) {
    setError("");
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (failure) {
      setError(authErrorMessage(failure));
    }
  }
  return (
    <>
      {sent ? (
        <div role="status" className="border-l-2 border-sage bg-sage/10 p-5">
          <Mail size={21} strokeWidth={1.3} className="mb-4" />
          <p className="mb-0 text-xs leading-7">
            If an account exists for that email, you’ll receive a password reset link shortly. Check
            your inbox and spam folder.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit(submit)} noValidate className="space-y-6">
          <div>
            <label htmlFor="reset-email" className="label">
              Email address
            </label>
            <input
              id="reset-email"
              type="email"
              autoComplete="email"
              className="field"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "reset-email-error" : undefined}
              {...register("email")}
            />
            {errors.email && (
              <p id="reset-email-error" role="alert" className="mt-2 mb-0 text-xs text-[#8c4b32]">
                {errors.email.message}
              </p>
            )}
          </div>
          {error && (
            <p role="alert" className="text-xs leading-6 text-[#8c4b32]">
              {error}
            </p>
          )}
          <Button type="submit" disabled={isSubmitting} className="w-full justify-between">
            {isSubmitting ? "Sending…" : "Send reset link"}
            <ArrowRight size={15} />
          </Button>
        </form>
      )}
      <Link
        href="/sign-in"
        className="mt-8 inline-flex items-center gap-2 text-xs underline underline-offset-4"
      >
        <ArrowLeft size={13} />
        Return to sign in
      </Link>
    </>
  );
}
