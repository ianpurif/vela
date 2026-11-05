import { requireAdmin } from "@/server/auth";
import { api, assertSameOrigin, readJson } from "@/server/http";
import { adjustmentSchema, adjustStock } from "@/server/services/admin";
export const PATCH = api(async (request) => {
  assertSameOrigin(request);
  const user = await requireAdmin();
  return Response.json({
    product: await adjustStock(await readJson(request, adjustmentSchema), user.uid),
  });
});
