# Firebase setup and local verification

VELA stores products, categories, user profiles, orders, reservations, and operational records in Firestore. Firebase Authentication provides identity; the server verifies session cookies and custom claims before database mutations. Rules intentionally deny **all browser writes**, including administrator writes. The Admin SDK bypasses rules, so route authorization and input validation remain required.

## Local emulators

Use Node 24.x and Java 21. The repository's default Firebase project is the isolated `demo-vela` project. All emulator listeners bind to `127.0.0.1`: Authentication 9099, Firestore 8080, UI 4000, and emulator hub 4400. `singleProjectMode: false` permits the separate `demo-vela-rules` test namespace; it does not expose listeners publicly.

Copy [`.env.emulator.example`](../.env.emulator.example) to ignored `.env.local` for a fresh local setup, as described in [README.md](../README.md). The CLI scripts require these values:

```dotenv
FIREBASE_PROJECT_ID=demo-vela
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
```

Start the emulators in one terminal:

```powershell
npm run emulators
```

With matching values in ignored `.env.local`, seed in a second terminal:

```powershell
npm run seed -- --project demo-vela
```

Seeding creates six products, four categories, `settings/home`, and `promotions/home` (12 catalog/content documents) only if each document does not exist. Each check/create is transactional. Re-running the script preserves edited product descriptions, prices, inventory, categories, and homepage content. Timestamps use server-generated Unix milliseconds, matching the shared domain contract. Seed does not fabricate orders or revenue.

The strict emulator configuration additionally creates these **local-only** users:

| Email                   | Password           | Role                       |
| ----------------------- | ------------------ | -------------------------- |
| `customer@example.test` | `Vela-local-2026!` | Customer                   |
| `admin@example.test`    | `Vela-local-2026!` | Administrator custom claim |

Their fixed UIDs are `vela-customer` and `vela-admin`. Fixture emails are marked verified by the local Auth emulator. Existing account passwords, claims, and profiles are preserved. If an existing local administrator lacks the claim, use the explicit grant command below. The script refuses partial emulator settings, non-loopback emulator hosts, a project other than `demo-vela`, and any emulator configuration under Vercel. Fixture users are never created in a real Firebase project.

Run security rules tests while Firestore is listening:

```powershell
npx vitest run --config vitest.emulator.config.ts
```

The rules suite clears only `demo-vela-rules`, not the application's emulator database. Tests exercise public catalog restrictions, customer data isolation, required ownership queries, administrator reads, blocked self-assignment, and denied direct writes/private collection access. Emulator success does not verify deployed production rules, indexes, OAuth redirects, or live credentials.

## Real Firebase project

1. Create a Firebase project and a web application. Enable Cloud Firestore in the intended region.
2. Enable Email/Password and Google sign-in in Authentication. Configure the Google provider support email and authorized domains for your local host and Vercel domain. Configure verification/password-reset email templates and their allowed continuation URLs.
3. Put the web application's Firebase configuration in the documented `NEXT_PUBLIC_FIREBASE_*` variables. Put the Admin service account project ID, client email, and private key in server-only variables. Do not expose a service account JSON file or private key through a public variable.
4. Set `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false` and remove all emulator host variables for external service testing and Vercel. Set `FIREBASE_PROJECT_ID` and the public project ID to the intended real project. Keep `.env.local` ignored and copy the same server variables into Vercel's environment settings. [DEPLOYMENT.md](DEPLOYMENT.md) covers the complete environment and hosted acceptance steps.
5. Authenticate the Firebase CLI as an operator with permission to deploy rules. Explicitly name the target project:

```powershell
npx firebase deploy --only "firestore:rules,firestore:indexes" --project YOUR_PROJECT_ID
npm run seed -- --project YOUR_PROJECT_ID
```

Allow indexes to finish building before testing queries. The emulator does not enforce all production composite index requirements. The seed command requires its `--project` value to match `FIREBASE_PROJECT_ID` and uses the configured service account. Real-project seeding creates missing catalog/content documents only and no users. Supplied local image paths work immediately; the Cloudinary import utility subsequently migrates product galleries.

## Initial administrator

Register the intended account through Firebase, complete email verification, and inspect its UID/email in the Firebase console. This CLI is the only bootstrap path; there is no public admin registration endpoint:

```powershell
npm run admin:grant -- --project YOUR_PROJECT_ID --uid FIREBASE_USER_UID
# Or identify the existing account by email:
npm run admin:grant -- --project YOUR_PROJECT_ID --email administrator@example.com
```

Exactly one identifier is required. The CLI checks the explicit/configured project match, rejects disabled or unverified accounts, preserves other custom claims, assigns `admin: true`, revokes existing refresh/session tokens, and records an audit event. Sign in again after assignment. If the final audit write fails after the claim succeeds, inspect the account and rerun the command to record the action; the grant is idempotent.

## Access and queries

- Visitors can read only published products, categories, and the `settings/home` document. Product list queries must constrain `status == "published"`.
- Customers can read their own profile document and orders. Order list queries must constrain `userId == uid`; rules never filter unauthorized results out of an unconstrained query.
- Administrators can read products, customers, orders, settings, and audit logs. Mutations still go through authenticated, validated server endpoints.
- Reservations, webhook receipts, media management records, rate limits, promotions, and all unspecified collections are server-only.

The committed indexes cover published product ordering, customer orders, payment-status order filtering, reservation expiry recovery, and per-entity audit history. Firestore timestamps remain integer milliseconds throughout these domain documents; do not mix Firestore Timestamp objects into the same fields without a coordinated migration.

## External acceptance checks

Verify registration, email delivery, password reset, Google sign-in, session expiry/revocation, customer order isolation, and administrator access against the configured project. Recheck deployed rules using a non-admin browser SDK and verify every indexed query succeeds. Confirm no emulator environment variable is present in the external runtime. These checks remain pending until actually performed with configured services.
