import { requireAdmin } from "@/server/auth";
import { api, assertSameOrigin, readJson } from "@/server/http";
import { signMediaSchema, signMediaUpload } from "@/server/services/media";
import { rateLimit } from "@/server/services/rate-limit";

export const runtime = "nodejs";
export const POST = api(async (request) => {
  assertSameOrigin(request);
  const user = await requireAdmin();
  await rateLimit(`media:sign:${user.uid}`, 30, 60 * 1000);
  return Response.json(await signMediaUpload(await readJson(request, signMediaSchema), user.uid), {
    headers: { "Cache-Control": "no-store" },
  });
});
