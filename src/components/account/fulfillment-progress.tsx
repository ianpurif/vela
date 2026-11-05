import { Check } from "lucide-react";
import type { FulfillmentStatus } from "@/types/commerce";

const steps: { status: FulfillmentStatus; label: string }[] = [
  { status: "unfulfilled", label: "Order recorded" },
  { status: "processing", label: "Preparing" },
  { status: "shipped", label: "Shipped" },
  { status: "delivered", label: "Delivered" },
];
export function FulfillmentProgress({ status }: { status: FulfillmentStatus }) {
  const current = steps.findIndex((step) => step.status === status);
  return (
    <section aria-labelledby="fulfillment-heading" className="mt-14 border-t border-olive/20 pt-9">
      <h2 id="fulfillment-heading" className="mb-7 font-display text-3xl">
        Your order’s journey
      </h2>
      <ol className="m-0 grid list-none grid-cols-2 gap-6 p-0 md:grid-cols-4">
        {steps.map((step, index) => (
          <li
            key={step.status}
            aria-current={index === current ? "step" : undefined}
            className={`border-t-2 pt-4 text-xs ${index <= current ? "border-olive text-olive" : "border-olive/15 text-olive/80"}`}
          >
            <span className="mb-3 flex items-center gap-2">
              {index < current ? (
                <Check size={16} />
              ) : (
                <span className="inline-flex h-4 w-4 items-center justify-center text-[10px]">
                  0{index + 1}
                </span>
              )}
              {step.label}
            </span>
            {index === current && (
              <span className="text-[10px] uppercase tracking-wider">Current step</span>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-6 mb-0 text-xs leading-6 text-olive/75">
        This is a test fulfillment record. Its status is maintained by the store administrator; it
        does not represent a physical shipment.
      </p>
    </section>
  );
}
