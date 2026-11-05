import Image from "next/image";
import { money } from "@/lib/utils";
import type { Order } from "@/types/commerce";

export function OrderSummary({
  order,
  showAddress = false,
}: {
  order: Order;
  showAddress?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-5 flex items-center justify-between border-b border-olive/20 pb-4">
        <h2 className="mb-0 font-sans text-[11px] font-semibold tracking-[.1em] uppercase">
          Your essentials
        </h2>
        <span className="text-[10px] text-olive/80">USD</span>
      </div>
      <ul className="m-0 list-none divide-y divide-olive/15 p-0">
        {order.lines.map((line) => (
          <li key={line.productId} className="flex items-center gap-4 py-5">
            <div className="relative h-20 w-16 shrink-0 overflow-hidden bg-sand/50">
              {line.image ? (
                <Image src={line.image} alt="" fill sizes="64px" className="object-cover" />
              ) : (
                <span className="flex h-full items-center justify-center font-display text-3xl text-olive/35">
                  V
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-2 font-display text-[23px] leading-tight">{line.name}</p>
              <p className="mb-0 text-[10px] text-olive/80">
                Quantity {line.quantity} <span className="mx-1">·</span> {money(line.unitPrice)}{" "}
                each
              </p>
            </div>
            <span className="text-xs tabular-nums">{money(line.unitPrice * line.quantity)}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-5 mb-0 grid grid-cols-2 gap-y-4 border-t border-olive/20 pt-6 text-xs">
        <dt className="text-olive/80">Subtotal</dt>
        <dd className="m-0 text-right tabular-nums">{money(order.subtotal)}</dd>
        <dt className="text-olive/80">US shipping</dt>
        <dd className="m-0 text-right">
          {order.shipping ? money(order.shipping) : "Complimentary"}
        </dd>
        <dt className="mt-2 border-t border-olive/15 pt-5 font-medium">Total</dt>
        <dd className="m-0 mt-2 border-t border-olive/15 pt-4 text-right font-display text-4xl">
          {money(order.total)}
        </dd>
      </dl>
      {showAddress && (
        <div className="mt-8 border-t border-olive/15 pt-7">
          <h3 className="mb-4 text-[10px] font-semibold tracking-[.12em] uppercase">
            Delivery details
          </h3>
          {order.shippingAddress ? (
            <address className="text-xs not-italic leading-7 text-olive/75">
              {order.shippingAddress.name}
              <br />
              {order.shippingAddress.line1}
              <br />
              {order.shippingAddress.line2 && (
                <>
                  {order.shippingAddress.line2}
                  <br />
                </>
              )}
              {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
              {order.shippingAddress.postalCode}
              <br />
              {order.shippingAddress.country}
            </address>
          ) : (
            <p className="mb-0 text-xs leading-6 text-olive/80">
              {order.paymentStatus === "paid"
                ? "No delivery address is attached to this test order."
                : "Enter your delivery address securely at Stripe checkout."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
