import { z } from "zod";
import { requireAdmin } from "@/server/auth";
import { api, assertSameOrigin, readJson } from "@/server/http";
import { documentId, productInputSchema } from "@/lib/validation/commerce";
import { getAdminCatalog, saveProduct } from "@/server/services/admin";
export const GET = api(async () =>
  Response.json(await getAdminCatalog(), { headers: { "Cache-Control": "no-store" } }),
);
export const POST = api(async (request) => {
  assertSameOrigin(request);
  const user = await requireAdmin();
  return Response.json(
    { product: await saveProduct(await readJson(request, productInputSchema), user.uid) },
    { status: 201 },
  );
});
export const PATCH = api(async (request) => {
  assertSameOrigin(request);
  const user = await requireAdmin();
  const { id, product } = await readJson(
    request,
    z.object({ id: documentId, product: productInputSchema }).strict(),
  );
  return Response.json({ product: await saveProduct(product, user.uid, id) });
});
