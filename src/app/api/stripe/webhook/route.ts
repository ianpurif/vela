import { verifyStripeEvent } from "@/lib/stripe/provider";
import { api, readBody } from "@/server/http";
import { processVerifiedPaymentEvent } from "@/server/services/payments";

export const runtime = "nodejs";
export const POST = api(async (request) => {
  const event = verifyStripeEvent(
    await readBody(request, 1024 * 1024),
    request.headers.get("stripe-signature"),
  );
  return Response.json(await processVerifiedPaymentEvent(event));
});
