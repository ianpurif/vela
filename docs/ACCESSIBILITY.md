# Accessibility and responsive review

VELA uses semantic page landmarks, native form controls, labeled dialogs, and keyboard-accessible navigation. This review targets WCAG 2.1 A/AA checks and practical desktop/mobile use. Automated checks cannot establish complete WCAG conformance.

## Verification

The Playwright suite is `tests/e2e/accessibility.spec.ts`. It runs Chromium at 1440 × 1000 and the iPhone 13 viewport (390 × 664 CSS pixels), using `@axe-core/playwright` 4.14.0 with `wcag2a`, `wcag2aa`, `wcag21a`, and `wcag21aa` tags. Reduced motion is enabled for these deterministic scans; cinematic rendering, motion preferences, and WebGL lifecycle are covered separately in `tests/e2e/cinematic.spec.ts`.

The production-build run on 2026-11-06 passed all 10 desktop/mobile journeys: 72 page/state scans reported no automated violations, and every tested document width stayed within its viewport. Fresh desktop/mobile home and sign-in viewport captures and keyboard focus captures were also reviewed. A subsequent manual navigation-hover check identified a 3.96:1 state-specific contrast issue; its focused rebuild verification is recorded below. Per-state JSON reports include the URL, viewport, document width, main landmark count, violations, and incomplete checks. They are saved under the Playwright output directory and attached to the report. Local reports and screenshots are not committed.

Evidence: `.local/accessibility-final/report/index.html`, `.local/accessibility-final/results/`, and `.local/accessibility-final/visual/`. After the final one-class rebuild, the focused desktop keyboard/dialog/focus test and its header-hover axe assertion passed. That report is `.local/accessibility-hover/report/index.html`. No additional application changes were needed.

Coverage includes:

- Home, catalog, product detail, empty/populated cart, and the bag drawer.
- Contact, newsletter, FAQ, sign-in, registration, password reset, and contact validation.
- All five routine questions, keyboard option selection, focus movement between questions, and results.
- Real Firebase emulator customer/admin sign-ins, account fields and address entry, customer orders, admin overview, products, product editor/media, inventory, categories, orders, customers, content, analytics, and support.
- Analytics' equivalent data table; storefront search/navigation and admin navigation dialogs; Escape dismissal, focus trapping, and return to the trigger.
- Skip-link behavior, visible focus on light and dark surfaces, and page-level horizontal overflow. Wider administration tables retain their own labeled horizontal scrolling regions.

Run against an already running local release build and the explicitly configured emulators:

```powershell
$env:VELA_E2E_EMULATOR = '1'
npx playwright test tests/e2e/accessibility.spec.ts
```

Authenticated cases reject hosted/non-loopback targets. They do not submit contact/newsletter requests or persist customer/admin edits. A separate disposable browser context isolates each test's bag and session state.

## Changes from the audit

The initial scan found secondary olive text below the 4.5:1 normal-text threshold, with sampled ratios from 2.36:1 to 4.33:1, and ivory footer headings at 4.31:1. Secondary text now uses sufficient opacity on its actual cream, sand, sage, or olive surface. Chart labels and the featured-product indicator also use darker colors. Photo captions use opaque-enough backplates because image backgrounds cannot be reliably assessed by axe.

Product image links retain their visible badge/hover text in their accessible names. Full add-to-bag buttons use their natural visible text and price, with the product name appended for assistive technology; the administrator account link retains its natural name and email with a descriptive prefix. Compact icon controls keep explicit action labels. Desktop navigation changes color on hover without reducing the entire link's opacity.

The former olive focus outline measured 1:1 against the dark footer. Interactive controls now have a light inner ring and dark outer ring; the search input no longer suppresses its outline. Text-field borders and unselected quiz control outlines have stronger contrast. The dark newsletter variant has a separate field-border token, and native selected checkboxes use olive.

Public catalog, product, cart, and authentication pages have a `main` landmark with the skip-link target. The routine preserves native fieldsets, labels, progress, and focus on each new question or result. Dialogs retain Radix's keyboard containment and restoration behavior.

## Manual review and limits

Review photo captions, visible focus, cropped images, and responsive tables in real viewport captures as well as automated reports. Full-page screenshots taken while scrolled can misrepresent sticky headers and offscreen skip links; scroll to the top and blur focus before final full-page captures.

The tested environment is local Chromium with Firebase emulators and fictional store data. Screen-reader narration with NVDA/VoiceOver, physical touch devices, browser zoom combinations, Windows high-contrast mode, and third-party hosted Stripe/Google/Cloudinary screens still require their own verification. Axe's incomplete checks included SVG chart text, image-backed text, empty-table column associations, and focusable background nodes hidden by Radix dialogs. These were reviewed through explicit chart colors and equivalent data tables, caption backplates, empty-state messaging, and keyboard containment checks; they are not automatically classified as passes by axe.

Reference criteria: [WCAG contrast minimum](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html), [focus visible](https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html), and [two-color focus technique C40](https://www.w3.org/WAI/WCAG21/Techniques/css/C40).
