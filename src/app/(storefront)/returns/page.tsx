import type { Metadata } from "next";
import Link from "next/link";
import { InformationPage } from "@/components/support/information-page";

export const metadata: Metadata = {
  alternates: { canonical: "/returns" },
  title: "Returns & care",
  description: "Cancellation and support for VELA test orders.",
};
export default function ReturnsPage() {
  return (
    <InformationPage
      path="/returns"
      title="Returns & care."
      description="A straightforward guide to changing course in the test store."
    >
      <h2>Before a test payment</h2>
      <p>
        Open the pending order in <Link href="/account/orders">your account</Link> to cancel its
        checkout. The store checks Stripe before releasing reserved inventory. If payment is already
        processing or complete, cancellation may be unavailable.
      </p>
      <p>
        Closing the checkout window does not immediately release a reservation. Expired checkouts
        are reconciled against the payment provider before stock becomes available again.
      </p>
      <h2>After a test payment</h2>
      <p>
        No physical products are supplied, so there are no physical returns. This application does
        not provide a refund action. If you need to investigate a paid test order, leave its
        reference in a <Link href="/contact">support note</Link>. An administrator can review the
        record and the corresponding Stripe test activity.
      </p>
      <h2>Product questions</h2>
      <p>
        Our catalog and routine finder describe fictional cosmetic products. Recommendations are
        based on stated preferences and catalog attributes; they do not establish safety, clinical
        suitability, or treatment outcomes.
      </p>
      <p>
        Use the written ingredient and usage information to explore the collection. Please keep
        medical details out of support messages.
      </p>
    </InformationPage>
  );
}
