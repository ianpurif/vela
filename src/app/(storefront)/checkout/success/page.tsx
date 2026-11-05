import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/server/auth";
import { getCustomerOrder } from "@/server/services/orders";
import { AppError } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { OrderConfirmation } from "@/components/checkout/order-confirmation";

export const metadata: Metadata = { title: "Your order", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string | string[] }>;
}) {
  const params = await searchParams;
  const orderId = typeof params.order === "string" ? params.order : "";
  const user = await getSession();
  if (!user)
    redirect(
      `/sign-in?returnTo=${encodeURIComponent(`/checkout/success${orderId ? `?order=${encodeURIComponent(orderId)}` : ""}`)}`,
    );
  if (!orderId)
    return (
      <main id="main" className="wrap py-20 text-center">
        <p className="eyebrow mb-5">Your order</p>
        <h1 className="mb-6 text-6xl">Let’s find your ritual.</h1>
        <p className="mb-8 text-xs leading-7 text-olive/80">
          No order reference was provided. Open your order history to check a purchase.
        </p>
        <Button asChild>
          <Link href="/account/orders">View your orders</Link>
        </Button>
      </main>
    );
  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(orderId)) notFound();
  const order = await getCustomerOrder(orderId, user.uid).catch((error: unknown) => {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  });
  return (
    <main id="main" className="wrap py-12 pb-20 md:py-16 md:pb-28">
      <OrderConfirmation key={order.id} initialOrder={order} />
    </main>
  );
}
