import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/server/auth";
import { AuthShell } from "@/features/auth/auth-shell";
import { AuthForm } from "@/features/auth/auth-form";
import { safeReturnTo } from "@/features/auth/navigation";

export const metadata: Metadata = {
  title: "A space for you",
  robots: { index: false, follow: true },
};
export const dynamic = "force-dynamic";
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  if (await getSession()) redirect("/account");
  const { returnTo } = await searchParams;
  return (
    <AuthShell
      eyebrow="A little closer to VELA"
      title="Make yourself at home."
      description="Create an account to keep your orders and everyday details beautifully simple."
    >
      <AuthForm mode="register" returnTo={safeReturnTo(returnTo)} />
    </AuthShell>
  );
}
