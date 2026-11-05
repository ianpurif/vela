import { requireAdmin } from "@/server/auth";
import { api, assertSameOrigin, readJson } from "@/server/http";
import { categorySchema } from "@/lib/validation/commerce";
import { saveCategory } from "@/server/services/admin";
const handler = (create: boolean) =>
  api(async (request) => {
    assertSameOrigin(request);
    const user = await requireAdmin();
    return Response.json(
      { category: await saveCategory(await readJson(request, categorySchema), user.uid, create) },
      { status: create ? 201 : 200 },
    );
  });
export const POST = handler(true);
export const PATCH = handler(false);
