import type { Metadata } from "next";
import Link from "next/link";
import { InformationPage } from "@/components/support/information-page";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "What the VELA test store records, where it is used, and how to contact the administrator.",
};
export default function PrivacyPage() {
  return (
    <InformationPage
      path="/privacy"
      title="Your privacy."
      description="A plain-language account of the information used by this test store. Updated November 6, 2026."
    >
      <h2>Information you provide</h2>
      <p>
        Creating an account uses Firebase Authentication. Your account record contains an
        identifier, email address, display name, and authentication details managed by Firebase.
        Your profile may also contain saved shipping addresses.
      </p>
      <p>
        Test orders store product lines, prices, payment and fulfillment status, a shipping address
        when supplied at checkout, and provider references. VELA does not store payment card
        numbers. Stripe handles test payment entry.
      </p>
      <p>
        Contact messages store your name, email, topic, message, and submission time for
        administrator review. Newsletter signup stores an email address, consent information, and
        subscription state. Newsletter delivery is not configured.
      </p>
      <h2>Information on your device</h2>
      <p>
        An httpOnly session cookie keeps you signed in. Firebase also uses browser storage for its
        sign-in session. The shopping bag uses local storage so it can remain between visits;
        checkout uses session storage to safely retry an attempt. Clearing browser storage may
        remove these preferences.
      </p>
      <p>
        The routine finder uses answers in the current page to match products. Answers are not added
        to your account or sent to an external recommendation service.
      </p>
      <p>
        Newsletter preferences store your signup email and a private preference key in local
        storage. The key lets this browser manage that signup. A saved private preferences link
        carries the same access in its fragment; the server stores only a hash of the key. Anyone
        with that private link can withdraw the signup.
      </p>
      <h2>How records are used</h2>
      <p>
        Records support sign-in, your profile, test checkout, order history, inventory, support, and
        administration. Administrator activity creates audit entries. The dashboard calculates order
        and revenue summaries from stored test orders; it does not run a third-party visitor
        tracking service.
      </p>
      <p>
        Rate limits store time-limited counters keyed by hashed request identifiers to reduce abuse.
        Hashing is a protection for these identifiers, not a claim that all operational records are
        anonymous.
      </p>
      <h2>Services and access</h2>
      <p>
        When configured, Firebase handles authentication and database storage, Cloudinary hosts
        product imagery, Stripe processes test checkout, and Vercel hosts the site. These providers
        may process operational logs under their own service settings. Local development can use
        Firebase emulators instead of hosted Firebase.
      </p>
      <p>
        Customers can read their own account and order records. Server-verified administrators can
        access the records needed to operate the store. Support and newsletter collections are
        accessible through protected server operations, not direct public database access.
      </p>
      <h2>Choices and requests</h2>
      <p>
        You can edit your name and saved addresses in <Link href="/account">your account</Link>,
        sign out, clear your bag, and withdraw a newsletter signup through{" "}
        <Link href="/newsletter">newsletter preferences</Link>.
      </p>
      <p>
        Use <Link href="/contact">the contact form</Link> to request review or deletion of stored
        personal information. The administrator must review and, where necessary, verify a request.
        Automated account deletion and a scheduled retention policy are not configured in this test
        store; records remain until an administrator removes them. Do not submit sensitive personal
        information for testing.
      </p>
    </InformationPage>
  );
}
