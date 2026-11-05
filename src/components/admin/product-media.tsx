"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowUpToLine,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  LoaderCircle,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminMessage } from "@/components/admin/admin-ui";
import { adminError, adminRequest } from "@/components/admin/client";
import {
  defaultImageAlt,
  MAX_GALLERY_IMAGES,
  uploadToCloudinary,
  validateUploadFile,
  type UploadTicket,
} from "@/components/admin/media-upload";
import type { Product, ProductImage } from "@/types/commerce";

type PendingImage = {
  id: string;
  file: File;
  alt: string;
  replacement?: ProductImage;
  ticket?: UploadTicket;
  uploaded: boolean;
  status: "ready" | "uploading" | "verifying" | "done" | "error";
  error: string;
};
type DetachedImage = ProductImage & { publicId: string };

/** Gallery mutations are separate from the parent product form so unsaved text stays intact. */
export function ProductMedia({ product }: { product: Product }) {
  const router = useRouter();
  const [updated, setUpdated] = useState<Product | null>(null);
  const [queue, setQueue] = useState<PendingImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const replacement = useRef<ProductImage | null>(null);
  const [detached, setDetached] = useState<DetachedImage[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<DetachedImage | null>(null);
  const addInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const galleryHeading = useRef<HTMLHeadingElement>(null);
  const deleteTrigger = useRef<HTMLButtonElement>(null);
  const active =
    updated?.id === product.id && updated.updatedAt >= product.updatedAt ? updated : product;
  const images = active.images;
  const remaining =
    MAX_GALLERY_IMAGES -
    images.length -
    queue.filter((item) => !item.replacement && item.status !== "done").length;

  function updateQueue(id: string, change: Partial<PendingImage>) {
    setQueue((items) => items.map((item) => (item.id === id ? { ...item, ...change } : item)));
  }
  function rememberDetached(image?: ProductImage) {
    if (!image?.publicId) return;
    const candidate = { ...image, publicId: image.publicId };
    setDetached((items) =>
      items.some((item) => item.publicId === candidate.publicId) ? items : [...items, candidate],
    );
  }
  function selectFiles(event: ChangeEvent<HTMLInputElement>, replace?: ProductImage | null) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length || busy) return;
    setError("");
    setMessage("");
    const invalid = files.map(validateUploadFile).filter(Boolean);
    if (invalid.length) {
      setError(invalid.join(" "));
      return;
    }
    if (!replace && files.length > remaining) {
      setError(
        `A gallery can contain ${MAX_GALLERY_IMAGES} images. You can add ${Math.max(0, remaining)} more.`,
      );
      return;
    }
    const selected = (replace ? files.slice(0, 1) : files).map((file): PendingImage => ({
      id: crypto.randomUUID(),
      file,
      alt: replace?.alt || defaultImageAlt(product.name, file.name),
      replacement: replace || undefined,
      uploaded: false,
      status: "ready",
      error: "",
    }));
    setQueue((items) => [
      ...items.filter((item) => !replace || item.replacement?.src !== replace.src),
      ...selected,
    ]);
    replacement.current = null;
  }
  async function processUploads(onlyId?: string) {
    if (busy) return;
    const selected = queue.filter(
      (item) => item.status !== "done" && (!onlyId || item.id === onlyId),
    );
    if (!selected.length) return;
    if (selected.some((item) => !item.alt.trim() || item.alt.trim().length > 180)) {
      setError("Describe each image in 1–180 characters before uploading.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    let completed = 0;
    for (const item of selected) {
      let ticket = item.ticket;
      try {
        updateQueue(item.id, {
          status: item.uploaded ? "verifying" : "uploading",
          error: "",
          alt: item.alt.trim(),
        });
        ticket ||= await adminRequest<UploadTicket>("/api/admin/media/sign", "POST", {
          productId: product.id,
        });
        updateQueue(item.id, { ticket });
        let uploadFailure: unknown;
        if (!item.uploaded) {
          try {
            await uploadToCloudinary(ticket, item.file);
            updateQueue(item.id, { uploaded: true });
          } catch (failure) {
            uploadFailure = failure;
          }
        }
        updateQueue(item.id, { status: "verifying" });
        let result: { product: Product };
        try {
          // Verification is authoritative, including when an upload response was interrupted.
          result = await adminRequest<{ product: Product }>("/api/admin/media/complete", "POST", {
            ticketId: ticket.ticketId,
            alt: item.alt.trim(),
            ...(item.replacement ? { replaceSrc: item.replacement.src } : {}),
          });
        } catch (failure) {
          throw uploadFailure || failure;
        }
        setUpdated(result.product);
        rememberDetached(item.replacement);
        updateQueue(item.id, { status: "done", uploaded: true, error: "" });
        completed += 1;
      } catch (failure) {
        const detail = adminError(failure);
        updateQueue(item.id, { status: "error", error: detail, ...(ticket ? { ticket } : {}) });
        setError(`Stopped at ${item.file.name}. ${detail}`);
        break;
      }
    }
    if (completed) {
      setMessage(
        `${completed} ${completed === 1 ? "image" : "images"} verified and saved to the gallery.`,
      );
      setQueue((items) => items.filter((item) => item.status !== "done"));
      router.refresh();
    }
    setBusy(false);
  }
  async function reorder(from: number, to: number) {
    if (busy || from === to) return;
    setBusy(true);
    setError("");
    setMessage("");
    const next = [...images];
    next.splice(to, 0, next.splice(from, 1)[0]);
    try {
      const result = await adminRequest<{ product: Product }>("/api/admin/media/gallery", "PATCH", {
        productId: product.id,
        action: "reorder",
        sources: next.map((image) => image.src),
      });
      setUpdated(result.product);
      setMessage("Gallery order saved. The first image is the product cover.");
      router.refresh();
    } catch (failure) {
      setError(adminError(failure));
    } finally {
      setBusy(false);
    }
  }
  async function removeImage(image: ProductImage) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await adminRequest<{ product: Product }>("/api/admin/media/gallery", "PATCH", {
        productId: product.id,
        action: "remove",
        src: image.src,
      });
      setUpdated(result.product);
      rememberDetached(image);
      setQueue((items) => items.filter((item) => item.replacement?.src !== image.src));
      setMessage("Image removed from this product. The original asset has not been deleted.");
      router.refresh();
      requestAnimationFrame(() => galleryHeading.current?.focus({ preventScroll: true }));
    } catch (failure) {
      setError(adminError(failure));
    } finally {
      setBusy(false);
    }
  }
  async function deleteAsset() {
    if (!deleteTarget || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await adminRequest<{ ok: true }>("/api/admin/media", "DELETE", {
        publicId: deleteTarget.publicId,
      });
      setDetached((items) => items.filter((item) => item.publicId !== deleteTarget.publicId));
      setDeleteTarget(null);
      setMessage("The unused image was permanently deleted from Cloudinary.");
    } catch (failure) {
      setError(adminError(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="relative min-w-0 border border-olive/10 bg-ivory p-5 sm:p-6"
      aria-busy={busy}
      onKeyDown={(event) => {
        if (
          event.key === "Enter" &&
          event.target instanceof HTMLInputElement &&
          event.target.type === "text"
        )
          event.preventDefault();
      }}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2
          ref={galleryHeading}
          tabIndex={-1}
          className="mb-0 font-sans text-sm font-medium tracking-normal"
        >
          Product gallery
        </h2>
        <span className="text-[10px] text-olive/80">
          {images.length}/{MAX_GALLERY_IMAGES}
        </span>
      </div>
      <p className="mb-5 text-[11px] leading-6 text-olive/80">
        The first image is the cover. Gallery changes save immediately.
      </p>
      {images.length ? (
        <ol className="m-0 list-none space-y-4 p-0">
          {images.map((image, index) => (
            <li key={image.src} className="min-w-0 border-b border-olive/10 pb-4">
              <div className="flex gap-3">
                <div className="relative h-[88px] w-[70px] shrink-0 overflow-hidden bg-sand/40">
                  <Image
                    src={image.src}
                    alt={image.alt}
                    fill
                    sizes="70px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-[9px] font-medium tracking-wider text-olive/80 uppercase">
                    {index === 0 ? "Cover image" : `Image ${index + 1}`}
                  </p>
                  <p className="mb-3 line-clamp-3 break-words text-[10px] leading-5">{image.alt}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        replacement.current = image;
                        replaceInput.current?.click();
                      }}
                      aria-label={`Replace image ${index + 1}`}
                      className="inline-flex items-center gap-1 py-1 text-[9px] underline underline-offset-4 disabled:opacity-40"
                    >
                      <RefreshCw size={10} />
                      Replace
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => removeImage(image)}
                      aria-label={`Remove image ${index + 1} from gallery`}
                      className="inline-flex items-center gap-1 py-1 text-[9px] text-olive/80 underline underline-offset-4 disabled:opacity-40"
                    >
                      <X size={10} />
                      Remove
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[9px] text-olive/80">
                  {image.publicId ? "Cloudinary" : "Supplied image"}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={busy || index === 0}
                    onClick={() => reorder(index, 0)}
                    aria-label={`Make image ${index + 1} the cover`}
                    className="flex h-7 w-7 items-center justify-center border border-olive/15 disabled:opacity-25"
                  >
                    <ArrowUpToLine size={12} />
                  </button>
                  <button
                    type="button"
                    disabled={busy || index === 0}
                    onClick={() => reorder(index, index - 1)}
                    aria-label={`Move image ${index + 1} earlier`}
                    className="flex h-7 w-7 items-center justify-center border border-olive/15 disabled:opacity-25"
                  >
                    <ChevronUp size={13} />
                  </button>
                  <button
                    type="button"
                    disabled={busy || index === images.length - 1}
                    onClick={() => reorder(index, index + 1)}
                    aria-label={`Move image ${index + 1} later`}
                    className="flex h-7 w-7 items-center justify-center border border-olive/15 disabled:opacity-25"
                  >
                    <ChevronDown size={13} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mb-0 border border-dashed border-olive/20 p-6 text-center text-xs leading-6 text-olive/80">
          Add a product image to introduce this essential.
        </p>
      )}
      <input
        ref={addInput}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/avif"
        aria-label="Choose product images"
        className="hidden"
        onChange={(event) => selectFiles(event)}
        disabled={busy}
      />
      <input
        ref={replaceInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        aria-label="Choose replacement image"
        className="hidden"
        onChange={(event) => selectFiles(event, replacement.current)}
        disabled={busy}
      />
      <Button
        type="button"
        variant="outline"
        disabled={busy || remaining <= 0}
        className="mt-5 w-full px-3 text-[9px]"
        onClick={() => addInput.current?.click()}
      >
        <ImagePlus size={14} />
        Choose images
      </Button>
      <p className="mt-3 mb-0 text-[9px] leading-5 text-olive/80">
        JPG, PNG, WebP or AVIF. Up to 8 MB per image and 8,000 pixels per side.
      </p>
      {queue.length > 0 && (
        <div className="mt-6 border-t border-olive/15 pt-5">
          <h3 className="mb-4 text-xs font-semibold">Ready to upload</h3>
          <div className="space-y-4">
            {queue.map((item) => (
              <div key={item.id} className="min-w-0 border border-olive/15 p-3">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="mb-1 break-all text-[10px] font-medium">{item.file.name}</p>
                    <p className="mb-0 text-[9px] text-olive/80">
                      {(item.file.size / 1024 / 1024).toFixed(2)} MB
                      {item.replacement ? " · Replaces an existing image" : " · New image"}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      setQueue((items) => items.filter((candidate) => candidate.id !== item.id))
                    }
                    aria-label={`Discard ${item.file.name}`}
                    className="p-1 disabled:opacity-30"
                  >
                    <X size={13} />
                  </button>
                </div>
                <label
                  htmlFor={`media-alt-${item.id}`}
                  className="mb-2 block text-[10px] font-medium"
                >
                  Image description
                </label>
                <input
                  id={`media-alt-${item.id}`}
                  type="text"
                  value={item.alt}
                  maxLength={180}
                  disabled={busy || !!item.ticket}
                  onChange={(event) => updateQueue(item.id, { alt: event.target.value })}
                  className="field px-3 py-2 text-[11px] disabled:opacity-65"
                />
                <p className="mt-2 mb-0 text-[9px] leading-5 text-olive/80">
                  Describe what’s shown for people using screen readers.
                </p>
                {item.status === "uploading" || item.status === "verifying" ? (
                  <p role="status" className="mt-3 mb-0 inline-flex items-center gap-2 text-[10px]">
                    <LoaderCircle size={12} className="animate-spin" />
                    {item.status === "uploading" ? "Uploading image…" : "Verifying and saving…"}
                  </p>
                ) : item.status === "error" ? (
                  <div className="mt-3">
                    <p className="mb-2 break-words text-[10px] leading-5 text-[#8c4b32]">
                      {item.error}
                    </p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => processUploads(item.id)}
                      className="text-[10px] underline underline-offset-4"
                    >
                      {item.uploaded ? "Retry attaching image" : "Retry upload"}
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <Button
            type="button"
            disabled={busy}
            onClick={() => processUploads()}
            className="mt-4 w-full px-3 text-[9px]"
          >
            {busy ? <LoaderCircle size={14} className="animate-spin" /> : <Upload size={14} />}
            {busy
              ? "Working…"
              : `Upload ${queue.length} ${queue.length === 1 ? "image" : "images"}`}
          </Button>
        </div>
      )}
      <div className="mt-5 space-y-3">
        <AdminMessage message={error} error />
        <AdminMessage message={message} />
      </div>
      {detached.length > 0 && (
        <div className="mt-5 border-t border-olive/15 pt-5">
          <h3 className="mb-2 text-[11px] font-semibold">Detached cloud images</h3>
          <p className="mb-3 text-[10px] leading-5 text-olive/80">
            These images were removed from this product. Deletion is blocked if another product
            still uses them.
          </p>
          <ul className="m-0 list-none space-y-3 p-0">
            {detached.map((image) => (
              <li key={image.publicId} className="min-w-0">
                <p className="mb-1 truncate text-[10px] text-olive/80">{image.alt}</p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={(event) => {
                    deleteTrigger.current = event.currentTarget;
                    setError("");
                    setDeleteTarget(image);
                  }}
                  className="inline-flex items-center gap-1.5 py-1 text-[10px] text-[#8c4b32] underline underline-offset-4 disabled:opacity-40"
                >
                  <Trash2 size={11} />
                  Delete unused asset
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Dialog.Root
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleteTarget(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[70] bg-charcoal/40 backdrop-blur-[2px]" />
          <Dialog.Content
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              if (deleteTrigger.current?.isConnected) deleteTrigger.current.focus();
              else galleryHeading.current?.focus({ preventScroll: true });
            }}
            onEscapeKeyDown={(event) => {
              if (busy) event.preventDefault();
            }}
            onInteractOutside={(event) => {
              if (busy) event.preventDefault();
            }}
            className="fixed left-1/2 top-1/2 z-[71] max-h-[90dvh] w-[calc(100%_-_32px)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto bg-ivory p-7 shadow-xl"
          >
            <Dialog.Title className="mb-4 font-sans text-xl font-medium">
              Permanently delete this image?
            </Dialog.Title>
            <Dialog.Description className="mb-5 text-xs leading-7 text-olive/75">
              This removes the original cloud image permanently. It cannot be undone. The server
              will refuse deletion if a product still references it.
            </Dialog.Description>
            {deleteTarget && (
              <div className="mb-5 border border-olive/15 p-4">
                <p className="mb-2 text-xs">{deleteTarget.alt}</p>
                <p className="mb-0 break-all font-mono text-[9px] text-olive/80">
                  {deleteTarget.publicId}
                </p>
              </div>
            )}
            <AdminMessage message={error} error />
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <Dialog.Close asChild>
                <Button type="button" variant="outline" disabled={busy}>
                  Keep asset
                </Button>
              </Dialog.Close>
              <Button
                type="button"
                disabled={busy}
                onClick={deleteAsset}
                className="bg-[#8c4b32] hover:bg-[#74412e]"
              >
                {busy ? "Deleting…" : "Delete permanently"}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
