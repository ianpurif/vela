import { requireAdmin } from "@/server/auth";
import { api, assertSameOrigin, readJson } from "@/server/http";
import { gallerySchema, updateMediaGallery } from "@/server/services/media";
import { rateLimit } from "@/server/services/rate-limit";

export const runtime = "nodejs";
export const PATCH = api(async (request) => {
  assertSameOrigin(request);
  const user = await requireAdmin();
  await rateLimit(`media:gallery:${user.uid}`, 60, 60 * 1000);
  return Response.json({
    product: await updateMediaGallery(await readJson(request, gallerySchema), user.uid),
  });
});
