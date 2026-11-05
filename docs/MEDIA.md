# Product media

Cloudinary is the product media provider. The storefront initially uses optimized supplied local assets; the import utility migrates those galleries after a real Cloudinary account is configured. No upload or deletion is presented as externally verified until exercised with that account.

## Configuration

Set `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in ignored `.env.local` and in the intended Vercel environment. Only the cloud name is public. The server passes credentials directly to the Cloudinary v2 SDK and never returns its API secret. The integration uses the default `res.cloudinary.com` delivery host and an image upload endpoint. An unsigned upload preset is unnecessary.

Missing configuration returns HTTP 503. Existing local image galleries continue to render and administrators can still reorder or detach them. Authentication, same-origin checks, and a durable per-admin rate limit protect every media mutation endpoint. Firestore client access to `media` and `mediaUploads` remains denied by default.

## Administrator workflow

1. Save a product before uploading images.
2. Request `POST /api/admin/media/sign` with `{ "productId": "first-light-serum" }`.
3. Send the selected file and returned `fields` to returned `uploadUrl` using `FormData`. Convert each field value with `String(value)`; do not add arbitrary upload parameters.
4. Request `POST /api/admin/media/complete` with `{ "ticketId": "...", "alt": "Descriptive image text" }`. For replacement, include the exact existing `replaceSrc`.

Signing returns `{ ticketId, uploadUrl, fields: { api_key, timestamp, public_id, signature, overwrite, allowed_formats } }`. Public IDs are generated on the server under `vela/products/`; `overwrite` is signed as `"false"`, with allowed formats `jpg,png,webp,avif`. Cloudinary validates the signed parameters. Each local upload ticket binds the administrator, product, cloud, and public ID and expires after 15 minutes for its first completion. Cloudinary's underlying signature window is longer; an expired local ticket cannot attach an image.

Completion fetches metadata from Cloudinary's server API. The browser cannot supply an image URL, dimensions, public ID, or asset ID. Accepted resources must match the ticket and configured cloud, use canonical HTTPS delivery URLs, have resource/type `image/upload`, be JPG/PNG/WebP/AVIF, be at most 8 MiB, and have dimensions from 1 to 8,000 pixels per side. Alternative CDN hostnames and arbitrary transformed source URLs are rejected. Galleries allow at most 12 images and alt text of 1–180 characters.

Metadata, gallery changes, reference lists, ticket consumption, and audit records commit together. A retry with the same ticket owner and identical alt/replacement details returns the current product without another mutation. Changed completion details return 409. An exact retry after a later detach or deletion **does not reattach** the image. Concurrent completion requests cannot duplicate gallery entries or audit records. The provider fetch happens outside the transaction; state and references are checked again inside it.

## Reordering, replacement, and deletion

`PATCH /api/admin/media/gallery` accepts either:

```json
{ "productId": "first-light-serum", "action": "remove", "src": "EXACT_EXISTING_SOURCE" }
```

```json
{
  "productId": "first-light-serum",
  "action": "reorder",
  "sources": ["EXISTING_SOURCE_2", "EXISTING_SOURCE_1"]
}
```

Reordering requires the exact current gallery as a permutation: no arbitrary sources, duplicates, or omissions. Detachment and replacement update references but do not automatically delete the underlying Cloudinary asset. Local images can be detached/reordered; the original supplied files remain on disk.

`DELETE /api/admin/media` takes `{ "publicId": "vela/products/..." }` and returns `{ "ok": true }`. It accepts only a tracked asset in the configured cloud whose reference list is empty. The service first transactionally locks the asset with `state: "deleting"`, then calls Cloudinary `destroy` with CDN invalidation. Attachment refuses locked assets. A successful deletion retains a `deletedAt` tombstone: otherwise a completion that fetched metadata immediately before deletion could attach an already-deleted resource. Exact repeated deletion requests succeed without a second provider deletion or audit event.

If the provider fails or times out, the record remains locked and deletion can be retried. Keeping the lock handles ambiguous outcomes where Cloudinary may have deleted the resource before the response was lost. Do not manually change a deleting record back to ready. Do not remove tombstones unless all outstanding tickets for that asset have been retired and there is no possible in-flight attachment.

The `media` document ID is SHA-256 of the public ID. Each record stores Cloudinary identity, canonical source, dimensions, byte count, reference product IDs, state, and creation time. Imports must maintain this same schema and reference contract, including shared images used by more than one product.

## Local asset import and cleanup

Run the repository's import utility in its dry-run mode before enabling uploads; inspect the exact current gallery sources and product IDs it plans to migrate. It should process only current local image paths, preserve existing Cloudinary images and edited product data, enforce the shared metadata validator, and maintain reference lists transactionally. Explicitly target the intended Firebase project. Follow the script's documented command/flags in the main setup instructions; never treat an import report as proof of a completed provider upload.

Interrupted uploads or expired/rejected tickets can leave an orphan asset in Cloudinary. They never become customer-visible without successful completion. To clean up, inspect the ticket, Cloudinary public ID, and Firestore reference records first. Complete valid pending tickets or remove truly unreferenced resources through an operator process. Do not bulk-delete the entire `vela/products/` prefix: assets may still be used by published or archived products. Untracked orphan resources are deliberately not deletable through the public admin API; reconcile and inspect them in the Cloudinary console.

`src/lib/cloudinary/shared.ts` exposes `mediaDocumentId` and `validateCloudinaryResource` without environment initialization for CLI/server reuse. Browser components must import `cloudinaryDeliveryUrl` from `src/lib/cloudinary/delivery.ts`, which has no Node dependencies. Optimized URLs use automatic quality/format and bounded width transformations; canonical original URLs remain stored in Firestore.

## Verification

The unit suite exercises real SDK signature generation with local fixture values, missing configuration, metadata origin/format/size checks, upload ownership and expiry, exact retry idempotence, shared references, gallery validation, protected routes, deletion retries, and deletion/attachment races. These tests inject provider results and do not contact Cloudinary.

With real credentials, verify signed upload, multiple images, replacement, reordered storefront delivery, detached-but-still-shared deletion refusal, deletion retries, and CDN invalidation. Confirm no API secret appears in browser requests, server responses, rendered HTML, or source bundles. External provider verification remains pending until those checks are actually run.

Cloudinary references: [signed uploads](https://cloudinary.com/documentation/upload_images), [Upload API](https://cloudinary.com/documentation/image_upload_api_reference), and [asset deletion](https://cloudinary.com/documentation/delete_assets).
