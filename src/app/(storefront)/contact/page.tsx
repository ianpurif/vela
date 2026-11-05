import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ContactForm } from "@/components/support/contact-form";

export const metadata: Metadata = {
  title: "Contact us",
  description:
    "Questions about the VELA test store? Leave a note or find an answer in customer care.",
};

export default function ContactPage() {
  return (
    <main
      id="main"
      className="wrap grid gap-14 pb-24 pt-14 md:grid-cols-[1fr_1.1fr] md:gap-24 md:pb-32 md:pt-20"
    >
      <div>
        <p className="eyebrow mb-7 text-olive/80">Here to help</p>
        <h1 className="display mb-8">
          A note.
          <br />
          <em>A little clarity.</em>
        </h1>
        <p className="max-w-sm text-sm leading-7 text-olive/80">
          A product question, a test-order detail, or something we could make clearer. Leave your
          message here for the store administrator.
        </p>
        <p className="mt-5 max-w-sm text-xs leading-6 text-olive/80">
          This is a test store. Messages are saved in a private support inbox; email replies and
          delivery notifications are not configured. Please do not include payment card details,
          passwords, or health information.
        </p>
        <div className="mt-10 border-t border-olive/20 pt-7">
          <Link href="/faq" className="text-link">
            Common questions <ArrowUpRight size={15} />
          </Link>
          <p className="mt-6 text-xs leading-6 text-olive/80">
            For the current status of a test order, visit{" "}
            <Link href="/account/orders" className="underline underline-offset-4">
              your orders
            </Link>
            .
          </p>
        </div>
      </div>
      <div className="border border-olive/20 bg-white/25 p-6 sm:p-10">
        <h2 className="mb-8 font-display text-4xl">Leave us a note</h2>
        <ContactForm />
      </div>
    </main>
  );
}
