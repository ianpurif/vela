import { api, assertSameOrigin, readJson } from "@/server/http";
import { newsletterInputSchema } from "@/lib/validation/support";
import { saveNewsletterPreference } from "@/server/services/support";
import { rateLimit } from "@/server/services/rate-limit";

export const runtime = "nodejs";
export const POST = api(async (request) => {
  assertSameOrigin(request);
  await rateLimit("newsletter:global", 120, 60_000);
  const data = await readJson(request, newsletterInputSchema);
  await rateLimit(`newsletter:email:${data.email}`, 10, 15 * 60_000);
  return Response.json(await saveNewsletterPreference(data), {
    headers: { "Cache-Control": "no-store" },
  });
});
