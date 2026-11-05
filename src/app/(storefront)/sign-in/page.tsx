import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/server/auth";
import { AuthShell } from "@/features/auth/auth-shell";
import { AuthForm } from "@/features/auth/auth-form";
import { safeReturnTo } from "@/features/auth/navigation";

export const metadata: Metadata = { title: "Welcome back", robots: { index: false, follow: true } };
export const dynamic = "force-dynamic";
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  if (await getSession()) redirect("/account");
  const { returnTo } = await searchParams;
  return (
    <AuthShell
      eyebrow="Your VELA account"
      title="Welcome back."
      description="Your essentials, your orders, your everyday ritual. Settle back in."
    >
      <AuthForm mode="sign-in" returnTo={safeReturnTo(returnTo)} />
    </AuthShell>
  );
}
