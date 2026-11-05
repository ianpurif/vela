"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { fulfillmentInputSchema, type FulfillmentInput } from "@/lib/validation/operations";
import { fulfillmentLabels, FulfillmentBadge } from "@/components/admin/operations-ui";
import { AdminMessage } from "@/components/admin/admin-ui";
import { adminError, adminRequest } from "@/components/admin/client";
import { Button } from "@/components/ui/button";
import type { FulfillmentStatus, Order } from "@/types/commerce";

const steps: FulfillmentStatus[] = ["unfulfilled", "processing", "shipped", "delivered"];
export function FulfillmentForm({ order }: { order: Order }) {
  const router = useRouter();
  const [savedOrder, setSavedOrder] = useState(order);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FulfillmentInput>({
    resolver: zodResolver(fulfillmentInputSchema),
    defaultValues: {
      id: order.id,
      fulfillmentStatus: order.fulfillmentStatus,
      trackingNumber: order.trackingNumber,
    },
  });
  const step = steps.indexOf(savedOrder.fulfillmentStatus);
  async function save(values: FulfillmentInput) {
    setError("");
    setMessage("");
    try {
      const result = await adminRequest<{ order: Order }>("/api/admin/orders", "PATCH", values);
      setSavedOrder(result.order);
      reset({
        id: result.order.id,
        fulfillmentStatus: result.order.fulfillmentStatus,
        trackingNumber: result.order.trackingNumber,
      });
      setMessage("Fulfillment saved.");
      router.refresh();
    } catch (failure) {
      setError(adminError(failure));
    }
  }
  return (
    <section className="border border-olive/10 bg-ivory p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="mb-0 font-sans text-sm font-medium tracking-normal">Fulfillment</h2>
        <FulfillmentBadge status={savedOrder.fulfillmentStatus} />
      </div>
      {savedOrder.paymentStatus !== "paid" ? (
        <p className="mb-0 text-xs leading-6 text-olive/80">
          Fulfillment becomes available after Stripe confirms payment. This order has not been
          verified as paid.
        </p>
      ) : (
        <form
          onSubmit={handleSubmit(save)}
          noValidate
          aria-label="Update order fulfillment"
          className="space-y-5"
        >
          <p className="mb-0 text-[11px] leading-6 text-olive/80">
            Move through each step in order. A tracking number is required for shipping and
            delivery; it can be corrected at the current step.
          </p>
          <input type="hidden" {...register("id")} />
          <div>
            <label htmlFor="fulfillment-status" className="label">
              Fulfillment status
            </label>
            <select
              id="fulfillment-status"
              className="field text-xs"
              disabled={isSubmitting}
              aria-invalid={!!errors.fulfillmentStatus}
              aria-describedby={errors.fulfillmentStatus ? "fulfillment-status-error" : undefined}
              {...register("fulfillmentStatus")}
            >
              {steps.map((status, index) => (
                <option key={status} value={status} disabled={index < step || index > step + 1}>
                  {fulfillmentLabels[status]}
                </option>
              ))}
            </select>
            {errors.fulfillmentStatus && (
              <p
                id="fulfillment-status-error"
                role="alert"
                className="mt-2 text-[11px] text-[#8c4b32]"
              >
                {errors.fulfillmentStatus.message}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="tracking-number" className="label">
              Tracking number
            </label>
            <input
              id="tracking-number"
              type="text"
              maxLength={100}
              autoComplete="off"
              className="field text-xs"
              disabled={isSubmitting}
              aria-invalid={!!errors.trackingNumber}
              aria-describedby={
                errors.trackingNumber ? "tracking-number-error" : "tracking-number-hint"
              }
              {...register("trackingNumber")}
            />
            {errors.trackingNumber ? (
              <p
                id="tracking-number-error"
                role="alert"
                className="mt-2 text-[11px] text-[#8c4b32]"
              >
                {errors.trackingNumber.message}
              </p>
            ) : (
              <p
                id="tracking-number-hint"
                className="mt-2 mb-0 text-[10px] leading-5 text-olive/80"
              >
                Enter the carrier’s tracking reference, up to 100 characters.
              </p>
            )}
          </div>
          <AdminMessage message={error} error />
          <AdminMessage message={message} />
          <Button type="submit" disabled={isSubmitting || !isDirty} className="w-full">
            <Save size={14} />
            {isSubmitting ? "Saving fulfillment…" : "Save fulfillment"}
          </Button>
        </form>
      )}
    </section>
  );
}
