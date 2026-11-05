import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/server/auth";
import { getAdminSupportMessage } from "@/server/services/support";
import { contactIdSchema } from "@/lib/validation/support";
import { AdminPageHeading } from "@/components/admin/admin-ui";
import { operationDate } from "@/components/admin/operations-ui";
import { SupportStatus } from "@/components/admin/support-status";

export const metadata: Metadata = { title: "Support message" };
export default async function SupportMessagePage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await getSession())?.admin) return null;
  const parsed = contactIdSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  const message = await getAdminSupportMessage(parsed.data);
  if (!message) notFound();
  return (
    <>
      <Link
        href="/admin/support"
        className="mb-8 inline-flex min-h-10 items-center gap-2 text-xs text-olive/80 underline underline-offset-4"
      >
        <ArrowLeft size={14} />
        Support inbox
      </Link>
      <div className="break-words">
        <AdminPageHeading
          eyebrow="A note from the storefront"
          title={message.subject}
          description={`Saved ${operationDate(message.createdAt)} UTC`}
        />
      </div>
      <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_320px]">
        <article
          aria-label="Support message"
          className="min-w-0 border border-olive/15 bg-ivory p-6 sm:p-8"
        >
          <dl className="mb-7 grid gap-5 border-b border-olive/15 pb-7 text-xs sm:grid-cols-2">
            <div>
              <dt className="mb-2 text-olive/80">From</dt>
              <dd className="m-0 break-words font-medium">{message.name}</dd>
            </div>
            <div>
              <dt className="mb-2 text-olive/80">Email</dt>
              <dd className="m-0 break-words font-medium">{message.email}</dd>
            </div>
          </dl>
          <h2 className="mb-5 font-sans text-sm font-semibold tracking-normal">Message</h2>
          <p className="mb-0 whitespace-pre-wrap break-words text-sm leading-8 text-olive">
            {message.message}
          </p>
        </article>
        <SupportStatus key={message.id} message={message} />
      </div>
    </>
  );
}
