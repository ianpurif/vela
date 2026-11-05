import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/server/auth";
import { getCustomerOrder } from "@/server/services/orders";
import { AppError } from "@/lib/errors";
import { OrderConfirmation } from "@/components/checkout/order-confirmation";
import { FulfillmentProgress } from "@/components/account/fulfillment-progress";

export const metadata: Metadata = {
  title: "Order details",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(id)) notFound();
  const user = await getSession();
  if (!user) redirect(`/sign-in?returnTo=${encodeURIComponent(`/account/orders/${id}`)}`);
  const order = await getCustomerOrder(id, user.uid).catch((error: unknown) => {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  });
  return (
    <main id="main" className="wrap py-12 pb-24 md:py-16 md:pb-28">
      <Link
        href="/account/orders"
        className="mb-10 inline-flex items-center gap-2 text-xs underline-offset-4 hover:underline"
      >
        <ArrowLeft size={14} />
        Your orders
      </Link>
      <OrderConfirmation key={order.id} initialOrder={order} review />
      {order.paymentStatus === "paid" && <FulfillmentProgress status={order.fulfillmentStatus} />}
    </main>
  );
}
