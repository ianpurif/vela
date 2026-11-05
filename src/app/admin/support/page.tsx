import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { getSession } from "@/server/auth";
import { getAdminSupportInbox } from "@/server/services/support";
import { contactIdSchema } from "@/lib/validation/support";
import { AppError } from "@/lib/errors";
import { AdminPageHeading } from "@/components/admin/admin-ui";
import { operationDate } from "@/components/admin/operations-ui";
import type { AdminSupportList } from "@/types/support";

export const metadata: Metadata = { title: "Support inbox" };
export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ after?: string | string[] }>;
}) {
  if (!(await getSession())?.admin) return null;
  const { after } = await searchParams;
  const cursor = contactIdSchema.safeParse(after);
  let result: AdminSupportList;
  let staleCursor = false;
  try {
    result = await getAdminSupportInbox(cursor.success ? cursor.data : undefined);
  } catch (error) {
    if (!(error instanceof AppError) || error.code !== "SUPPORT_CURSOR_INVALID") throw error;
    staleCursor = true;
    result = await getAdminSupportInbox();
  }
  return (
    <>
      <AdminPageHeading
        eyebrow="Customer care"
        title="The support inbox."
        description="Notes saved through the contact form. Review each message and keep its status up to date. Email replies are not configured."
      />
      {(staleCursor || (after && !cursor.success)) && (
        <p role="status" className="mb-6 text-xs leading-6 text-olive/80">
          The previous page reference is unavailable. Showing the most recent messages.
        </p>
      )}
      <section
        aria-label="Saved support messages"
        className="min-w-0 border border-olive/15 bg-ivory"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-olive/15 px-5 py-4 text-xs text-olive/80">
          <span>
            {result.messages.length} {result.messages.length === 1 ? "message" : "messages"} in this
            view · newest first
          </span>
          {after && (
            <Link href="/admin/support" className="underline underline-offset-4">
              Most recent messages
            </Link>
          )}
        </div>
        <div className="divide-y divide-olive/15">
          {result.messages.map((message) => (
            <article key={message.id} className="px-5 py-6 sm:px-7">
              <div className="mb-3 flex items-start justify-between gap-5">
                <h2 className="mb-0 min-w-0 break-words font-sans text-sm font-semibold leading-6 tracking-normal">
                  <Link
                    href={`/admin/support/${message.id}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {message.subject}
                  </Link>
                </h2>
                <span className="shrink-0 rounded-full border border-olive/20 px-3 py-1 text-[11px] capitalize">
                  {message.status}
                </span>
              </div>
              <p className="mb-2 break-words text-xs leading-6 text-olive/80">
                {message.name} · {message.email}
              </p>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <time
                  dateTime={new Date(message.createdAt).toISOString()}
                  className="text-[11px] text-olive/80"
                >
                  {operationDate(message.createdAt)} UTC
                </time>
                <Link
                  href={`/admin/support/${message.id}`}
                  aria-label={`Read message: ${message.subject}`}
                  className="inline-flex min-h-10 items-center gap-2 text-xs underline underline-offset-4"
                >
                  Read message <ArrowUpRight size={14} />
                </Link>
              </div>
            </article>
          ))}
          {!result.messages.length && (
            <p className="mb-0 px-6 py-16 text-center text-sm text-olive/80">
              New contact messages will appear here.
            </p>
          )}
        </div>
      </section>
      {result.next && (
        <div className="mt-7 flex justify-end">
          <Link
            href={`/admin/support?after=${encodeURIComponent(result.next)}`}
            className="text-link"
          >
            Older messages <ArrowDown size={14} />
          </Link>
        </div>
      )}
    </>
  );
}
