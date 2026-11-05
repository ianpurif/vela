import type { Metadata } from "next";
import Link from "next/link";
import { InformationPage } from "@/components/support/information-page";

export const metadata: Metadata = {
  alternates: { canonical: "/terms" },
  title: "Terms of use",
  description: "The scope and limits of the fictional VELA test storefront.",
};
export default function TermsPage() {
  return (
    <InformationPage
      path="/terms"
      title="Terms of use."
      description="About the experience you are exploring. Updated November 6, 2026."
    >
      <h2>A fictional test store</h2>
      <p>
        VELA is a demonstration of a skincare shopping experience. Its catalog is fictional. Test
        checkout does not place an order for real goods, and no products are manufactured or shipped
        through this site.
      </p>
      <p>
        Use only test payment details in checkout. The application accepts Stripe test-mode
        configuration only. It is not a live retail payment service.
      </p>
      <h2>Product information</h2>
      <p>
        Descriptions, ingredients, prices, availability, and routines belong to the fictional
        catalog. Photographs are packaging concepts and may show different descriptive labels.
        Written catalog names identify the items. No sun-protection rating, clinical result,
        certification, or customer endorsement is implied.
      </p>
      <p>
        The ritual finder matches stated preferences with current product attributes. It is not a
        diagnosis, treatment recommendation, or guarantee of individual suitability.
      </p>
      <h2>Accounts & responsible use</h2>
      <p>
        Keep account credentials private. Use your own test account, respect other users’ records,
        and avoid submitting unnecessary personal information. Do not attempt to bypass access
        controls, manipulate payment status, or disrupt the store.
      </p>
      <h2>Test prices and orders</h2>
      <p>
        Prices are in US dollars. Current prices, availability, and shipping are checked when
        checkout begins. A browser redirect alone does not establish a payment; an order is marked
        paid only after the server verifies a Stripe test notification.
      </p>
      <p>
        See <Link href="/shipping">shipping & delivery</Link> and{" "}
        <Link href="/returns">returns & care</Link> for cancellation and simulated fulfillment
        details. Features that require external services may be unavailable until those services are
        configured.
      </p>
      <h2>Questions & information</h2>
      <p>
        The <Link href="/privacy">privacy policy</Link> explains stored information. For a
        test-store question or a request about a record, use{" "}
        <Link href="/contact">the contact form</Link>. Contact submissions are saved for
        administrator review; no response time or email delivery is promised.
      </p>
    </InformationPage>
  );
}
