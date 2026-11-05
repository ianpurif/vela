# Environment and deployment runbook

The production target is `https://velaglow.vercel.app`, using Firebase project `vela-essentials`. All ten composite indexes are READY, persisted homepage configuration validates, and live homepage/catalog/recovery checks pass. Firebase Authentication now authorizes the production hostname while preserving its original domains; Email/Password and Google providers are enabled. The scoped CommonJS dependency fix remains in place. Keep Stripe in sandbox/test mode throughout.

## 1. Choose an environment

For credential-free development, follow [README.md](../README.md) with `.env.emulator.example`. For external integration testing, start from [`.env.example`](../.env.example) in the repository root:

```powershell
# Fresh configuration only. Preserve any existing local configuration first.
Copy-Item .env.example .env
```

Replace every placeholder only for a new installation; preserve the current configured values. Keep `.env` and `.env.local` ignored. Production CLI examples use `.env`, while Next.js gives `.env.local` higher precedence locally. To run the local app against external services, ensure its local override also selects that intended environment. Vercel uses its configured environment settings. Do not add service-account JSON or provider secrets to Git, `public/`, browser code, or `NEXT_PUBLIC_*` variables. The Firebase web configuration and Cloudinary cloud name are intentionally browser-visible. Cloudinary's API key is configured server-side but returned as a public identifier in signed upload fields. Admin credentials, the Cloudinary API secret, Stripe secrets and the cron secret remain server-only.

Use `VELA_DATA_MODE=firebase`, `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false`, and remove `FIREBASE_AUTH_EMULATOR_HOST`, `FIRESTORE_EMULATOR_HOST`, and `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL` entirely. Ensure old shell variables do not override the file. Set `NEXT_PUBLIC_APP_URL` to the exact origin used in the browser: `http://127.0.0.1:3000` for local testing or the real HTTPS domain externally, with no path/query/fragment. An incorrect origin blocks protected mutations and creates incorrect return URLs.

Restart the server after changing configuration. Rebuild for changes to `NEXT_PUBLIC_*`, because Next.js includes their values in browser bundles at build time. `VERCEL` is platform-provided and must not be added manually. No Stripe publishable key, unsigned Cloudinary preset, or Firebase Storage credential is required by this application.

## 2. Firebase and Google sign-in

1. Create/select the intended Firebase project, register a web application, and create the default Cloud Firestore database in the intended region. Copy all six web config fields into `NEXT_PUBLIC_FIREBASE_*` exactly as shown by Firebase; do not guess the storage bucket suffix.
2. Enable **Email/Password** and **Google** under Authentication's sign-in providers. Configure the Google support email and authorized domains for the application's local hostname and actual deployed domain. Keep the Firebase-provided `authDomain` unless you have configured a custom authentication domain and its OAuth handler. See [Firebase's Google sign-in setup](https://firebase.google.com/docs/auth/web/google-signin).
3. Configure verification and password-reset email templates. VELA uses Firebase's email action handler with continuation URLs ending in `/account` and `/sign-in` on the current application origin; authorize those domains. Verify delivered emails rather than assuming emulator actions prove delivery.
4. Obtain a service account for the same project with permission to use Firebase Auth Admin and Firestore. Set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`. The project ID must match the web configuration. In `.env`, quote the PEM; actual newlines or escaped `\n` are supported. In Vercel, paste the value without surrounding dotenv quotes.

For a new project, authenticate the Firebase CLI as an operator and deploy rules/indexes. Wait for index builds to finish before verifying runtime readiness:

```powershell
npx firebase login
npx firebase deploy --only "firestore:rules,firestore:indexes" --project YOUR_PROJECT_ID
npx tsx --env-file=.env scripts/seed.ts --project YOUR_PROJECT_ID
```

Always supply `--project`; `.firebaserc` currently selects `vela-essentials`, while the emulator command explicitly selects isolated `demo-vela`. The full seed is for initial catalog setup and creates missing products/categories as well as editorial configuration. For an existing catalog, use `npm run content:init -- --project YOUR_PROJECT_ID`: it initializes only absent homepage fields/documents, preserves edits, and creates no products, orders or users. Invalid existing values are rejected before either content document is written. See [FIREBASE.md](FIREBASE.md) and [the index/query review](INDEXES.md).

Run `npm run verify:production -- --project YOUR_PROJECT_ID` before release. It performs read-only queries against every declared composite index, validates homepage/catalog records, and checks the Firebase web project's authentication domain. `npm run build` automatically performs these checks on Vercel using Next.js environment precedence. It fails on missing/building indexes or invalid configuration rather than deploying a server that can only fail at runtime. Local builds remain available without hosted credentials; the explicit verification command loads `.env` and requires a matching target project.

Register the intended administrator, verify their email, and inspect their Firebase UID. Grant the server-checked custom claim:

```powershell
npx tsx --env-file=.env scripts/grant-admin.ts --project YOUR_PROJECT_ID --uid FIREBASE_USER_UID
```

Alternatively pass `--email` instead of `--uid`. The command rejects disabled/unverified users, preserves other claims, revokes existing sessions and writes an audit record. Sign in again and open `/admin`. There is no public role-assignment flow.

For profiles created before indexed customer search was introduced, inspect the backfill before applying it:

```powershell
npx tsx --env-file=.env scripts/backfill-customer-search.ts --project YOUR_PROJECT_ID
# After reviewing the dry-run count:
npx tsx --env-file=.env scripts/backfill-customer-search.ts --project YOUR_PROJECT_ID --apply
```

## 3. Cloudinary media

Select a Cloudinary product environment. Set `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` from that same environment. The server uses the secret to sign uploads and returns the public API key with those signed fields for direct browser upload. The secret is never returned. Signed uploads require no unsigned preset.

First inspect the local-gallery import:

```powershell
npx tsx --env-file=.env scripts/import-media.ts --project YOUR_PROJECT_ID
# After reviewing the listed product/gallery sources:
npx tsx --env-file=.env scripts/import-media.ts --project YOUR_PROJECT_ID --apply
```

The first command validates existing local source files without uploading. Apply uploads those assets and transactionally updates current product galleries/reference metadata. Existing cloud images and unrelated product fields are preserved. Originals remain in `images/`. Verify the administrator's upload, multiple-image gallery, reorder, replacement and removal controls, then inspect optimized storefront delivery. Referenced assets must refuse deletion; detached unreferenced assets may be explicitly deleted. See [MEDIA.md](MEDIA.md) for retry and orphan cleanup behavior.

## 4. Stripe test Checkout and webhooks

Use the same Stripe sandbox/test environment for the API key, Checkout sessions and webhook destination. Set `STRIPE_SECRET_KEY` to its **`sk_test_`** secret. Live/restricted keys and live webhook events are rejected. Cards must be enabled for that test environment. Hosted Checkout redirects need no browser publishable key.

Install and authenticate the [Stripe CLI](https://docs.stripe.com/cli) for that test environment. Forward snapshot events locally:

```powershell
stripe login
stripe listen --events "checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired" --forward-to http://127.0.0.1:3000/api/stripe/webhook
```

Set `STRIPE_WEBHOOK_SECRET` to the listener's `whsec_` value and restart VELA. The listener uses the account's default event API version unless configured otherwise; align the test environment with the installed SDK's **`2026-10-28.endive`** version. Use snapshot payloads. For hosted verification, create an HTTPS destination at `https://YOUR_DOMAIN/api/stripe/webhook`, select that API version and the same four events, and set the hosted destination's own signing secret in Vercel. A CLI signing secret and a hosted endpoint signing secret are not interchangeable. [Stripe CLI listener reference](https://docs.stripe.com/cli/listen).

Sign in as a verified customer, add a product, and start Checkout from VELA. Use [Stripe's test payment details](https://docs.stripe.com/testing) to exercise success and decline. Confirm the saved order, webhook receipt, inventory and customer history agree. A successful redirect alone must leave payment pending until the signed event is processed.

Replay the same VELA Checkout event and verify stock changes only once. Exercise explicit cancellation, session expiration and reservation recovery. Generic `stripe trigger` fixtures do not contain VELA's stored order identity and cannot prove order fulfillment; replay events from a real VELA-created test session. Never edit Firestore to mark an order paid. See [PAYMENTS.md](PAYMENTS.md) for amounts, idempotency, retries and ambiguous provider outcomes.

## 5. Vercel and reservation recovery

Publish the reviewed repository to the intended Git remote, then import it into Vercel as **Next.js**, with the repository root as the project root. Use Node 24, `npm ci` for installation and `npm run build` for the build. Let Vercel use Next.js server deployment output; this application requires server routes and is not a static export. No remote or Vercel project has been created by this implementation. [Vercel's supported Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

Add the real values from `.env.example` to the intended Vercel environment, keeping the emulator flag false and all emulator hosts absent. `NEXT_PUBLIC_APP_URL` must be the actual stable HTTPS origin where that environment will be used. Configure preview environments with their own matching origin and test data/services; an unrelated preview URL will fail the application's same-origin checks. Add the deployed hostname to Firebase's authorized domains. Redeploy after environment changes.

Production reservation recovery uses the existing **cron-job.org** job every **five minutes**:

- Method: `GET`
- URL: `https://velaglow.vercel.app/api/cron/reservations`
- Header: `Authorization: Bearer <CRON_SECRET>`, using the existing secret configured in Vercel and `.env`.

Preserve that job and secret. The endpoint remains a Node.js route with constant-time bearer verification; missing or incorrect credentials return 401. No Vercel Cron schedule or `vercel.json` cron entry is required. Keep the secret out of URLs, logs and repositories. The live authenticated route returned 200 with zero recovery errors; the scheduler's own account/history has not been inspected. An empty queue returns zero counts without initializing Stripe; a nonempty queue still requires verified provider reconciliation. An unavailable composite index returns 503 with `DATABASE_INDEX_NOT_READY` and `Retry-After: 60`, never a success response or inventory release.

Recovery has a 60-second route duration and processes up to 50 due reservations per call. Monitor the response and function logs for errors/backlog. Administrators can manually invoke recovery in the orders workspace. Provider uncertainty intentionally retains holds; correct configuration or replay a missing signed event instead of manually reducing reserved stock. Confirm the hosted webhook and scheduler are reachable through the deployment's access controls.

## 6. External acceptance checklist

Record actual results for the configured environment before claiming these integrations verified:

| Integration | Required observed behavior | Current status |
| --- | --- | --- |
| Firebase Auth | Register, delivered verification/reset email, Google popup, fresh session, logout/revocation | Production domain and enabled providers verified; full delivered-email/login acceptance pending |
| Firestore | Seed/catalog persistence; deployed rules deny direct writes/cross-customer reads; all indexed queries succeed | Hosted index/catalog/content reads passed; emulator rule/isolation checks previously passed |
| Administrator | Verified bootstrap claim, unauthorized denial, catalog/stock/content changes, correct customer isolation | Local browser-tested; external pending |
| Cloudinary | Signed upload, gallery persistence, replacement/reorder, responsive image delivery, reference-safe deletion/retry | Authenticated provider ping passed; uploads/deletions not performed in this audit |
| Stripe test mode | VELA-created success/decline/cancel/expiry, signed webhook delivery/replay, one stock deduction, owned order history | Test key accepted; enabled snapshot webhook matches SDK API version/four event types; purchases not created in this audit |
| Recovery scheduler | Correct bearer authentication, successful scheduled logs, verified expired holds released, uncertain outcomes retained | cron-job.org preserved; live bearer 401/200 verified, zero recovery errors |
| Vercel | Successful build, exact-origin account/admin/checkout journeys, webhook reachability, cron logs, no browser secrets | Public routes, browser runtime and API authorization boundaries verified; full signed-in hosted acceptance remains separate |
| Devices/accessibility | Real desktop/mobile scrolling, keyboard and screen-reader navigation, representative performance | Chromium/axe checked; hardware and field checks pending |

Newsletter signups are stored as pending and contact messages appear in the administrator support inbox. No outbound marketing or support-email delivery service is implemented. The policies and catalog describe a fictional test store. [QUALITY.md](QUALITY.md) contains the executed local checks and known measurement limits.
