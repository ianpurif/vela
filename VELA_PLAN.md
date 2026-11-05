# VELA implementation ledger

## Current state

Current phase: **11 — Environment configuration and finalization**. Started 2026-11-05 (Asia/Manila); continuing 2026-11-06.
Repository initially contained only 20 supplied PNG images. No application, Git repository, parent AGENTS.md, or credentials were present. Initial runtime was Node 22.16/npm 10.9; the host later changed to Node 24.22.2/npm 11.19.1 and checks continue to pass. Java 21 and Git are available; Blender is not on PATH.

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
| 0 Discovery | none | Inspect every image, define architecture, create instructions and phase ledger; separate architecture commit | complete |
| 1 Foundation | 0 | Compatible stack, design tokens, reusable primitives, responsive navigation/layout/errors; server starts, typecheck/lint | complete |
| 2 Storefront | 1 | Supplied imagery, home/catalog/search/filter/sort/details/cart; catalog and persistence checks, mobile QA | complete |
| 3 Firebase/auth | 2 | Repository-backed Firestore, secure sessions, registration/Google/reset/verification/profile/addresses, seed/rules/indexes; emulator isolation checks | complete |
| 4 Admin | 3 | Claim-gated dashboard, product CRUD/categories/inventory, bootstrap CLI/audits; persistence and unauthorized-access checks | complete |
| 5 Media | 4 | Signed Cloudinary uploads/gallery/remove/import; authorization, validation and reference protection tests | complete locally; external upload pending |
| 6 Payments | 5 | Persistent cart, authoritative totals, orders/reservations, test-only checkout/webhooks/recovery; concurrency/idempotency/signature tests | complete locally; external Stripe pending |
| 7 Operations | 6 | Customer order history, admin fulfillment/customers/content/analytics; ownership and separate payment state checks | complete |
| 8 Personalization | 7 | Deterministic quiz/routine-to-cart, support/policy pages, contact/newsletter persistence; functional links/forms | complete |
| 9 Cinematic | 8 | GSAP scroll story, lazy R3F/Drei procedural or GLB scene, Motion UI; static/reduced-motion/mobile fallbacks | complete |
| 10 Quality | 9 | Typecheck/lint/unit/integration/Playwright/rules/webhook/build; accessibility/security/responsive review and fixes | complete locally |
| 11 Finalization | 10 | Complete env examples, setup/deployment/runbook, final report and clean incremental history; explicitly list external verification gaps | in progress |

## Completed tasks and validation

The requested Next.js/Vercel target takes precedence over Sites hosting. Parallel work uses explicit file ownership; the primary agent reviews, validates and commits each unit. Counts below record checks at each phase acceptance, not the final total.

- Phase 0: f64af38 architecture/instructions; 43f146c complete image audit and optimized copies (92% smaller). All 20 images decoded and visually reviewed.
- Package compatibility verified against npm metadata and official documentation; React 19 / Fiber 9, Next 16 / Tailwind 4, Firebase 12 / rules testing 5 fit Node 22.16 and Java 21.

- Phase 1: babf523 typed framework/design foundation. TypeScript and ESLint passed; dev server ready and homepage returned HTTP 200. Brand fonts are self-hosted. Catalog and responsive shopping shell now build on these contracts.

- Phase 2: a7c366d catalog contracts/fixtures; 3a92085 catalog, galleries, filters and persistent cart. Twelve Vitest checks and four desktop/mobile Playwright checks passed; typecheck and lint clean. Desktop/mobile homepage screenshots visually reviewed. Fixed development-toolbar focus interference before final browser checks.
- Security dependency maintenance: da6f65a targeted transport/tool patches; production npm audit reports zero vulnerabilities. Development-only Firebase CLI and lint transitive advisories remain under review.

- Phase 3: c0973f8 Firebase rules/indexes/emulators/bootstrap; e7182de Firestore repositories and secure sessions. Seed created 11 catalog/content docs without overwriting existing data. All 17 emulator rules tests, seven configuration/security unit tests, one API session/ownership browser test, and four desktop/mobile account journeys passed. Auth forms include Google/reset/verification; external Google and delivered email remain pending credentials. Security review fixes: bounded request streaming, configuration checks before Admin cache, invalid-slug 404.

- Phase 4: d6c0902 audited catalog/category/inventory services and atomic test adapter. Sixteen focused mutation/transaction tests passed, plus emulator API create/publish/archive and role checks. Desktop and mobile admin edit/stock workflows passed. Fixed a hidden table label escaping its scroll container on mobile; action cells now remain visible with larger tap areas. Typecheck/lint clean.
- Additional auth validation: e7b7980 exercises actual emulator verification/reset codes and Google popup sign-in; all three scenarios passed. 7c59364 fixes CSS layer precedence and removes global smooth scrolling.
- Phase 4 UI: 6b88a9a protected product/category/inventory screens and responsive admin shell.
- Phase 5: 23f5794 signed media services and verified metadata/reference protection. Twenty-nine service tests, typecheck, scoped ESLint and the emulator/browser media authorization/gallery/error journey passed. Import dry-run covered all 12 local product-image references; missing credentials block apply before upload. Admin gallery supports replacement, ordering, removal and retry, with detached cloud assets requiring explicit deletion. Real Cloudinary uploads/deletions remain pending credentials.
- Phase 5 UI/import: ed4bf11 integrates the secure gallery, transformations and source-image import.
- Phase 6: de9741a test-only Stripe gateway/raw signature verification; ce01cf0 transactional orders, reservations, cancellation and recovery. Sixty-six gateway/signature tests, 33 payment service tests, nine checkout UI tests, six auth UI tests and two actual Firestore transaction tests passed. Desktop/mobile checkout journeys passed (retry identity, safe missing-config response, stored pending confirmation, ownership, retained bag). Typecheck and scoped ESLint clean; responsive screenshots reviewed. Read-only security review found and resolved recovery queue starvation and unrelated webhook handling. No real Stripe API call or payment occurred. See docs/PAYMENTS.md for recovery and external verification.
- Phase 7: stable owner-checked pagination, customer fulfillment progress, audited admin fulfillment, indexed customer search, content/promotions editing, and scoped analytics are complete. All 215 unit tests and 20 emulator tests passed; the desktop/mobile operations journeys passed with zero browser errors. Those journeys exercised actual local test records, verified analytics deltas, enforced customer isolation and payment/fulfillment separation, and restored edited content. Screenshots were reviewed. TypeScript and focused lint passed. Seed/backfill created the missing promotion record and indexed 13 existing local profiles without replacing user data.
- Local development: Windows Turbopack began serving stale server modules and repeatedly reloading with source edits paused. Switching the dev command to supported Webpack mode resolved this and passed both browser journeys. The project root is explicit; production build remains a Phase 10 check.
- Phase 8: five-step deterministic routine finder, explained matches and atomic routine-to-cart are complete. About, contact, FAQ, shipping, returns, privacy, terms and newsletter preferences resolve. Contact retries persist once; private newsletter capabilities protect opt-out; admin support status changes are audited. All 259 unit tests passed (including 17 routine and 27 support cases), all 21 rules tests passed, and TypeScript/scoped lint passed. Four desktop/mobile personalization/support journeys passed; the two support journeys passed again after a submit-handler lint correction. Tests exercise stored-record retries, actual catalog exclusions, consent, private-key ownership, client read denial, customer 403s and administrator review. Final mobile and desktop captures were visually reviewed; sticky-header screenshot artifacts were resolved by capturing at scroll zero. No email delivery is implemented or claimed; subscriptions remain pending.
- Phase 9: scoped GSAP hero/editorial motion, Motion navigation/search and the lazy First Light Serum story are complete. The procedural bottle matches the supplied reference; local GLB loading is supported but no authored GLB is supplied. All 317 unit tests, TypeScript/scoped lint, four storefront journeys and six applicable cinematic browser journeys passed (four project-specific skips). Tests verify actual software WebGL draws and changing raster output, mobile/reduced-motion/short-window/no-WebGL fallbacks, navigation/context disposal and preference changes. The 1440×912 canvas produced zero extra draws over 45 idle browser frames and 30 offscreen frames. Local measured layout-shift sum was 0.00259, unchanged after story entry; section geometry was identical before/after readiness. Desktop front/back and static layout captures were reviewed. These are local Chromium SwiftShader observations, not hardware FPS or field Core Web Vitals. Evidence is in ignored `.local/phase9-browser-report` and `.local/phase9-desktop-report`.

Phase 10 acceptance: all 363 unit tests, 24 emulator rules/transaction tests, full ESLint/TypeScript/formatting, and the production build passed. Against `next start`, 10 accessibility journeys (72 clean scans) and 30 additional customer/admin/cinematic journeys passed; 10 viewport-specific duplicates were intentionally skipped. A focused navigation-hover check passed after its correction. Strict application origins and malformed UTF-8 handling were repaired; audit findings are zero for both full and production dependencies. All current Firestore query/index shapes were reviewed. Local LCP was 264/136 ms and CLS 0.00258/0 for desktop/mobile; one 447 ms desktop main-thread task remains a target-hardware profiling consideration. Details and measurement limits are recorded in `docs/QUALITY.md`.

## Commits grouped by phase

| Phase | Commits |
| --- | --- |
| 0 | f64af38 architecture; 43f146c asset audit/optimization |
| 1 | babf523 framework/design system; da6f65a production dependency fixes |
| 2 | a7c366d catalog contracts; 3a92085 products/cart; 50c60d5 editorial home/navigation |
| 3 | c0973f8 rules/emulators/CLI; e7182de repositories/sessions; 5026fc2 customer auth/profile; e7b7980 verification/reset/Google tests |
| 4 | d6c0902 audited admin services; 7c59364 responsive CSS/native scroll fix; 6b88a9a admin UI |
| 5 | 23f5794 verified media services; ed4bf11 gallery/delivery/import |
| 6 | de9741a Stripe gateway/signatures; ce01cf0 payments/inventory/recovery; 4be22b5 checkout/confirmation |
| 7 | 2b9a74c owned order pagination; 00e705f operations services; dbf04c9 customer history; c04cb14 admin operations UI; 6706abb development compilation fix |
| 8 | 6911474 support privacy rules; aae9b8f routine matching/cart; 98f1d4f support persistence; 8aa55a1 quiz UI; 708920b customer care/forms; 240d69c support inbox; ca008cb browser journeys |
| 9 | df79e7c editorial/navigation motion; b5a325e deterministic poses; d537177 lazy product story/fallbacks; 984c6fd rendering/browser tests |
| 10 | d2b643b dependency fixes; 73005b7 index review; 0010e0a request/origin security; a5f5b6b SEO/landmarks; 86d8142 accessibility fixes; d6c3790 accessibility tests; ee94cf4 generated declaration hygiene |

Git history is the authoritative complete commit list. Each phase's final commit is recorded by the following ledger update.

## Known issues / external verification

- No external Firebase, Cloudinary, Stripe or Vercel credentials supplied. Hosted authentication/Google/email delivery, real Cloudinary uploads/deletion, actual Stripe test payments/webhooks and deployment remain unverified. Local Firebase emulators are actually exercised.
- Supplied labels sometimes differ from catalog names. Accurate HTML names are used; Clear Day Milk uses a neutral illustration because its source photo has unsupported SPF claims.
- Full and production npm audits are clean. Exact development overrides and their compatibility checks are documented in `docs/DEPENDENCIES.md`.
- Local release checks are complete. Physical-device performance, field Core Web Vitals and screen-reader narration remain unmeasured; the local desktop probe recorded one long main-thread task, as disclosed in `docs/QUALITY.md`.

## Next steps

Finalize `.env.example`, local setup and Vercel deployment instructions, service verification steps and the final report. Keep real credentials out of Git and preserve the explicit distinction between implemented integrations and externally verified behavior.
