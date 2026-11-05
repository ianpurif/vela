import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { InformationPage } from "@/components/support/information-page";
import { FREE_SHIPPING_THRESHOLD, STANDARD_SHIPPING } from "@/features/cart/pricing";
import { money } from "@/lib/utils";

export const metadata: Metadata = {
  alternates: { canonical: "/faq" },
  title: "Common questions",
  description: "A little clarity on VELA products, routines, accounts, and test orders.",
};

const questions = [
  {
    title: "Can I buy real skincare here?",
    answer: (
      <>
        VELA is a fictional test store. Checkout uses Stripe test mode, and no physical products are
        dispatched. Use only test payment details. See our <Link href="/terms">terms of use</Link>.
      </>
    ),
  },
  {
    title: "Where should I start with my routine?",
    answer: (
      <>
        The <Link href="/routine">ritual finder</Link> asks about your preferences, then suggests
        available products from the current catalog. It explains each match and lets you add the
        routine to your bag. It provides cosmetic preferences, not a medical assessment.
      </>
    ),
  },
  {
    title: "Does Clear Day Milk provide sun protection?",
    answer: (
      <>
        No. This fictional product is a lightweight moisturizer, not a sunscreen. VELA makes no SPF
        or sun-protection claim. Read the written product details rather than interpreting concept
        packaging as a certification.
      </>
    ),
  },
  {
    title: "How do I check ingredients and availability?",
    answer: (
      <>
        Each <Link href="/shop">product page</Link> lists its fictional ingredients, usage, size,
        and current availability. The routine finder uses those same product records. A
        fragrance-free preference does not establish that a product is suitable for every
        individual.
      </>
    ),
  },
  {
    title: "Why does my order still say payment pending?",
    answer: (
      <>
        A return from checkout is not proof of payment. The order updates when a verified Stripe
        test notification is processed. Open <Link href="/account/orders">your orders</Link> to
        refresh the stored status. If it remains pending, leave the order reference in a{" "}
        <Link href="/contact">support note</Link>.
      </>
    ),
  },
  {
    title: "How are shipping costs calculated?",
    answer: (
      <>
        The test checkout supports US addresses. Standard test shipping is{" "}
        {money(STANDARD_SHIPPING)}, or free when the merchandise subtotal is at least{" "}
        {money(FREE_SHIPPING_THRESHOLD)}. The total is recalculated from current catalog prices
        before checkout. See <Link href="/shipping">shipping & delivery</Link>.
      </>
    ),
  },
  {
    title: "Can I cancel a test checkout?",
    answer: (
      <>
        Open the pending order and choose the cancellation action. The store checks the payment
        provider before releasing reserved stock. An already completed payment cannot be cancelled
        through that action. <Link href="/returns">Returns & care</Link> explains the test-store
        limits.
      </>
    ),
  },
  {
    title: "How do I change my account details?",
    answer: (
      <>
        Sign in to <Link href="/account">your account</Link> to edit your name and saved addresses.
        Password reset is available from the sign-in screen. Changing a profile cannot grant
        administrator access.
      </>
    ),
  },
  {
    title: "Will I receive newsletter emails?",
    answer: (
      <>
        The signup records your consent and interest, but newsletter delivery is not configured in
        this test store. You can withdraw your signup through{" "}
        <Link href="/newsletter">newsletter preferences</Link>.
      </>
    ),
  },
];

export default function FaqPage() {
  return (
    <InformationPage
      path="/faq"
      title="Common questions."
      description="The useful details, all in one quiet place."
    >
      <div className="divide-y divide-olive/20 border-b border-olive/20">
        {questions.map(({ title, answer }) => (
          <details key={title} className="group py-5 first:pt-0">
            <summary className="flex min-h-12 list-none items-center justify-between gap-6 text-sm font-medium [&::-webkit-details-marker]:hidden">
              {title}
              <Plus
                size={17}
                aria-hidden="true"
                className="shrink-0 transition-transform group-open:rotate-45"
              />
            </summary>
            <p className="mb-1 mt-4 pr-6 text-sm leading-7">{answer}</p>
          </details>
        ))}
      </div>
    </InformationPage>
  );
}
