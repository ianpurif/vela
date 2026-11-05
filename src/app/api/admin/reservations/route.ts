import { requireAdmin } from "@/server/auth";
import { api, assertSameOrigin } from "@/server/http";
import { rateLimit } from "@/server/services/rate-limit";
import { reconcileReservations } from "@/server/services/payments";

export const POST = api(async (request) => {
  assertSameOrigin(request);
  const user = await requireAdmin();
  await rateLimit(`recovery:${user.uid}`, 2, 60000);
  return Response.json(await reconcileReservations());
});
