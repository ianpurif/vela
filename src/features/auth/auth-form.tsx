"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signInCustomer, registerCustomer, signInWithGoogle } from "@/features/auth/client";
import {
  authErrorMessage,
  registrationSchema,
  signInSchema,
  type AuthFormValues,
} from "@/features/auth/schemas";
import { safeReturnTo } from "@/features/auth/navigation";

export function AuthForm({
  mode,
  returnTo = "/account",
}: {
  mode: "sign-in" | "register";
  returnTo?: string;
}) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(false);
  const destination = safeReturnTo(returnTo);
  const isRegistration = mode === "register";
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AuthFormValues>({
    resolver: zodResolver(isRegistration ? registrationSchema : signInSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });
  const pending = isSubmitting || googlePending;
  const continueToAccount = () => {
    router.replace(destination);
    router.refresh();
  };
  async function submit(values: AuthFormValues) {
    setError("");
    try {
      if (isRegistration) {
        const result = await registerCustomer(values.name, values.email, values.password);
        if (!result.verificationSent) {
          setCreated(true);
          return;
        }
      } else await signInCustomer(values.email, values.password);
      continueToAccount();
    } catch (failure) {
      setError(authErrorMessage(failure));
    }
  }
  async function googleSignIn() {
    setError("");
    setGooglePending(true);
    try {
      await signInWithGoogle();
      continueToAccount();
    } catch (failure) {
      setError(authErrorMessage(failure));
    } finally {
      setGooglePending(false);
    }
  }
  if (created)
    return (
      <div>
        <p role="status" className="mb-7 border-l-2 border-sage bg-sage/10 p-5 text-xs leading-7">
          Your account is ready. We couldn’t send your verification email just yet; you can request
          another from your account.
        </p>
        <Button onClick={continueToAccount} className="w-full">
          Continue
          <ArrowRight size={15} />
        </Button>
      </div>
    );
  return (
    <>
      <form
        onSubmit={handleSubmit(submit)}
        noValidate
        className="space-y-5"
        aria-label={isRegistration ? "Create your VELA account" : "Sign in to VELA"}
      >
        {isRegistration && (
          <div>
            <label htmlFor="auth-name" className="label">
              Your name
            </label>
            <input
              id="auth-name"
              autoComplete="name"
              className="field"
              maxLength={100}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "auth-name-error" : undefined}
              {...register("name")}
            />
            {errors.name && (
              <p id="auth-name-error" role="alert" className="mt-2 mb-0 text-xs text-[#8c4b32]">
                {errors.name.message}
              </p>
            )}
          </div>
        )}
        <div>
          <label htmlFor="auth-email" className="label">
            Email address
          </label>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            className="field"
            maxLength={254}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "auth-email-error" : undefined}
            {...register("email")}
          />
          {errors.email && (
            <p id="auth-email-error" role="alert" className="mt-2 mb-0 text-xs text-[#8c4b32]">
              {errors.email.message}
            </p>
          )}
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label htmlFor="auth-password" className="text-xs font-semibold">
              Password
            </label>
            {!isRegistration && (
              <Link
                href="/reset-password"
                className="text-[10px] text-olive/80 underline underline-offset-4"
              >
                Forgot password?
              </Link>
            )}
          </div>
          <div className="relative">
            <input
              id="auth-password"
              type={showPassword ? "text" : "password"}
              autoComplete={isRegistration ? "new-password" : "current-password"}
              className="field pr-12"
              maxLength={128}
              aria-invalid={!!errors.password}
              aria-describedby={
                errors.password
                  ? "auth-password-error"
                  : isRegistration
                    ? "auth-password-hint"
                    : undefined
              }
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-olive/80"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password ? (
            <p id="auth-password-error" role="alert" className="mt-2 mb-0 text-xs text-[#8c4b32]">
              {errors.password.message}
            </p>
          ) : (
            isRegistration && (
              <p id="auth-password-hint" className="mt-2 mb-0 text-[10px] text-olive/80">
                At least 8 characters. A longer phrase makes a good password.
              </p>
            )
          )}
        </div>
        {isRegistration && (
          <div>
            <label htmlFor="auth-confirm" className="label">
              Confirm password
            </label>
            <input
              id="auth-confirm"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              className="field"
              maxLength={128}
              aria-invalid={!!errors.confirmPassword}
              aria-describedby={errors.confirmPassword ? "auth-confirm-error" : undefined}
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p id="auth-confirm-error" role="alert" className="mt-2 mb-0 text-xs text-[#8c4b32]">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>
        )}
        {error && (
          <p
            role="alert"
            className="border-l-2 border-[#8c4b32] bg-[#8c4b32]/5 p-4 text-xs leading-6 text-[#74412e]"
          >
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="w-full justify-between">
          {isSubmitting ? "One moment…" : isRegistration ? "Create my account" : "Welcome back"}
          {isSubmitting ? (
            <LoaderCircle size={16} className="animate-spin" />
          ) : (
            <ArrowRight size={16} />
          )}
        </Button>
      </form>
      <div className="my-6 flex items-center gap-4 text-[10px] text-olive/80">
        <span className="h-px flex-1 bg-olive/15" />
        or
        <span className="h-px flex-1 bg-olive/15" />
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={googleSignIn}
        disabled={pending}
        className="w-full"
      >
        {googlePending ? (
          <LoaderCircle size={15} className="animate-spin" />
        ) : (
          <span aria-hidden="true" className="font-sans text-base font-semibold normal-case">
            G
          </span>
        )}
        Continue with Google
      </Button>
      <p className="mt-7 mb-0 text-center text-xs text-olive/80">
        {isRegistration ? "Already have a ritual?" : "New to VELA?"}{" "}
        <Link
          href={`${isRegistration ? "/sign-in" : "/register"}?returnTo=${encodeURIComponent(destination)}`}
          className="font-medium text-olive underline underline-offset-4"
        >
          {isRegistration ? "Sign in" : "Create an account"}
        </Link>
      </p>
      {isRegistration && (
        <p className="mt-6 mb-0 text-center text-[10px] leading-5 text-olive/80">
          By creating an account, you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-2">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </p>
      )}
    </>
  );
}
