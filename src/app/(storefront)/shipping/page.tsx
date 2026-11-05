import type { Metadata } from "next";
import Link from "next/link";
import { InformationPage } from "@/components/support/information-page";
import { FREE_SHIPPING_THRESHOLD, STANDARD_SHIPPING } from "@/features/cart/pricing";
import { money } from "@/lib/utils";

export const metadata: Metadata = {
  alternates: { canonical: "/shipping" },
  title: "Shipping & delivery",
  description:
    "Understand US address support, shipping totals, and simulated fulfillment in the VELA test store.",
};
export default function ShippingPage() {
  return (
    <InformationPage
      path="/shipping"
      title="Shipping & delivery."
      description="Clear costs. A visible journey. These details describe our test checkout."
    >
      <h2>A test journey</h2>
      <p>
        VELA is a fictional collection. Orders and fulfillment updates are for testing only. No
        parcel is dispatched, and no delivery date is promised.
      </p>
      <h2>Addresses & shipping totals</h2>
      <p>
        Checkout accepts United States shipping addresses and uses US dollars. Standard test
        shipping is {money(STANDARD_SHIPPING)}. Shipping is free when the merchandise subtotal
        reaches {money(FREE_SHIPPING_THRESHOLD)}.
      </p>
      <p>
        The server checks current prices and available inventory before creating checkout. The
        resulting order shows the product subtotal, shipping, and total. Automatic tax, discount
        codes, and international delivery are not enabled.
      </p>
      <h2>Following your order</h2>
      <p>
        Your <Link href="/account/orders">order history</Link> shows payment and fulfillment
        separately. After a verified test payment, an administrator can move fulfillment through
        processing, shipped, and delivered. Any tracking reference shown is part of that test
        record; it is not a carrier integration.
      </p>
      <h2>If a detail looks wrong</h2>
      <p>
        A saved address does not rewrite an existing order. Include the order reference in a{" "}
        <Link href="/contact">support note</Link> if you need the administrator to review a test
        record. Please omit payment card details.
      </p>
    </InformationPage>
  );
}
