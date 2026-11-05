# Environment and deployment runbook

Local implementation and emulator verification are complete. The production target is `https://velaglow.vercel.app`, using Firebase project `vela-essentials`. The 2026-11-06 runtime hotfix is deployed, and missing catalog/content records have been seeded. Hosted composite indexes still need deployment by an authorized operator; see [INDEXES.md](INDEXES.md). Other provider acceptance checks below remain pending unless explicitly recorded. Keep Stripe in sandbox/test mode throughout.

## 1. Choose an environment

For credential-free development, follow [README.md](../README.md) with `.env.emulator.example`. For external integration testing, start from [`.env.example`](../.env.example) in the repository root:

```powershell
# Fresh configuration only. Preserve any existing local configuration first.
Copy-Item .env.example .env.local
```

Replace every placeholder. Keep `.env.local` ignored. Do not add service-account JSON or provider secrets to Git, `public/`, browser code, or `NEXT_PUBLIC_*` variables. The Firebase web configuration and Cloudinary cloud name are intentionally browser-visible. Cloudinary's API key is configured server-side but returned as a public identifier in signed upload fields. Admin credentials, the Cloudinary API secret, Stripe secrets and the cron secret remain server-only.

Use `VELA_DATA_MODE=firebase`, `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false`, and remove `FIREBASE_AUTH_EMULATOR_HOST`, `FIRESTORE_EMULATOR_HOST`, and `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL` entirely. Ensure old shell variables do not override the file. Set `NEXT_PUBLIC_APP_URL` to the exact origin used in the browser: `http://127.0.0.1:3000` for local testing or the real HTTPS domain externally, with no path/query/fragment. An incorrect origin blocks protected mutations and creates incorrect return URLs.

Restart the server after changing configuration. Rebuild for changes to `NEXT_PUBLIC_*`, because Next.js includes their values in browser bundles at build time. `VERCEL` is platform-provided and must not be added manually. No Stripe publishable key, unsigned Cloudinary preset, or Firebase Storage credential is required by this application.

## 2. Firebase and Google sign-in

1. Create/select the intended Firebase project, register a web application, and create the default Cloud Firestore database in the intended region. Copy all six web config fields into `NEXT_PUBLIC_FIREBASE_*` exactly as shown by Firebase; do not guess the storage bucket suffix.
2. Enable **Email/Password** and **Google** under Authentication's sign-in providers. Configure the Google support email and authorized domains for the application's local hostname and actual deployed domain. Keep the Firebase-provided `authDomain` unless you have configured a custom authentication domain and its OAuth handler. See [Firebase's Google sign-in setup](https://firebase.google.com/docs/auth/web/google-signin).
3. Configure verification and password-reset email templates. VELA uses Firebase's email action handler with continuation URLs ending in `/account` and `/sign-in` on the current application origin; authorize those domains. Verify delivered emails rather than assuming emulator actions prove delivery.
4. Obtain a service account for the same project with permission to use Firebase Auth Admin and Firestore. Set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`. The project ID must match the web configuration. In `.env.local`, quote the PEM; actual newlines or escaped `\n` are supported. In Vercel, paste the value without surrounding dotenv quotes.

Authenticate the Firebase CLI as a project operator, then deploy rules/indexes and seed missing catalog/content:

```powershell
npx firebase login
npx firebase deploy --only "firestore:rules,firestore:indexes" --project YOUR_PROJECT_ID
npm run seed -- --project YOUR_PROJECT_ID
```

Always supply `--project`; the repository's default is intentionally `demo-vela`. Wait until indexes report ready. The seed preserves existing data and creates six products, four categories, `settings/home`, and `promotions/home`. It creates no real-project users or test orders. See [FIREBASE.md](FIREBASE.md) and [the index/query review](INDEXES.md).

Register the intended administrator, verify their email, and inspect their Firebase UID. Grant the server-checked custom claim:

```powershell
npm run admin:grant -- --project YOUR_PROJECT_ID --uid FIREBASE_USER_UID
```

Alternatively pass `--email` instead of `--uid`. The command rejects disabled/unverified users, preserves other claims, revokes existing sessions and writes an audit record. Sign in again and open `/admin`. There is no public role-assignment flow.

For profiles created before indexed customer search was introduced, inspect the backfill before applying it:

```powershell
npx tsx --env-file=.env.local scripts/backfill-customer-search.ts --project YOUR_PROJECT_ID
# After reviewing the dry-run count:
npx tsx --env-file=.env.local scripts/backfill-customer-search.ts --project YOUR_PROJECT_ID --apply
```

## 3. Cloudinary media

Select a Cloudinary product environment. Set `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` from that same environment. The server uses the secret to sign uploads and returns the public API key with those signed fields for direct browser upload. The secret is never returned. Signed uploads require no unsigned preset.

First inspect the local-gallery import:

```powershell
npx tsx --env-file=.env.local scripts/import-media.ts --project YOUR_PROJECT_ID
# After reviewing the listed product/gallery sources:
npx tsx --env-file=.env.local scripts/import-media.ts --project YOUR_PROJECT_ID --apply
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

Preserve that job and secret. The endpoint remains a Node.js route with constant-time bearer verification; missing or incorrect credentials return 401. No Vercel Cron schedule or `vercel.json` cron entry is required. Keep the secret out of URLs, logs and repositories. After index deployment, confirm an authenticated 200 response and check the cron-job.org execution history. The HTTP handler was exercised directly; the scheduler's own account/history has not been inspected.

Recovery has a 60-second route duration and processes up to 50 due reservations per call. Monitor the response and function logs for errors/backlog. Administrators can manually invoke recovery in the orders workspace. Provider uncertainty intentionally retains holds; correct configuration or replay a missing signed event instead of manually reducing reserved stock. Confirm the hosted webhook and scheduler are reachable through the deployment's access controls.

## 6. External acceptance checklist

Record actual results for the configured environment before claiming these integrations verified:

| Integration | Required observed behavior | Current status |
| --- | --- | --- |
| Firebase Auth | Register, delivered verification/reset email, Google popup, fresh session, logout/revocation | Emulator-tested; external pending |
| Firestore | Seed/catalog persistence; deployed rules deny direct writes/cross-customer reads; all indexed queries succeed | Emulator-tested; deployed rules/indexes pending |
| Administrator | Verified bootstrap claim, unauthorized denial, catalog/stock/content changes, correct customer isolation | Local browser-tested; external pending |
| Cloudinary | Signed upload, gallery persistence, replacement/reorder, responsive image delivery, reference-safe deletion/retry | Fixture-tested; provider pending |
| Stripe test mode | VELA-created success/decline/cancel/expiry, signed webhook delivery/replay, one stock deduction, owned order history | SDK signature/service tests passed; provider pending |
| Recovery scheduler | Correct bearer authentication, successful scheduled logs, verified expired holds released, uncertain outcomes retained | cron-job.org preserved; live invalid bearer 401 verified; authenticated recovery awaiting indexes |
| Vercel | Successful build, exact-origin account/admin/checkout journeys, webhook reachability, cron logs, no browser secrets | Hotfix deployed at velaglow.vercel.app; full hosted acceptance pending |
| Devices/accessibility | Real desktop/mobile scrolling, keyboard and screen-reader navigation, representative performance | Chromium/axe checked; hardware and field checks pending |

Newsletter signups are stored as pending and contact messages appear in the administrator support inbox. No outbound marketing or support-email delivery service is implemented. The policies and catalog describe a fictional test store. [QUALITY.md](QUALITY.md) contains the executed local checks and known measurement limits.
