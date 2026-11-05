"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminMessage, ProductStatus } from "@/components/admin/admin-ui";
import { adminError, adminRequest } from "@/components/admin/client";
import type { AuditLog, Product } from "@/types/commerce";

const adjustmentSchema = z.object({
  delta: z
    .number()
    .int("Use a whole number of units.")
    .min(-100000)
    .max(100000)
    .refine((value) => value !== 0, "Enter a positive or negative adjustment."),
  reason: z.string().trim().min(3, "Add a short reason for this change.").max(300),
});
type Adjustment = z.infer<typeof adjustmentSchema>;

function AdjustmentForm({
  product,
  onSuccess,
}: {
  product: Product;
  onSuccess: (product: Product) => void;
}) {
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Adjustment>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: { delta: 0, reason: "" },
  });
  const delta = useWatch({ control, name: "delta" });
  const projected = product.stock + (Number.isFinite(delta) ? delta : 0);
  async function submit(values: Adjustment) {
    setError("");
    try {
      const result = await adminRequest<{ product: Product }>("/api/admin/inventory", "PATCH", {
        productId: product.id,
        ...values,
      });
      onSuccess(result.product);
    } catch (failure) {
      setError(adminError(failure));
    }
  }
  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="mt-6 space-y-5">
      <dl className="grid grid-cols-3 gap-3 border-y border-olive/15 py-5 text-center">
        <div>
          <dt className="mb-2 text-[9px] text-olive/55">On hand</dt>
          <dd className="m-0 text-xl tabular-nums">{product.stock}</dd>
        </div>
        <div>
          <dt className="mb-2 text-[9px] text-olive/55">Reserved</dt>
          <dd className="m-0 text-xl tabular-nums">{product.reserved}</dd>
        </div>
        <div>
          <dt className="mb-2 text-[9px] text-olive/55">After adjustment</dt>
          <dd className="m-0 text-xl tabular-nums">{projected}</dd>
        </div>
      </dl>
      <div>
        <label htmlFor="inventory-delta" className="label">
          Stock adjustment
        </label>
        <input
          id="inventory-delta"
          type="number"
          step={1}
          className="field"
          aria-invalid={!!errors.delta}
          aria-describedby="inventory-delta-help"
          {...register("delta", { valueAsNumber: true })}
        />
        <p id="inventory-delta-help" className="mt-2 mb-0 text-[10px] leading-5 text-olive/65">
          Use a positive number for received stock, or a negative number for removed stock.
        </p>
        {errors.delta && (
          <p role="alert" className="mt-2 mb-0 text-xs text-[#8c4b32]">
            {errors.delta.message}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="inventory-reason" className="label">
          Reason
        </label>
        <textarea
          id="inventory-reason"
          rows={3}
          maxLength={300}
          className="field text-xs"
          placeholder="New shipment received"
          aria-invalid={!!errors.reason}
          {...register("reason")}
        />
        {errors.reason && (
          <p role="alert" className="mt-2 mb-0 text-xs text-[#8c4b32]">
            {errors.reason.message}
          </p>
        )}
      </div>
      {projected < product.reserved && (
        <p role="alert" className="text-xs leading-6 text-[#8c4b32]">
          Stock cannot be lower than the quantity reserved for active orders.
        </p>
      )}
      <AdminMessage message={error} error />
      <Button
        type="submit"
        disabled={isSubmitting || projected < product.reserved}
        className="w-full"
      >
        {isSubmitting ? "Applying…" : "Apply stock adjustment"}
      </Button>
      <p className="mb-0 text-[10px] leading-5 text-olive/55">
        This adjustment is recorded in the inventory history.
      </p>
    </form>
  );
}

export function InventoryManager({
  products,
  history,
}: {
  products: Product[];
  history: AuditLog[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [message, setMessage] = useState("");
  const filtered = products.filter(
    (product) =>
      product.status !== "archived" &&
      product.name.toLowerCase().includes(query.trim().toLowerCase()) &&
      (!lowOnly || product.stock - product.reserved <= 5),
  );
  return (
    <>
      <AdminMessage message={message} />
      <section className="min-w-0 border border-olive/10 bg-ivory">
        <div className="flex flex-col justify-between gap-4 border-b border-olive/10 p-5 sm:flex-row sm:items-center">
          <div className="relative sm:w-80">
            <label htmlFor="inventory-search" className="sr-only">
              Search inventory
            </label>
            <Search size={15} className="absolute left-3 top-3.5 text-olive/50" />
            <input
              id="inventory-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search inventory"
              className="field py-3 pl-9 text-xs"
            />
          </div>
          <label className="flex items-center gap-2.5 text-[11px]">
            <input
              type="checkbox"
              checked={lowOnly}
              onChange={(event) => setLowOnly(event.target.checked)}
              className="h-4 w-4 accent-olive"
            />
            Low stock only
          </label>
        </div>
        <div className="relative overflow-x-auto" role="region" aria-label="Inventory stock" tabIndex={0}>
          <table className="w-full min-w-[650px] border-collapse text-left text-xs">
            <thead className="border-b border-olive/10 bg-sand/15 text-[9px] tracking-wider text-olive/55 uppercase">
              <tr>
                <th className="px-5 py-3.5 font-medium">Product</th>
                <th className="px-4 py-3.5 font-medium">Status</th>
                <th className="px-4 py-3.5 text-right font-medium">On hand</th>
                <th className="px-4 py-3.5 text-right font-medium">Reserved</th>
                <th className="px-4 py-3.5 text-right font-medium">Available</th>
                <th className="px-5 py-3.5">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-olive/10">
              {filtered.map((product) => (
                <tr key={product.id} className="hover:bg-sand/15">
                  <td className="px-5 py-5 font-medium">{product.name}</td>
                  <td className="px-4 py-5">
                    <ProductStatus status={product.status} />
                  </td>
                  <td className="px-4 py-5 text-right tabular-nums">{product.stock}</td>
                  <td className="px-4 py-5 text-right tabular-nums text-olive/55">
                    {product.reserved}
                  </td>
                  <td
                    className={`px-4 py-5 text-right tabular-nums ${product.stock - product.reserved <= 5 ? "font-semibold text-[#8c4b32]" : ""}`}
                  >
                    {product.stock - product.reserved}
                  </td>
                  <td className="sticky right-0 bg-ivory px-2 py-5 text-right sm:static sm:px-5">
                    <button
                      type="button"
                      onClick={() => setSelected(product)}
                      aria-label={`Adjust stock for ${product.name}`}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center text-[10px] underline underline-offset-4"
                    >
                      Adjust
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="mb-0 py-14 text-center text-xs text-olive/60">
              No inventory matches these filters.
            </p>
          )}
        </div>
      </section>
      <section className="mt-8 min-w-0 border border-olive/10 bg-ivory">
        <div className="border-b border-olive/10 px-5 py-5">
          <h2 className="mb-2 font-sans text-sm font-medium tracking-normal">Inventory history</h2>
          <p className="mb-0 text-[10px] text-olive/55">
            Recent adjustments with their recorded reasons. Times shown in UTC.
          </p>
        </div>
        {history.length ? (
          <div
            className="relative overflow-x-auto"
            role="region"
            aria-label="Inventory adjustment history"
            tabIndex={0}
          >
            <table className="w-full min-w-[650px] border-collapse text-left text-xs">
              <thead className="border-b border-olive/10 text-[9px] tracking-wider text-olive/55 uppercase">
                <tr>
                  <th className="px-5 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 text-right font-medium">Change</th>
                  <th className="px-4 py-3 text-right font-medium">Before → After</th>
                  <th className="px-5 py-3 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-olive/10">
                {history.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap px-5 py-4 text-[10px] text-olive/65">
                      {new Intl.DateTimeFormat("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "UTC",
                      }).format(entry.createdAt)}
                    </td>
                    <td className="px-4 py-4">
                      {products.find((product) => product.id === entry.entityId)?.name ||
                        "Archived product"}
                    </td>
                    <td className="px-4 py-4 text-right font-medium tabular-nums">
                      {typeof entry.details.delta === "number" && entry.details.delta > 0
                        ? "+"
                        : ""}
                      {String(entry.details.delta ?? "—")}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right tabular-nums">
                      {String(entry.details.before ?? "—")} → {String(entry.details.after ?? "—")}
                    </td>
                    <td className="px-5 py-4 text-olive/65">
                      {String(entry.details.reason ?? "—")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mb-0 px-5 py-10 text-xs text-olive/60">
            No inventory adjustments have been recorded.
          </p>
        )}
      </section>
      <Dialog.Root
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[70] bg-charcoal/35 backdrop-blur-[2px]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[71] max-h-[90dvh] w-[calc(100%_-_32px)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto bg-ivory p-6 shadow-xl sm:p-8">
            <Dialog.Title className="mb-2 pr-7 font-sans text-xl font-medium">
              Adjust inventory
            </Dialog.Title>
            <Dialog.Description className="mb-0 text-xs leading-6 text-olive/65">
              {selected?.name}
            </Dialog.Description>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close stock adjustment"
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center"
              >
                <X size={18} />
              </button>
            </Dialog.Close>
            {selected && (
              <AdjustmentForm
                key={selected.id}
                product={selected}
                onSuccess={(updated) => {
                  setMessage(
                    `Stock updated for ${updated.name}. ${updated.stock - updated.reserved} units are now available.`,
                  );
                  setSelected(null);
                  router.refresh();
                }}
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
