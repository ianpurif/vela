import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { getSession } from "@/server/auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: { default: "Store administration | VELA", template: "%s | VELA administration" },
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect("/sign-in?returnTo=%2Fadmin");
  if (!user.admin)
    return (
      <main
        id="main"
        className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center"
      >
        <Link href="/" className="mb-14 font-display text-5xl tracking-[.2em]">
          VELA
        </Link>
        <LockKeyhole size={30} strokeWidth={1.2} className="mb-6 text-sage" />
        <p className="eyebrow mb-4">Store administration</p>
        <h1 className="mb-5 text-5xl">Administrator access required.</h1>
        <p className="mb-8 text-sm leading-7 text-olive/80">
          This area is reserved for VELA store administrators. Your customer account is ready for
          you.
        </p>
        <Button asChild>
          <Link href="/account">Return to your account</Link>
        </Button>
      </main>
    );
  return (
    <AdminShell name={user.name} email={user.email}>
      {children}
    </AdminShell>
  );
}
