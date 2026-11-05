# VELA implementation ledger

## Current state

Current phase: **0 — discovery and architecture**. Started 2026-11-05 (Asia/Manila).
Repository initially contained only 20 supplied PNG images. No application, Git repository, parent AGENTS.md, or credentials were present. Node 22.16, npm 10.9, Java 21 and Git are available; Blender is not on PATH.

## Architecture and invariants

- Next.js App Router with storefront, auth, account, admin, and API boundaries. Shared product, profile, cart, order, reservation, and content contracts.
- CatalogRepository isolates read-only demo fixtures from Firestore. Production operations require Firebase configuration. Explicit local emulator mode supports real authentication and persistent application flows without production credentials.
- Firebase client authentication exchanges a recently issued ID token for a revocation-checked, httpOnly session cookie. Same-origin checks protect authenticated mutations; custom admin claims are checked server-side. Clients cannot write commerce collections directly.
- Firestore repositories own transactions. Services validate prices/quantities, snapshot order lines, reserve stock, reconcile signed Stripe events, and audit admin changes. Payment and fulfillment are distinct states.
- Checkout reserves available stock transactionally, creates a test-mode Stripe session with an idempotency key, and records the session. Verified webhook events finalize or release reservations once. Expiration reconciliation checks Stripe before releasing inventory.
- Cloudinary signs administrator uploads into a constrained folder; uploaded metadata is verified server-side, references are persisted, and referenced media cannot be destroyed.
- UI shares the same product/cart types and APIs throughout all phases. GSAP and Three.js enhance existing shopping components after business flows work.
- Vitest covers deterministic domain/services behavior; emulator tests exercise rules, transactions and authorization; Playwright covers customer/admin journeys and responsive accessibility. Typecheck, lint and production build form the final gate.

## Phase dependency and acceptance ledger

| Phase | Dependencies | Objectives / acceptance | State |
| --- | --- | --- | --- |
| 0 Discovery | none | Inspect every image, define architecture, create instructions and phase ledger; separate architecture commit | in progress |
| 1 Foundation | 0 | Compatible stack, design tokens, reusable primitives, responsive navigation/layout/errors; server starts, typecheck/lint | pending |
| 2 Storefront | 1 | Supplied imagery, home/catalog/search/filter/sort/details/cart; catalog and persistence checks, mobile QA | pending |
| 3 Firebase/auth | 2 | Repository-backed Firestore, secure sessions, registration/Google/reset/verification/profile/addresses, seed/rules/indexes; emulator isolation checks | pending |
| 4 Admin | 3 | Claim-gated dashboard, product CRUD/categories/inventory, bootstrap CLI/audits; persistence and unauthorized-access checks | pending |
| 5 Media | 4 | Signed Cloudinary uploads/gallery/remove/import; authorization, validation and reference protection tests | pending |
| 6 Payments | 5 | Persistent cart, authoritative totals, orders/reservations, test-only checkout/webhooks/recovery; concurrency/idempotency/signature tests | pending |
| 7 Operations | 6 | Customer order history, admin fulfillment/customers/content/analytics; ownership and separate payment state checks | pending |
| 8 Personalization | 7 | Deterministic quiz/routine-to-cart, support/policy pages, contact/newsletter persistence; functional links/forms | pending |
| 9 Cinematic | 8 | GSAP scroll story, lazy R3F/Drei procedural or GLB scene, Motion UI; static/reduced-motion/mobile fallbacks | pending |
| 10 Quality | 9 | Typecheck/lint/unit/integration/Playwright/rules/webhook/build; accessibility/security/responsive review and fixes | pending |
| 11 Finalization | 10 | Complete env examples, setup/deployment/runbook, final report and clean incremental history; explicitly list external verification gaps | pending |

## Completed tasks and validation

- Read the full supplied brief and inspected repository, parent instructions, available runtimes and Git state.
- Asset review and official compatibility research delegated with separate file ownership.
- Chose the requested Next.js/Vercel hosting target; Sites hosting is not used because its Worker runtime differs from the requested Firebase Admin architecture.

## Commit ledger

Commit hashes are recorded after each logical unit in subsequent ledger updates. Git history is the authoritative full list.

## Known issues / external verification

- No Firebase, Cloudinary, Stripe or Vercel credentials supplied. Implement and locally test integrations, then provide configuration steps; do not claim external success.
- Supplied image labels sometimes differ from fictional catalog names; use accurate HTML names. Clear Day Milk photograph contains unsupported SPF text, which must not become a product claim.

## Next steps

Finish asset audit and dependency verification, commit discovery, initialize the application, and validate the foundation before catalog work.
