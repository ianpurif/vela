# Dependency verification

Verified on 2026-11-06. The project declares Node `>=22.16.0`; this verification ran with Node `24.22.2` and npm `11.19.1`. All packages added or selected below also accept Node 22.16 according to their published engines. No system runtime was changed as part of this work.

## Audit result

Both `npm audit --json` and `npm audit --omit=dev --json` completed successfully with **0 vulnerabilities** in every severity category. The previous full audit had 18 moderate findings, all through development tooling; the production audit was already clean. Audit results are a point-in-time report from npm's advisory database, not a guarantee against unknown defects.

The direct Firebase, Next.js, ESLint, and TypeScript packages retain their existing pinned versions. In particular, the application remains on Firebase client `12.19.0`, Firebase Admin `14.5.0`, Firebase CLI `15.35.0`, Next.js/config `16.4.5`, ESLint `9.39.5`, and TypeScript `5.9.3`. The audit's suggested downgrades to Firebase CLI 13 and Next.js config 15 were not applied.

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
