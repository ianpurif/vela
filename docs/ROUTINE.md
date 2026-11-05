# Routine finder

`/routine` reads the same published catalog repository used by the shop. In Firebase mode this is Firestore; the page does not import demo fixtures. Answers remain in page state and are not stored in a customer profile.

## Matching rules

The five questions cover skin type, cosmetic concerns, sensitivity preference, routine length, and fragrance preference. Matching is deterministic and uses only explicit catalog attributes:

- A candidate must be published, have available stock (`stock - reserved > 0`), list the chosen skin type, and have a valid nonnegative price.
- Fragrance-free preference, or either of the two sensitivity preferences, limits candidates to products explicitly marked fragrance-free. This is a preference filter, not evidence of clinical suitability.
- Each matching concern scores 10 points. Catalog skin-comfort matches add 3 points for “sometimes sensitive” or 6 for “often sensitive.”
- Ties use editorial rank, then product ID. Repository ordering does not change the result.
- Minimal routines choose cleanser → moisturizer. Balanced adds serum/essence between them. Full adds a face oil at the end. One product is selected per category, with no duplicate IDs.
- A missing category is disclosed. The finder never fills the gap with an unavailable, unpublished, or incompatible product. An empty match offers a return to preferences or the full collection.

Reasons are generated from the actual matches. No diagnosis, treatment, ingredient inference, review, or certification is generated.

## Cart interaction

The existing Zustand cart exposes `addRoutine`, backed by a pure batch validator. It adds one of each displayed product in one state update. If any item would exceed available stock, the 10-per-product limit, or the 20-line cart limit, the entire addition is rejected with an explanation. Existing unrelated quantities remain intact. Prices and stock are authoritatively rechecked by checkout; adding to the bag does not reserve inventory.

The UI supports keyboard radio/checkbox controls, question focus after navigation, progress announcements, and reduced-motion transitions. It uses the same product images, product links, cart drawer, and money formatting as the storefront.

## Verification

`tests/routine-matching.test.ts` and `tests/routine-cart.test.ts` cover matching and cart boundaries. The local-emulator personalization browser suite exercises the five-step journey, repeatability, unavailable/archived exclusions, and bag persistence on desktop and mobile. See `VELA_PLAN.md` for executed validation results.
