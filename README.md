# VELA

**A better ritual for everyday skin.** A fictional luxury skincare store with six products, an editorial storefront, customer accounts, an administrator workspace, and Stripe **test payments only**.

The implementation is complete locally through phases 0–11. Hosted Firebase/Google/email, Cloudinary uploads, Stripe test transactions/webhook delivery, and Vercel deployment still require the developer's credentials and external verification. See [the setup and deployment runbook](docs/DEPLOYMENT.md).

## Start locally

Use Node **24.x** and Java **21** for the Firebase emulators. Final checks ran on Node 24.22.2 and npm 11.19.1; deployment is pinned to that Node major. Commands below use PowerShell, from the repository root.

```powershell
npm ci
# Fresh checkout only; preserve an existing .env.local.
if (-not (Test-Path .env.local)) { Copy-Item .env.emulator.example .env.local }
npm run emulators
```

Keep that terminal open. In a second terminal:

```powershell
npm run seed -- --project demo-vela
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Use that exact origin: `localhost` is a different origin for session protections. The emulator UI is [http://127.0.0.1:4000](http://127.0.0.1:4000).

| Local fixture account | Password | Destination |
| --- | --- | --- |
| `customer@example.test` | `Vela-local-2026!` | `/account` |
| `admin@example.test` | `Vela-local-2026!` | `/admin` |

These accounts exist only in the isolated `demo-vela` emulators. The seed creates missing records and preserves existing edits. Emulator data is ephemeral with the default command; run the seed again after restarting the emulators. Email actions are shown in the emulator output, and Google sign-in uses its local provider simulator. Cloudinary and Stripe return clear configuration errors until their real test credentials are supplied.

For a read-only visual demo, use `.env.demo.example` as `.env.local` instead. Accounts and backend mutations are unavailable in that explicit mode. Restart after environment changes. Never combine demo fixture identifiers with a real Firebase project.

To inspect the optimized production build locally, stop the dev server, keep emulators running, then:

```powershell
npm run build
npm run start
```

## Delivered experience

- Responsive home, searchable/filterable catalog, product galleries, persistent bag, authoritative checkout totals, customer profile/addresses and order history.
- Firebase email/password and Google sign-in, verification/reset, secure server sessions, customer isolation and custom-claim administrator authorization.
- Administrator product/category/inventory management, Cloudinary galleries, orders/fulfillment, customer search, homepage content, scoped analytics, audit history and support inbox.
- Transactional stock reservations, verified and idempotent Stripe webhooks, cancellation/expiry recovery, and separate payment/fulfillment states.
- Deterministic five-step routine matching, routine-to-bag, contact storage, private newsletter preferences and supporting policy pages. Newsletter signups remain pending; email delivery is not implemented.
- GSAP editorial motion, Motion interfaces, and a lazy R3F/Drei product story with static mobile/reduced-motion/WebGL fallbacks. Procedural geometry matches the supplied First Light bottle; local GLB models are supported.

The 20 supplied originals remain in `images/`; optimized assets are in `public/images/`. Accurate HTML labels and a neutral Clear Day illustration avoid unsupported packaging claims. See [the asset audit](docs/ASSETS.md).

## Verification

```powershell
npm run typecheck
npm run lint
npm run format:check
npm test
# Keep the local Firebase emulators running for this separate suite.
npx vitest run --config vitest.emulator.config.ts
npm audit
npm audit --omit=dev
```

For browser tests, use the emulator configuration, seed the database, and run the application at `http://127.0.0.1:3000`. Playwright does not start the server. Use `npm run build` and `npm run start` for release verification, and keep application source unchanged while testing.

```powershell
npx playwright install chromium
$env:VELA_E2E_EMULATOR = "1"
$env:PLAYWRIGHT_BASE_URL = "http://127.0.0.1:3000"
npm run test:e2e
Remove-Item Env:VELA_E2E_EMULATOR
Remove-Item Env:PLAYWRIGHT_BASE_URL
```

The browser suites create local fixture records and expect missing external Stripe/Cloudinary configuration. Run them against the isolated emulator setup, then use the runbook's acceptance checks for configured providers. `VELA_E2E_EMULATOR` and `PLAYWRIGHT_BASE_URL` are test controls, not deployment variables.

Final results: **363 unit tests, 24 emulator tests, 40 applicable browser journeys, and 72 clean axe scans**; ten project-specific browser cases intentionally skipped. TypeScript, ESLint, formatting, production build, and both dependency audits passed. [QUALITY.md](docs/QUALITY.md) records evidence and limits, including the observed desktop long task and unmeasured physical-device/field performance.

## Configuration and project guide

[`.env.example`](.env.example) lists every external-service variable and documents optional local emulator settings. Configure Firebase, Google sign-in, Admin credentials, rules/indexes, an initial administrator, Cloudinary, Stripe test webhooks, and Vercel using [DEPLOYMENT.md](docs/DEPLOYMENT.md). No deployment or external provider verification has been performed.

| Area | Reference |
| --- | --- |
| Phase acceptance and commits grouped by phase | [VELA_PLAN.md](VELA_PLAN.md) |
| Project conventions | [AGENTS.md](AGENTS.md) |
| Firebase, roles and seed | [FIREBASE.md](docs/FIREBASE.md) |
| Cloudinary galleries/import | [MEDIA.md](docs/MEDIA.md) |
| Checkout/webhooks/recovery | [PAYMENTS.md](docs/PAYMENTS.md) |
| Orders, content, customers and analytics limits | [OPERATIONS.md](docs/OPERATIONS.md) |
| Routine matching and support privacy | [ROUTINE.md](docs/ROUTINE.md), [SUPPORT.md](docs/SUPPORT.md) |
| Animation and model conventions | [CINEMATIC.md](docs/CINEMATIC.md) |
| Security, query indexes and dependency decisions | [SECURITY.md](docs/SECURITY.md), [INDEXES.md](docs/INDEXES.md), [DEPENDENCIES.md](docs/DEPENDENCIES.md) |
| Accessibility and release evidence | [ACCESSIBILITY.md](docs/ACCESSIBILITY.md), [QUALITY.md](docs/QUALITY.md) |

Shared contracts are in `src/types`; storage adapters in `src/server/repositories`; business logic in `src/server/services`; validated HTTP boundaries in `src/app/api`. Server Components supply public data, while small client components handle forms, cart state and animation. Firebase is authoritative outside explicit demo mode, money uses integer USD cents, and only a verified test-mode Stripe webhook can mark an order paid.
