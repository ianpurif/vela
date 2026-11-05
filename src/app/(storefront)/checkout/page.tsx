import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/server/auth";
import { getCatalogRepository } from "@/server/repositories/catalog";
import { getCustomerOrder } from "@/server/services/orders";
import { AppError } from "@/lib/errors";
import { CheckoutReview } from "@/components/checkout/checkout-review";
import { OrderConfirmation } from "@/components/checkout/order-confirmation";

export const metadata: Metadata = {
  title: "Your checkout",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string | string[] }>;
}) {
  const params = await searchParams;
  const orderId = typeof params.order === "string" ? params.order : "";
  const user = await getSession();
  if (!user)
    redirect(
      `/sign-in?returnTo=${encodeURIComponent(`/checkout${orderId ? `?order=${encodeURIComponent(orderId)}` : ""}`)}`,
    );
  if (orderId) {
    if (!/^[a-zA-Z0-9_-]{1,120}$/.test(orderId)) notFound();
    const order = await getCustomerOrder(orderId, user.uid).catch((error: unknown) => {
      if (error instanceof AppError && error.status === 404) notFound();
      throw error;
    });
    return (
      <main id="main" className="wrap py-12 pb-20 md:py-16 md:pb-28">
        <OrderConfirmation key={order.id} initialOrder={order} review />
      </main>
    );
  }
  const products = await getCatalogRepository().list();
  return (
    <main id="main" className="wrap py-12 pb-20 md:py-16 md:pb-28">
      <div className="mb-10 md:mb-14">
        <p className="eyebrow mb-5">A little care, one step away</p>
        <h1 className="mb-0 text-[64px] sm:text-[84px]">
          Your <em>checkout.</em>
        </h1>
      </div>
      <CheckoutReview
        products={products}
        uid={user.uid}
        email={user.email}
        emailVerified={user.emailVerified}
      />
    </main>
  );
}
