import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FulfillmentStatus, PaymentStatus } from "@/types/commerce";

export const paymentLabels: Record<PaymentStatus, string> = {
  pending: "Pending",
  paid: "Verified paid",
  failed: "Failed",
  cancelled: "Cancelled",
  expired: "Expired",
};
export const fulfillmentLabels: Record<FulfillmentStatus, string> = {
  unfulfilled: "Unfulfilled",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
};
export function operationDate(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(timestamp);
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-medium",
        status === "paid"
          ? "bg-sage/15 text-olive"
          : status === "pending"
            ? "bg-champagne/25 text-[#775a32]"
            : status === "failed"
              ? "bg-[#8c4b32]/10 text-[#8c4b32]"
              : "bg-olive/5 text-olive/80",
      )}
    >
      {status === "paid" && <Check size={10} />}
      {paymentLabels[status]}
    </span>
  );
}
export function FulfillmentBadge({ status }: { status: FulfillmentStatus }) {
  return (
    <span className="inline-flex rounded-full border border-olive/15 px-2.5 py-1 text-[9px] text-olive/80">
      {fulfillmentLabels[status]}
    </span>
  );
}
export function LimitNotice({
  truncated,
  limit,
  kind,
}: {
  truncated: boolean;
  limit: number;
  kind: string;
}) {
  if (!truncated) return null;
  return (
    <p
      role="status"
      className="mb-5 border-l-2 border-champagne bg-champagne/15 p-4 text-[11px] leading-6 text-olive/75"
    >
      Showing up to {limit} matching {kind}. More results exist; narrow the filters or search to
      find a specific record.
    </p>
  );
}
