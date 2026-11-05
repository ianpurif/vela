import { api, assertSameOrigin, readJson } from "@/server/http";
import { requireUser } from "@/server/auth";
import { getProfile, updateProfile } from "@/server/services/accounts";
import { profileSchema } from "@/lib/validation/commerce";
export const GET = api(async () =>
  Response.json(
    { profile: await getProfile(await requireUser()) },
    { headers: { "Cache-Control": "no-store" } },
  ),
);
export const PATCH = api(async (request) => {
  assertSameOrigin(request);
  const user = await requireUser();
  return Response.json({
    profile: await updateProfile(user, await readJson(request, profileSchema)),
  });
});
