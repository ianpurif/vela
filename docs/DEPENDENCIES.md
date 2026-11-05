# Dependency verification

Verified on 2026-11-06 with Node `24.22.2` and npm `11.19.1`. The project now declares Node `24.x`, matching the release-tested major. Vercel gives `package.json` engines precedence over project settings; the former open-ended `>=22.16.0` range could select an untested newer major. [Vercel runtime selection](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions). All packages added or selected below also accept Node 22.16 according to their published engines, but Node 24 is the supported setup/deployment target. No system runtime was changed as part of this work.

## Audit result

Both `npm audit --json` and `npm audit --omit=dev --json` completed successfully with **0 vulnerabilities** in every severity category. The previous full audit had 18 moderate findings, all through development tooling; the production audit was already clean. Audit results are a point-in-time report from npm's advisory database, not a guarantee against unknown defects.

The direct Firebase, Next.js, ESLint, and TypeScript packages retain their existing pinned versions. In particular, the application remains on Firebase client `12.19.0`, Firebase Admin `14.5.0`, Firebase CLI `15.35.0`, Next.js/config `16.4.5`, ESLint `9.39.5`, and TypeScript `5.9.3`. The audit's suggested downgrades to Firebase CLI 13 and Next.js config 15 were not applied.

## Production CommonJS compatibility

The installed `firebase-admin@14.5.0` → `jwks-rsa@4.1.0` → `jose@6.2.15` chain reproduced the deployed `ERR_REQUIRE_ESM` during `require('firebase-admin/auth')` when Node's `require(ESM)` interop was disabled. `jwks-rsa/src/utils.js` synchronously requires jose, while jose 6 provides only ESM. Next.js automatically externalizes Firebase Admin, so a successful build or normal Node 24 startup can conceal this runtime failure. See the [upstream packaging issue](https://github.com/auth0/node-jwks-rsa/issues/507).

The exact override `jwks-rsa@4.1.0` → `jose@5.10.0` supplies jose's [CommonJS export](https://github.com/panva/jose/blob/v5.10.0/package.json). It preserves Firebase Admin and jwks-rsa versions, leaves the Firebase CLI/MCP consumer on jose 6, and requires no application bundling or authentication changes. The lockfile contains the nested production dependency and marks the separate jose 6 installation as development-only. Both npm audits remain clear.

`tests/firebase-runtime.test.ts` starts actual CommonJS child processes with `--no-experimental-require-module`. Both cases failed before the fix and passed afterward: Firebase Auth/Firestore/App Check loading and RSA/EC JWK-to-PEM conversion through Firebase's actual dependency. Generated signatures verify with the converted keys; altered payloads fail verification. The tests make no network requests.

Verification also passed after a fresh `npm ci --omit=dev --ignore-scripts` in an isolated directory. The production build's homepage and reservation-route traces include 83 CommonJS jose files each and no jose webapi files. The built server, started with `require(ESM)` disabled against local Firebase emulators, returned 200 for the homepage/catalog/product, 401 for missing/incorrect cron bearer credentials, and 200 with zero recovery errors for the correct local test credential. No real provider credentials or environment files were changed.

Run the regression with `npx vitest run tests/firebase-runtime.test.ts`. When updating jwks-rsa, verify the upstream loading fix before removing the override; retain the strict CommonJS test even if the default Node runtime loads ESM through `require()` successfully.

## Targeted development overrides

Firebase CLI `15.35.0` and typescript-eslint `8.72.1` were already the latest published versions when checked. Their dependency ranges did not include all security fixes, so the following exact, limited overrides are used. These cross transitive major versions; compatibility was checked against the APIs their actual parents call.

| Scope                                                       | Resolved version | Reason and compatibility evidence                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@google-cloud/pubsub@5.3.1` → `@opentelemetry/core`        | `2.8.0`          | Fixes [GHSA-8988-4f7v-96qf](https://github.com/advisories/GHSA-8988-4f7v-96qf). Pub/Sub imports only `W3CTraceContextPropagator` from core. Its constructor and inject/extract APIs remain available; core's API peer range still accepts the installed `@opentelemetry/api@1.9.0`. A real context propagation round trip passed.                                                       |
| `gaxios@6.7.1` → `uuid`                                     | `11.1.1`         | Includes the [buffer-bounds fix](https://github.com/uuidjs/uuid/releases/tag/v11.1.1). This gaxios calls only `v4()` without arguments for multipart boundaries. UUID 11 retains that API and CommonJS exports. UUID 12+ was deliberately not selected.                                                                                                                                 |
| `glob@10.5.0`                                               | `14.0.3`         | Fixes [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) and resolves a patched minimatch. Firebase CLI, exegesis, and archiver-utils use the retained `sync()` and promise-based `glob()` APIs. Matching results were compared before installation, then actual parent file discovery, controller discovery, and ZIP creation were exercised after installation. |
| `@typescript-eslint/typescript-estree@8.72.1` → `minimatch` | `11.0.4`         | Fixes [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). The parent uses the named `minimatch(path, pattern, { dot: true })` API, which is retained. The matching check and whole-project ESLint run passed.                                                                                                                                                     |

Older minimatch 3, 5, and 6 consumers are unchanged. A global minimatch override would break callers that expect the older callable CommonJS export and is unnecessary for this advisory's affected range.

The previous production overrides remain in place: `gaxios@7.1.3` → `7.3.1`, `google-gax@5.0.8` → `rimraf@6.1.4`, and Firebase Firestore → `@grpc/grpc-js@1.13.7`. The lockfile review confirmed that no unrelated direct dependency was upgraded during this remediation.

## Build environment loading

The production readiness command also declares `@next/env@16.4.5` directly as a development dependency, matching Next.js exactly. That version was already installed transitively; no additional resolved package or runtime upgrade was introduced. It loads the same environment precedence during Vercel's prebuild check. Both dependency audits remain clear after this change.

## Accessibility tooling

`@axe-core/playwright` is pinned as a development dependency at `4.14.0`. Its published Node requirement is `>=22.12.0`, its Playwright peer requirement is `playwright-core >=1.0.0`, and its axe engine dependency is `~4.14.0`; the project's declared Node baseline and Playwright `1.64.1` satisfy these ranges.

The package import was exercised after installation. Browser scans use the documented [Playwright accessibility testing integration](https://playwright.dev/docs/accessibility-testing) and [AxeBuilder API](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright). Automated scans supplement keyboard, responsive-layout, and manual review; they do not establish complete accessibility conformance.

## Validation performed

Installation used `npm install --ignore-scripts`; it did not run dependency lifecycle scripts or stop the running development server/emulators.

- `npm ls @axe-core/playwright @opentelemetry/core glob minimatch uuid --all`: passed with the expected override tree and no invalid dependencies.
- `npm run lint`: passed across the whole project.
- `npx firebase --version`: successfully loaded Firebase CLI `15.35.0`.
- `npm audit --json`: zero findings.
- `npm audit --omit=dev --json`: zero findings.
- In-memory smoke checks: Firebase CLI `listFiles`, glob synchronous/asynchronous matching, archiver-utils expansion, exegesis controller discovery with a safe custom loader, and a ZIP containing the three cinematic helper files all passed.
- Runtime API smoke checks: UUID v4 generation, Pub/Sub OpenTelemetry trace injection/extraction, typescript-estree's minimatch call, and the AxeBuilder import all passed. These checks made no external service requests and wrote no fixture archive to disk.

The runtime checks above used Node 24.22.2. Node 22.16 compatibility was verified from published engine requirements and API usage, not a second execution under Node 22.16.

## Maintaining the overrides

On future dependency updates, check whether the upstream parent now accepts the patched dependency, remove the corresponding override when possible, and rerun the relevant CLI/archive/lint checks plus both audits. Review lockfile changes rather than using `npm audit fix --force`. The intentionally exact parent/version scopes make upstream changes visible instead of silently imposing these overrides on unrelated future versions.

Before production build or browser acceptance after dependency installation, restart the development process so it cannot retain modules loaded before the lockfile changed. Emulator restart is managed by the primary workflow; this remediation did not interrupt existing emulator sessions.
