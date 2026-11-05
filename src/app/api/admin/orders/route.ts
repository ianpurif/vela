import { requireAdmin } from "@/server/auth";
import { api, assertSameOrigin, readJson } from "@/server/http";
import { fulfillmentInputSchema } from "@/lib/validation/operations";
import { listAdminOrders, updateFulfillment } from "@/server/services/operations";
import { rateLimit } from "@/server/services/rate-limit";

export const runtime = "nodejs";
export const GET = api(async (request) =>
  Response.json(await listAdminOrders(Object.fromEntries(new URL(request.url).searchParams)), {
    headers: { "Cache-Control": "no-store" },
  }),
);
export const PATCH = api(async (request) => {
  assertSameOrigin(request);
  const actor = await requireAdmin();
  await rateLimit(`operations:fulfillment:${actor.uid}`, 60, 60_000);
  return Response.json({
    order: await updateFulfillment(await readJson(request, fulfillmentInputSchema), actor.uid),
  });
});
