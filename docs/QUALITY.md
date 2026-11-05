# Release verification

Verified locally on 2026-11-06 (Asia/Manila), using Node 24.22.2, npm 11.19.1, Java 21, Chromium, and loopback Firebase emulators. Production browser checks used the actual `next build` output served by `next start`, with application source held unchanged during each run.

## Executed checks

| Check | Observed result |
| --- | --- |
| TypeScript | Passed, including generated Next.js route declarations |
| Whole-project ESLint | Passed |
| Source Prettier check | Passed |
| Vitest unit/service/UI tests | 363 passed across 16 files |
| Firestore emulator rules/transactions | 24 passed across 2 files, rerun after emulator restart |
| Production build | Passed; all routes compiled and static metadata generated |
| Production accessibility journeys | 10 passed; 72 page/state axe scans clear |
| Additional production journeys | 30 passed; 10 intentional project-specific skips |
| Focused final navigation hover/keyboard check | Passed after the hover-color correction |
| npm audit, full and production-only | Zero reported vulnerabilities |
| Public metadata | Sitemap contains 10 public routes and 6 published products; canonical, robots, and icon endpoints checked |

The 40 applicable browser journeys cover customer registration, sessions, profile/address persistence, emulator verification/reset/Google popup flows, role and ownership enforcement, administrator catalog/inventory/media/operations, checkout retry and stored-state behavior, contact/newsletter privacy, routine matching, cart persistence, and real rendered cinematic behavior. The ten skips avoid repeating server-only identity/security checks across viewports or running desktop-only 3D cases on mobile; they are not failed or unimplemented journeys.

Payment tests use the official Stripe SDK's generated signatures and controlled provider fixtures. They verify amounts, test-mode enforcement, duplicate/out-of-order events, stock concurrency, cancellation and reservation recovery. They do not prove actual Stripe API or webhook delivery. Media tests similarly exercise authorization, provider-metadata validation and reference protection without claiming a real Cloudinary upload.

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

Hosted Firebase/Google/email behavior and deployed rules/indexes, real Cloudinary uploads/deletions, Stripe test Checkout plus delivered webhooks/recovery, and Vercel deployment/scheduling remain unverified because credentials were not supplied. Newsletter email delivery is intentionally not implemented: signups remain pending and support messages are stored for administrator review. See [the setup runbook](DEPLOYMENT.md) before external verification.
