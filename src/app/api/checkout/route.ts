import { requireUser } from "@/server/auth";
import { api, assertSameOrigin, readJson } from "@/server/http";
import { rateLimit } from "@/server/services/rate-limit";
import { checkoutSchema } from "@/server/services/orders";
import { startCheckout } from "@/server/services/payments";

export const runtime = "nodejs";
export const POST = api(async (request) => {
  assertSameOrigin(request);
  const user = await requireUser();
  await rateLimit(`checkout:${user.uid}`, 10, 60000);
  return Response.json(
    { order: await startCheckout(await readJson(request, checkoutSchema), user) },
    { headers: { "Cache-Control": "no-store" } },
  );
});
