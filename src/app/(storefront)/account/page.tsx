import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, Package, Settings2, Sparkles } from "lucide-react";
import { getSession } from "@/server/auth";
import { getProfile } from "@/server/services/accounts";
import { AccountActions, EmailVerification } from "@/components/account/account-actions";
import { ProfileForm } from "@/components/account/profile-form";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getSession();
  if (!user) redirect("/sign-in?returnTo=%2Faccount");
  const profile = await getProfile(user);
  return (
    <main id="main" className="wrap py-12 pb-20 md:py-16 md:pb-28">
      <div className="mb-10 border-b border-olive/15 pb-9">
        <p className="eyebrow mb-5">Your space at VELA</p>
        <h1 className="mb-4 text-[60px] sm:text-[76px]">
          Hello, <em>{profile.name.split(" ")[0] || "you"}.</em>
        </h1>
        <p className="mb-0 text-xs leading-7 text-olive/70">
          A little less to keep track of. A little more time for you.
        </p>
      </div>
      <div className="grid items-start gap-10 lg:grid-cols-[260px_1fr] lg:gap-16">
        <aside>
          <nav aria-label="Your account" className="space-y-3">
            <Link
              href="/account/orders"
              className="flex items-center gap-3 border-b border-olive/15 py-4 text-xs"
            >
              <Package size={17} strokeWidth={1.3} />
              Your orders
              <ArrowUpRight size={14} className="ml-auto" />
            </Link>
            <Link
              href="/routine"
              className="flex items-center gap-3 border-b border-olive/15 py-4 text-xs"
            >
              <Sparkles size={17} strokeWidth={1.3} />
              Find your ritual
              <ArrowUpRight size={14} className="ml-auto" />
            </Link>
            {user.admin && (
              <Link
                href="/admin"
                className="flex items-center gap-3 border-b border-olive/15 py-4 text-xs"
              >
                <Settings2 size={17} strokeWidth={1.3} />
                Store administration
                <ArrowUpRight size={14} className="ml-auto" />
              </Link>
            )}
          </nav>
          <AccountActions />
        </aside>
        <div className="min-w-0">
          <EmailVerification uid={user.uid} emailVerified={user.emailVerified} />
          <ProfileForm profile={profile} />
        </div>
      </div>
    </main>
  );
}
