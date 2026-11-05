# Security review and boundaries

Reviewed locally on 2026-11-06. This is an implementation review and local test record, not a claim of production penetration testing.

## Enforced boundaries

- Firebase is authoritative outside explicit demo mode. Demo fixtures never replace a failed Firebase request. Emulator access requires a `demo-` project, the fixed loopback Auth/Firestore hosts, and no Vercel environment. Configuration is checked before an existing Admin app is reused.
- Firebase verifies ID tokens and session cookies with revocation checking. Starting a session requires recent authentication. The five-day cookie is httpOnly, SameSite=Lax, path `/`, and Secure for HTTPS. Administrator access requires the verified boolean custom claim `admin === true`; profile data and browser request fields cannot grant it.
- Browser mutations require the exact configured Origin. `getApplicationUrl()` rejects missing or malformed configuration, non-root paths, query strings, fragments, credentials, and non-HTTPS external URLs. Local HTTP is limited to loopback addresses, and a Vercel deployment rejects every loopback origin. The same parsed URL controls the session cookie and public metadata.
- JSON request bodies are bounded while streaming. Invalid UTF-8 returns 400, oversized input returns 413, and rejected streams are cancelled. Strict schemas reject unknown fields such as browser-supplied roles or payment status.
- Customer order reads and pagination cursors are scoped to the verified user. Prices and stock come from stored products. Reservations, order snapshots, inventory transitions, event receipts, and audit entries use transactions and idempotency keys.
- Only a verified test-mode Stripe webhook may mark an order paid. A success URL, administrator fulfillment request, provider retrieval, or local expiry timer is insufficient. Release and recovery require provider evidence, and reconciliation backs off unresolved reservations. The cron endpoint requires its configured bearer secret.
- Cloudinary upload completion verifies provider metadata against an administrator-owned upload ticket. Gallery references and deletion state are transactional; referenced assets cannot be destroyed through the application.
- Firestore rules deny all direct client writes. Private reservations, payment receipts, media records, throttles, promotions, contact messages, and newsletter records remain server-only, including for admin clients. Public products must be published; profiles and orders require ownership or an admin claim.
- Contact retries bind an unguessable request key to canonical content. Newsletter records remain pending, and opt-out requires the original private capability. The server stores only its hash and returns generic responses; a duplicate signup cannot replace the capability. No email delivery or ownership verification is represented as completed.

## Review findings and corrections

The Phase 10 review found two request/configuration defects. Fatal UTF-8 decoding previously reached the generic 500 response; it now returns a client error without consuming the rest of the stream. Application URL parsing previously accepted external HTTP, credentials, and suffixes while deriving cookie security; strict shared origin validation now rejects them before authentication or mutation.

Three additional regression cases demonstrated hosted loopback URL acceptance. The shared helper now rejects those origins whenever the Vercel environment is present, matching checkout's deployed-origin restriction and preventing a hosted localhost misconfiguration from selecting a non-Secure cookie.

Earlier phases corrected privileged Admin cache reuse after configuration changes, unbounded streaming bodies, invalid document-slug errors, reservation recovery queue starvation, and unrelated Stripe event handling. The review retained those protections.

## Surfaces and evidence

The final pass inspected the authentication and request boundaries, Admin configuration, API mutation guards, owner-filtered order queries and cursors, profile updates, fulfillment/payment separation, media ticket ownership, cron authentication, Firestore rules, and the indexes supporting those queries. Services, provider adapters, and rules were reviewed without broad rewrites.

`tests/configuration.test.ts` covers origin normalization/rejection, malformed UTF-8 including split byte sequences, stream limits/cancellation, explicit demo mode, and cached Admin configuration guards. `tests/session-security.test.ts` exercises actual route functions with controlled Firebase/cookie dependencies: Secure-cookie selection, exact Origin, strict inputs, recent and revocation-checked authentication, strict admin claims, and logout revocation. All 53 scoped cases passed after the corrections, including the three hosted-loopback regressions that failed before the guard.

Existing service, rules-emulator, and desktop/mobile browser tests cover transaction rollback/concurrency, payment signatures and duplicate events, customer isolation, administrator mutations, contact retries, newsletter capabilities, and private-record read denial. Detailed phase evidence and final aggregate checks are recorded in `VELA_PLAN.md`; a scoped pass is not the full release gate.

## External verification still pending

No production credentials were supplied. Hosted Firebase behavior, external Google sign-in and email delivery, real Cloudinary uploads/deletions, Stripe test checkout and delivered webhook/recovery behavior, and Vercel deployment configuration remain unverified. Runbooks and local tests do not substitute for those checks. Restart the server after changing Firebase project, emulator mode, or service credentials.
