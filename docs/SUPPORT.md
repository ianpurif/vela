# Contact and newsletter persistence

These forms save private Firestore records. They do not send email, verify email ownership, promise delivery, or guarantee a reply. Newsletter signup is always **pending**; there is no active marketing subscription or mailing job in this implementation.

## Contact

`ContactForm` accepts an optional `className` and renders the accessible `Contact VELA` form. It submits `POST /api/contact` with `{ name, email, subject, message, requestKey }`; a successful persisted result is `{ saved: true }`. Name is 2–100 characters, email at most 254, subject 3–160, and message 10–5,000. Input is trimmed; email is lowercased. Unknown properties and client-supplied status or timestamps are rejected.

The browser generates a UUID for each distinct message attempt. An unchanged retry after an ambiguous response keeps that UUID. Editing the normalized message payload creates a new attempt. `contactMessages/c_<sha256(requestKey)>` stores the content, server timestamps, `new` status, and a canonical payload fingerprint. Concurrent identical retries write one record. A different payload with the same UUID returns 409 and cannot overwrite the original. A retry also cannot reset a message's later admin status. Neither the raw UUID nor internal fingerprint is returned in the public receipt.

The success copy says the message was **saved for review**, not sent. Contact content and retry keys are not saved in browser storage; an in-progress key survives retries within the mounted form, not a page reload.

## Newsletter consent and preferences

`NewsletterForm` accepts `{ tone?: "light" | "dark", compact?: boolean, className?: string }`. It renders `Newsletter preferences`, an email field, explicit consent checkbox, and signup/unsubscribe modes. The same component handles `/newsletter` and embedded signup placement. The public endpoint is POST-only:

- Signup: `POST /api/newsletter` with `{ action: "subscribe", email, consent: true, preferenceKey }`.
- Unsubscribe: the same endpoint with `{ action: "unsubscribe", email, preferenceKey }`.
- Every valid request returns the same `{ accepted: true }` shape, including unknown addresses and incorrect keys. The response does not confirm membership or reveal an existing capability.

The browser creates the preference key from 32 cryptographically random bytes. Only its SHA-256 digest is saved in `newsletterSubscribers/n_<sha256(normalizedEmail)>`. Email normalization trims and lowercases but does not merge plus-addressing or provider-specific aliases. The record includes `pending`/`unsubscribed` status, the consent version `vela-newsletter-v1`, consent/opt-out timestamps, and server creation/update times.

A duplicate signup never reveals or replaces an existing key. Existing state changes—including renewal after unsubscribing—require a matching key. Email-only mutations are rejected. Unknown-address unsubscribe and incorrect-key requests make no record changes. There are no existence-checking lookup endpoints. Consent here records the submitted preference; it is not evidence that the submitter owns the email address. Connecting a provider later requires verified email opt-in and its own delivery/unsubscribe workflow.

## Private preference links and browser storage

The form saves its email-specific key in same-origin localStorage under `vela:newsletter-preference:v1:<normalizedEmail>`. It retains an existing saved key rather than replacing it with an unverified incoming fragment. If storage is unavailable, the current form and private link still carry the capability.

After a preference request, `Open private preferences` links to `/newsletter#email=<encodedEmail>&key=<64hex>`. The accompanying text asks the user to bookmark or copy it and explains that an existing signup needs its original link/browser preference. The fragment is parsed only in the browser; email/key are never placed in query parameters or sent as part of the page GET. Opening or prefetching a link only fills the form and **does not mutate state**. The user must press Unsubscribe to POST the capability. Keep the link private because possession authorizes preference changes.

Without a saved browser key or private link, the form explains what is needed and offers the contact route instead of performing an email-only opt-out. Generic success copy is deliberately conditional for unsubscribe so it does not reveal whether an address/key pair was present.

## Admin inbox and access control

`GET /api/admin/support` returns `{ messages, limit: 100, truncated, next }`; `after` pages older records by server creation time and document ID. `GET /api/admin/support/:id` returns `{ message }` or 404. Readers call `requireAdmin` independently and return no-store responses. Internal fingerprints are omitted from their projections.

`PATCH /api/admin/support` takes `{ id, status }`, where status is `new`, `reviewing`, or `closed`. Its service independently verifies the admin claim, and effective status changes commit with an audit event. Repeating the same status does not create another audit. Status changes do not modify message content or send replies. The admin support pages are part of the same protected administration area.

Both `contactMessages` and `newsletterSubscribers` are covered by the Firestore rules' default deny. Visitors, customers, and admins using browser Firebase clients cannot directly read or write these collections. Server Admin SDK access is mediated by the public bounded submission services and authorized admin inbox services.

## Abuse limits and validation

Every mutation route verifies the configured same origin before processing. Public routes use the shared durable Firestore limiter: contact allows 60 total requests/minute and 5 per normalized email/15 minutes; newsletter allows 120 total/minute and 10 per email/15 minutes. Limits apply to retries as well. Global limits prevent changing/spoofing client IP or email from bypassing all throttling. Rate-limit document IDs are hashes; neither preference keys nor message bodies are included in rate keys. A global limit can temporarily affect all visitors; capacity changes should be deliberate for actual traffic.

Admin status writes allow 60 requests/admin/minute and require same origin plus verified admin claims. All schemas are strict, body reading is bounded by the shared 64 KB limit, and no client roles, timestamps, stored state, or unknown fields are accepted. These controls are a small-store baseline, not a replacement for production abuse monitoring.

## Verification

`tests/support.test.ts` exercises transactional contact retries, retry mismatch protection, newsletter consent/deduplication/capability ownership, generic responses, admin guards, atomic audit writes, pagination, origin rejection, and the actual durable rate limiter using an injected in-memory store. Browser/emulator acceptance is tracked by the main project; no delivery-provider verification is applicable because no email provider is invoked.
