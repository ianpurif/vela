import { api, assertSameOrigin, readJson } from "@/server/http";
import { contactInputSchema } from "@/lib/validation/support";
import { saveContactMessage } from "@/server/services/support";
import { rateLimit } from "@/server/services/rate-limit";

export const runtime = "nodejs";
export const POST = api(async (request) => {
  assertSameOrigin(request);
  await rateLimit("contact:global", 60, 60_000);
  const data = await readJson(request, contactInputSchema);
  await rateLimit(`contact:email:${data.email}`, 5, 15 * 60_000);
  return Response.json(await saveContactMessage(data), {
    headers: { "Cache-Control": "no-store" },
  });
});
