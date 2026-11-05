# VELA conventions

- Next.js App Router, TypeScript, Tailwind v4. Server Components by default; keep client islands small.
- Shared domain contracts live in `src/types`; repositories own storage, services own business rules, route handlers validate/authenticate requests.
- Firebase is authoritative. Fixtures are permitted only in explicit demo/test mode. Never silently fall back from a failed service to demo data.
- Money is integer USD cents. Only a verified test-mode Stripe webhook may mark an order paid. Inventory changes and reservations must be transactional and idempotent.
- Admin access requires server-verified Firebase custom claims. Never accept roles, prices, payment status, or image ownership from the browser.
- Never commit credentials, local env files, emulator state, dependencies, or build output. Preserve supplied original images.
- Follow phases in `VELA_PLAN.md`, validate affected behavior, review staged changes, and make focused Conventional Commits throughout.
- Use supplied imagery, accessible HTML, responsive layouts, reduced-motion fallbacks, and restrained editorial styling. No invented reviews, certifications, or medical claims.
- Parallel agents may work on independent, explicitly assigned file scopes. The primary agent owns commits and phase acceptance.
- Update `VELA_PLAN.md` with evidence and remaining work. External verification is pending until exercised against configured services.
