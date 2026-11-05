import { requireAdmin } from "@/server/auth";
import { api, assertSameOrigin, readJson } from "@/server/http";
import { contentInputSchema } from "@/lib/validation/operations";
import { getAdminContent, saveHomeContent } from "@/server/services/operations";
import { rateLimit } from "@/server/services/rate-limit";

export const runtime = "nodejs";
export const GET = api(async () =>
  Response.json(await getAdminContent(), { headers: { "Cache-Control": "no-store" } }),
);
export const PATCH = api(async (request) => {
  assertSameOrigin(request);
  const actor = await requireAdmin();
  await rateLimit(`operations:content:${actor.uid}`, 30, 60_000);
  return Response.json({
    content: await saveHomeContent(await readJson(request, contentInputSchema), actor.uid),
  });
});
