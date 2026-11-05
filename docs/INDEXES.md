# Firestore query and index map

Reviewed on 2026-11-06 against every Firestore collection query in `src/server/repositories`, `src/server/services`, and `scripts`. All eight composite index shapes used by current application reads are present in `firestore.indexes.json`. Its ten definitions contain no duplicates; no correction was required. `firebase.json` points to this file, and `fieldOverrides` remains empty.

The initial review covered source/configuration only. During the 2026-11-06 production hotfix, `vela-essentials` was inspected and had **zero hosted composite indexes**. Its actual published-catalog (`status`, `rank`) and recovery (`status`, `reconcileAfter`) queries returned `FAILED_PRECONDITION` requiring indexes. The [Firestore emulator does not enforce compound index requirements](https://firebase.google.com/docs/emulator-suite/connect_firestore#indexes), so passing emulator tests does not verify hosted index availability.

Creating the checked-in definitions with the configured application service account returned `PERMISSION_DENIED`; no index was created. The local Firebase CLI has no authorized operator account. An operator with existing index-management permission must run:

```powershell
npx firebase login
npx firebase deploy --only firestore:indexes --project vela-essentials
```

The operator subsequently deployed the definitions. On the latest 2026-11-06 check, all ten indexes reported READY, the real catalog/recovery queries succeeded, and the production homepage and authenticated recovery endpoint returned 200. The earlier permission limitation is resolved operationally without granting broader permissions to the application service account. Existing environment values, security rules and cron-job.org configuration remain unchanged.

`npm run verify:production -- --project vela-essentials` now executes real readiness queries for all declared indexes and validates the stored homepage/catalog and Firebase authentication domain. The same check runs before Vercel builds. An index definition existing in configuration is not enough: its query must succeed after backfill. No scan fallback, alternate data source or fabricated result is used while an index is unavailable. Runtime API index failures return retryable 503 responses.

## Ordering and cursors

`firestoreStore.list()` adds `orderBy(documentId(), direction)` after its requested order field, using the same direction. All indexes automatically end with a document-path ordering in the final field's direction, so the declared indexes cover this explicit tie-break without adding a separate `__name__` field. This follows Firestore's [default index ordering](https://firebase.google.com/docs/firestore/query-data/index-overview#default_ordering_and_the_name_field).

Admin order, customer order, and support pages use `(createdAt, documentId)` cursor values in that order. The cursor does not introduce another filter field or require another composite index. Multiple cursor values disambiguate records with equal timestamps, as described in [Firestore's cursor guide](https://firebase.google.com/docs/firestore/query-data/query-cursors#set_cursor_based_on_multiple_fields).

## Queries using declared composite indexes

`ASC` and `DESC` below are the index field directions, in declaration order. Every current query uses collection scope, not collection-group scope.

| Owning source and operation                                                                               | Filters and ordering                                                          | Declared index                                                     |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `repositories/catalog.ts`: published catalog                                                              | `status == published`; `rank ASC`                                             | `products: status ASC, rank ASC`                                   |
| `services/orders.ts`: customer history, including cursor pages; `services/operations.ts`: customer detail | `userId == uid`; `createdAt DESC`                                             | `orders: userId ASC, createdAt DESC`                               |
| `services/operations.ts`: admin orders filtered by payment                                                | `paymentStatus == value`; `createdAt DESC`                                    | `orders: paymentStatus ASC, createdAt DESC`                        |
| `services/operations.ts`: admin orders filtered by fulfillment                                            | `fulfillmentStatus == value`; `createdAt DESC`                                | `orders: fulfillmentStatus ASC, createdAt DESC`                    |
| `services/operations.ts`: admin orders with both filters                                                  | Both equality filters; `createdAt DESC`                                       | `orders: paymentStatus ASC, fulfillmentStatus ASC, createdAt DESC` |
| `services/operations.ts`: paid revenue analytics                                                          | `paymentStatus == paid`; `paidAt >= start` and `paidAt <= end`; `paidAt DESC` | `orders: paymentStatus ASC, paidAt DESC`                           |
| `services/payments.ts`: reservation reconciliation                                                        | `status == active`; `reconcileAfter <= now`; `reconcileAfter ASC`             | `inventoryReservations: status ASC, reconcileAfter ASC`            |
| `services/admin.ts`: inventory history                                                                    | `action == inventory.adjusted`; `createdAt DESC`                              | `auditLogs: action ASC, createdAt DESC`                            |

Two existing definitions are retained but currently have no corresponding application list call: `inventoryReservations: status ASC, expiresAt ASC` and `auditLogs: entityId ASC, createdAt DESC`. The emulator payment test's `entityId == value` lookup itself needs only an automatic index.

## Queries covered by automatic indexes

The default single-field indexes cover the following shapes. The same-direction document-ID suffix described above still applies. Keep these fields indexed if introducing field exemptions later. See [Firestore's automatic index behavior](https://firebase.google.com/docs/firestore/query-data/index-overview#automatic_indexes).

| Source and operation                                                                     | Collection / query                                                     | Current bound               |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------- |
| `services/admin.ts`, `services/operations.ts`: admin catalog and analytics product input | `products`, `rank ASC`                                                 | 1,000 products              |
| `repositories/catalog.ts`: public collections                                            | `categories`, `rank ASC`                                               | 50 categories               |
| `services/admin.ts`, `services/operations.ts`: admin collection choices                  | `categories`, `rank ASC`                                               | 100 categories              |
| `services/operations.ts`: unfiltered admin order pages                                   | `orders`, `createdAt DESC`                                             | 200/page plus one lookahead |
| `services/operations.ts`: created-order analytics                                        | `orders`, range on `createdAt`, ordered `createdAt DESC`               | 1,000 per window            |
| `services/operations.ts`: recent customer list                                           | `users`, `createdAt DESC`                                              | 100 plus one lookahead      |
| `services/operations.ts`: name prefix search                                             | `users`, lower/upper range on `searchName`, ordered `searchName ASC`   | 101 fetched before merge    |
| `services/operations.ts`: email prefix search                                            | `users`, lower/upper range on `searchEmail`, ordered `searchEmail ASC` | 101 fetched before merge    |
| `services/support.ts`: admin support inbox                                               | `contactMessages`, `createdAt DESC`, optional cursor                   | 100/page plus one lookahead |
| `scripts/backfill-customer-search.ts`                                                    | `users`, document ID `ASC`, snapshot cursor                            | 200/page                    |
| `scripts/import-media.ts`                                                                | `products`, default document ordering, no filters                      | 1,000 products              |

Customer name/email search executes two separate single-field range queries; it does not query both fields together. Categories, product search/filtering, homepage selection, low-stock selection, and bestsellers are processed from the fetched data in application code, so they do not create additional Firestore query shapes.

All remaining Firestore reads are document-ID lookups, including product detail, homepage settings/promotions, profiles, checkout/webhook records, media tickets/assets, newsletter capabilities, contact retry records, and durable rate-limit records. Transactional reads use those same document references. There are no application collection-group queries, Firestore aggregate queries, or client-side Firestore list queries.

## Data and result limits

- Prefix search depends on `searchName` and `searchEmail` being present. New/profile-update writes populate them, and sign-in repairs existing profiles. For imported legacy users, review the dry run from `scripts/backfill-customer-search.ts` with an explicit project, then apply it through the documented migration workflow. An index cannot include a document whose indexed field is absent.
- Older paid orders need an authentic numeric `paidAt` to appear in payment-date revenue windows. Current verified-payment writes set it; do not invent timestamps to populate analytics.
- The public catalog reads at most 200 published products before storefront filters, category selection, cart lookup, or sitemap processing. Admin catalog and media import read at most 1,000. These are application limits, not missing indexes.
- Customer search returns at most 100 merged matches and exposes truncation; it has no continuation cursor. Admin customer detail shows the latest 200 orders with a truncation flag; customer order history and global admin orders have cursor pagination.
- Analytics independently bounds created-order and paid-order windows at 1,000 records each, bounds products at 1,000, and exposes conservative truncation flags when a bound is reached. Reservation reconciliation processes 50 due records per invocation.
- Default indexing also indexes long non-query content. Exempting large descriptions, support message bodies, or audit detail maps could reduce index storage later; it is not required to make the current queries valid, and no exemptions were changed here.

## Hosted verification

For future hosted projects or index changes, deploy the checked-in definitions using an explicit project target, wait for their builds to finish, and run the production verifier. Check that no console-only exemptions disabled the automatic indexes listed above. Follow the [Firebase index management instructions](https://firebase.google.com/docs/firestore/query-data/indexing); actual query success remains the final verification. Current `vela-essentials` readiness is verified above; signed-in customer/admin acceptance remains distinct from index availability.
