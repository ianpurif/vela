import { requireAdmin } from "@/server/auth";
import { api, assertSameOrigin, readJson } from "@/server/http";
import { deleteMediaAsset, deleteMediaSchema } from "@/server/services/media";
import { rateLimit } from "@/server/services/rate-limit";

export const runtime = "nodejs";
export const DELETE = api(async (request) => {
  assertSameOrigin(request);
  const user = await requireAdmin();
  await rateLimit(`media:delete:${user.uid}`, 20, 60 * 1000);
  return Response.json(
    await deleteMediaAsset(await readJson(request, deleteMediaSchema), user.uid),
  );
});
