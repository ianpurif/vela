import { requireUser } from "@/server/auth";
import { api, assertSameOrigin } from "@/server/http";
import { rateLimit } from "@/server/services/rate-limit";
import { cancelCheckout } from "@/server/services/payments";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(async (req) => {
    assertSameOrigin(req);
    const user = await requireUser();
    await rateLimit(`cancel-checkout:${user.uid}`, 15, 60000);
    return Response.json(
      { order: await cancelCheckout((await context.params).id, user.uid) },
      { headers: { "Cache-Control": "no-store" } },
    );
  })(request);
}
