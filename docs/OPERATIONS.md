# Admin operations

All admin order, customer, analytics, and content readers call `requireAdmin` independently; a surrounding layout is not treated as authorization. Responses carry `Cache-Control: no-store`. Mutation routes additionally require the configured same origin and a durable per-admin rate limit. Their strict schemas reject payment, inventory, role, and unknown field injection. Firestore client writes remain denied; the server verifies sessions and custom claims before using Admin SDK access.

## Orders and fulfillment

`GET /api/admin/orders` accepts optional `paymentStatus`, `fulfillmentStatus`, and `after` (the previous page's final order ID). It returns `{ orders, limit: 200, truncated, next }`. The query fetches 201 records, ordered by descending `createdAt` and document ID. `next` is the cursor for older matching orders, or null. Preserve filters while paging and reset the cursor when filters change. `GET /api/admin/orders/:id` returns an order or 404. The corresponding server readers are `listAdminOrders` and `getAdminOrder`.

`PATCH /api/admin/orders` takes `{ id, fulfillmentStatus, trackingNumber }` and returns `{ order }`. Only paid orders can advance. Valid adjacent transitions are `unfulfilled → processing → shipped → delivered`; reversals and skipped steps fail. Shipping and delivery require a nonempty tracking number of at most 100 characters. A same-state request can correct tracking. An identical retry is a no-op. Order payment data, lines, totals, and inventory are preserved; effective changes and their audit event commit together. There is no admin operation to mark an order paid.

## Customers and indexed search

`GET /api/admin/customers?q=prefix` and `listAdminCustomers(prefix)` return `{ customers, limit: 100, truncated }`. An empty query lists the most recently created accounts. A nonempty query searches the whole collection by indexed `searchName` and `searchEmail`, each normalized using Unicode NFKC, trimming, and lowercase. Matching is a name/email **prefix**, not a substring, token, or accent-insensitive search. Each ordered range query reads at most 101 rows; the merged result removes duplicates and discloses when the 100-result limit is reached. Unicode prefix successors bound the query without assuming names contain only ASCII.

`GET /api/admin/customers/:id` and `getAdminCustomer(id)` return `{ profile, orders, ordersLimit: 200, ordersTruncated }` or 404/null respectively. The orders query is scoped to the selected customer's UID and shows their latest 200 records. Customer-facing history has its separate authorized paging implementation.

Profile creation and updates maintain the two search fields. Reading a legacy profile also repairs only those fields without changing its public edit timestamp. Existing users who have not returned require a migration before comprehensive search is available. Do not substitute a scan of recently created accounts for this migration.

Run the explicit-project migration from an environment containing the same Firebase configuration used by the application:

```powershell
npx tsx --env-file=.env.local scripts/backfill-customer-search.ts --project demo-vela
npx tsx --env-file=.env.local scripts/backfill-customer-search.ts --project demo-vela --apply
```

The first command is a dry run. The shared script bootstrap requires `--project` to equal `FIREBASE_PROJECT_ID`; a demo project additionally requires both exact loopback emulator hosts and a non-Vercel environment. A real project requires its explicit service-account configuration. The migration pages by document ID, reports counts without customer details, and updates only search fields in transactions using the latest name/email. Invalid legacy profiles are reported as skipped and produce a nonzero exit status.

## Homepage settings and promotion

`GET /api/admin/content` returns `{ content, categories }`. `PATCH` takes all editable `SiteContent` fields, omitting `id` and `updatedAt`, and returns `{ content }`. The browser-safe schemas are in `src/lib/validation/operations.ts`. Fields are plain text, and the public components escape them. An empty announcement hides its text. Empty `featuredCategory` selects the featured-product selection; a category ID must exist and selects published products from that collection.

A content save atomically replaces `settings/home` with homepage settings, `promotions/home` with `{ id: "home", title, text, updatedAt }`, and writes an audit entry. Promotion copy is not duplicated in new settings writes. The promotion document remains private to server access; the public server-rendered homepage receives the merged `SiteContent` projection. This is editorial homepage promotion copy, not a coupon or price override.

`readHomeContent(store)` is the shared projection for catalog and admin readers. It prefers `promotions/home` and temporarily supports old promotion fields in `settings/home`. Missing Firebase content returns 503 rather than showing demo copy. The seed creates only missing documents and initializes a missing promotion from existing legacy copy, preserving custom text. Explicit demo mode continues to use its declared fixtures.

## Analytics scope

`GET /api/admin/analytics?days=30` and `getAdminAnalytics(days)` return the typed `AdminAnalytics` contract. Valid windows are 1–90 UTC calendar dates, including today through the current timestamp. There are separate queries for orders **created** during the window and paid orders whose **paidAt** falls in it. Consequently, an older order paid today contributes today's revenue even though it is absent from today's created-order count. Changes to tracking or content do not move payment revenue between dates.

Metrics include integer USD revenue, paid count, created count, pending count among newly created orders, average order value, and scanned product count. Revenue and average order value include shipping; bestsellers aggregate the order's saved line quantities and unit prices, excluding shipping. Zero-sales windows return zeroes and empty ranked lists. Trends include every UTC date. Recent orders show up to 10 newly created orders; low stock shows up to 10 published products with `stock - reserved <= 5`.

Each created-order query, paid-order query, and product scan reads at most 1,000 records. `scope` exposes record counts, limits, and individual truncation flags. A result exactly at the cap is conservatively flagged; these totals are scoped observations rather than claimed all-time totals. Product count and low-stock coverage are similarly scoped when the product cap is reached. Paid analytics require the verified payment timestamp; never invent a legacy `paidAt` from `updatedAt`, which can change during fulfillment.

Deploy the composite indexes in `firestore.indexes.json` with the application: payment/fulfillment filters with descending order creation, and payment status with descending `paidAt`. Customer search uses automatic single-field indexes. The emulator does not prove that deployed composite indexes are ready.

## Local verification

`tests/operations.test.ts` covers role checks, stable order pagination, indexed customer search, customer isolation, profile search-field maintenance, fulfillment transitions and immutable payment data, atomic settings/promotion changes, late-payment analytics, explicit bounds, and API origin/rate-limit guards. These tests use an in-memory transactional store, not external services. Emulator/browser verification and production index deployment are tracked separately by the main project validation.
