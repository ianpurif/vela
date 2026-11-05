# Release verification

Verified locally on 2026-11-06 (Asia/Manila), using Node 24.22.2, npm 11.19.1, Java 21, Chromium, and loopback Firebase emulators. Production browser checks used the actual `next build` output served by `next start`, with application source held unchanged during each run.

## Executed checks

| Check | Observed result |
| --- | --- |
| TypeScript | Passed, including generated Next.js route declarations |
| Whole-project ESLint | Passed |
| Source Prettier check | Passed |
| Vitest unit/service/UI tests | 365 passed across 17 files, including the strict CommonJS runtime regression |
| Firestore emulator rules/transactions | 24 passed across 2 files, rerun after emulator restart |
| Production build | Passed; all routes compiled and static metadata generated |
| Production accessibility journeys | 10 passed; 72 page/state axe scans clear |
| Additional production journeys | 30 passed; 10 intentional project-specific skips |
| Focused final navigation hover/keyboard check | Passed after the hover-color correction |
| npm audit, full and production-only | Zero reported vulnerabilities |
| Public metadata | Sitemap contains 10 public routes and 6 published products; canonical, robots, and icon endpoints checked |

The 40 applicable browser journeys cover customer registration, sessions, profile/address persistence, emulator verification/reset/Google popup flows, role and ownership enforcement, administrator catalog/inventory/media/operations, checkout retry and stored-state behavior, contact/newsletter privacy, routine matching, cart persistence, and real rendered cinematic behavior. The ten skips avoid repeating server-only identity/security checks across viewports or running desktop-only 3D cases on mobile; they are not failed or unimplemented journeys.

Payment tests use the official Stripe SDK's generated signatures and controlled provider fixtures. They verify amounts, test-mode enforcement, duplicate/out-of-order events, stock concurrency, cancellation and reservation recovery. They do not prove actual Stripe API or webhook delivery. Media tests similarly exercise authorization, provider-metadata validation and reference protection without claiming a real Cloudinary upload.

## Production stabilization audit — 2026-11-06

The deployed `vela-essentials` database now has all ten declared composite indexes in READY state. Actual catalog/recovery queries and both persisted homepage documents were inspected directly. `npm run verify:production -- --project vela-essentials` passed 13 read-only runtime checks, including index usability, content/catalog validation and Firebase's authorized authentication domain. The Vercel prebuild path was also exercised against real hosted data with CommonJS/ESM interop disabled. A local build, whole-project lint/typecheck/formatting and all 365 existing unit tests passed after the changes; no new test files or mocks were added.

Live HTTP checks covered public, account/admin redirects, metadata and API authorization/validation boundaries. The homepage, shop, product, routine and supporting pages returned 200 without the error boundary. Authenticated reservation recovery returned 200 with `{ inspected: 0, released: 0, awaitingWebhook: 0, errors: 0 }`; missing/incorrect bearer credentials were rejected. Sixteen public pages were loaded in desktop Chromium and six were checked again at a mobile viewport, with no page exceptions, console errors, broken loaded images or horizontal overflow. Unknown product/routes returned 404, unsigned Stripe webhooks returned 400, and cross-origin session requests returned 403. Direct unauthenticated Firestore REST reads returned 200 for published catalog/home settings and 403 for promotions, users, orders, reservations, webhook receipts and audit logs. Evidence is in ignored `.local/production-route-audit.json`, `.local/production-final-http.json` and `.local/production-browser-audit/`.

A real unsupported compound query was used to verify the API's `DATABASE_INDEX_NOT_READY` response: 503 plus `Retry-After: 60`, without leaking the provider's index-creation URL to the caller. The real empty reservation queue was checked without initializing a Stripe gateway; nonempty recovery still requires provider reconciliation and retains existing inventory/payment safeguards. No alternate query/data fallback was introduced.

The audit found and corrected a separate Firebase Auth configuration issue: `velaglow.vercel.app` was absent from the authorized OAuth domains. That exact domain was added, existing domains were preserved, and Email/Password and Google provider enablement were verified. Stripe's test key was accepted and its enabled snapshot webhook matched API version `2026-10-28.endive` plus the four expected Checkout events. Cloudinary's authenticated ping succeeded. These configuration checks do not claim completed purchases, upload/deletion or delivered-email workflows. No customers, orders, support submissions or marketing signups were created in production. Content-only initialization made zero writes because the existing records were complete.

The code fixes were pushed to `main` through `e6a641c`. Vercel reported a successful deployment at [the release dashboard](https://vercel.com/sacredmind2002gmailcoms-projects/velaglow/ESZhDhEvm6Wjzmm3iLMtDyrdP9tf), and the deployed public/recovery/security checks above passed afterward.

## Local performance observations

One navigation per viewport was measured against the warm local production server, in fresh browser contexts without network/CPU throttling. These are local observations, not field Core Web Vitals, a Lighthouse score, or a representative INP measurement.

| Observation | Desktop 1440×1000 | Mobile 390×664 |
| --- | --- | --- |
| Largest Contentful Paint | 264 ms | 136 ms |
| Cumulative Layout Shift, session-window calculation | 0.00258 | 0 |
| Time to first byte | 35.5 ms | 21.6 ms |
| Initially fetched encoded JavaScript | 306,139 bytes / 15 scripts | 306,139 bytes / 15 scripts |
| Three.js initialized on initial viewport | No; story deferred | No; static story |
| Largest observed interaction event duration | 56 ms across 4 observed interaction IDs | 32 ms across 3 observed interaction IDs |
| Longest observed main-thread task | 447 ms | No task over 50 ms recorded |

The desktop run recorded 397 ms of task time beyond the 50 ms long-task threshold. This warrants profiling on target hardware; no physical-GPU or constrained-device performance claim is made. The measured search/bag interactions completed, with no runtime errors. Raw measurements and the local measurement script are in `.local/production-performance.json` and `.local/measure-performance.mjs`.

The separate cinematic browser suite uses actual ANGLE SwiftShader rendering. It verifies changed raster output with scroll, zero additional draw calls while idle/offscreen, context disposal, stable section geometry, and static fallbacks. See [CINEMATIC.md](CINEMATIC.md). Physical-device FPS and representative field INP remain unmeasured.

## Review and evidence

Accessibility fixes, keyboard checks, screenshots, and assistive-technology limits are documented in [ACCESSIBILITY.md](ACCESSIBILITY.md). Security review and local regression coverage are in [SECURITY.md](SECURITY.md); dependency overrides and audits are in [DEPENDENCIES.md](DEPENDENCIES.md). [INDEXES.md](INDEXES.md) maps every current query to its required indexes and records application result limits.

Ignored local evidence is available at:

- `.local/accessibility-final/report/index.html` and `.local/accessibility-hover/report/index.html`
- `.local/production-regression/report/index.html` (30 passed / 10 skipped)
- `.local/production-regression.log` and `.local/production-performance.json`
- `.local/accessibility-final/visual/` (actual desktop/mobile viewport and focus captures)

`next-env.d.ts` is generated and ignored, as required by the installed Next.js documentation. `npm run typecheck` generates declarations before invoking TypeScript, so it does not depend on a previously tracked development build.

## Verification still requiring external setup

The production stabilization audit above supersedes the initial credential-free status for deployment, index readiness, content reads, authentication configuration, provider credentials and the recovery endpoint. Full signed-in hosted journeys, delivered verification/reset email, Cloudinary upload/deletion, actual Stripe test purchases/webhook deliveries, and cron-job.org account execution history remain separate acceptance work. Newsletter delivery is intentionally not implemented: signups remain pending and support messages are stored for administrator review. See [the setup runbook](DEPLOYMENT.md).
