import { requireAdmin } from "@/server/auth";
import { api, assertSameOrigin, readJson } from "@/server/http";
import { completeMediaSchema, completeMediaUpload } from "@/server/services/media";
import { rateLimit } from "@/server/services/rate-limit";

export const runtime = "nodejs";
export const POST = api(async (request) => {
  assertSameOrigin(request);
  const user = await requireAdmin();
  await rateLimit(`media:complete:${user.uid}`, 60, 60 * 1000);
  return Response.json({
    product: await completeMediaUpload(await readJson(request, completeMediaSchema), user.uid),
  });
});
