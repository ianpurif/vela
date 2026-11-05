import { requireAdmin } from "@/server/auth";
import { api, assertSameOrigin, readJson } from "@/server/http";
import { supportStatusInputSchema } from "@/lib/validation/support";
import { getAdminSupportInbox, updateSupportStatus } from "@/server/services/support";
import { rateLimit } from "@/server/services/rate-limit";

export const runtime = "nodejs";
export const GET = api(async (request) =>
  Response.json(
    await getAdminSupportInbox(new URL(request.url).searchParams.get("after") ?? undefined),
    { headers: { "Cache-Control": "no-store" } },
  ),
);
export const PATCH = api(async (request) => {
  assertSameOrigin(request);
  const actor = await requireAdmin();
  await rateLimit(`support:status:${actor.uid}`, 60, 60_000);
  return Response.json({
    message: await updateSupportStatus(await readJson(request, supportStatusInputSchema)),
  });
});
