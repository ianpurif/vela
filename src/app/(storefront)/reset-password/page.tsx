import type { Metadata } from "next";
import { AuthShell } from "@/features/auth/auth-shell";
import { ResetPasswordForm } from "@/features/auth/reset-form";

export const metadata: Metadata = {
  title: "Reset your password",
  robots: { index: false, follow: true },
};
export default function ResetPasswordPage() {
  return (
    <AuthShell
      eyebrow="A fresh start"
      title="Let’s get you back."
      description="It happens. Enter the email connected to your account and we’ll help you choose a new password."
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}
