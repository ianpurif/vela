import { requireUser } from "@/server/auth";
import { api } from "@/server/http";
import { getCustomerOrder } from "@/server/services/orders";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    return Response.json(
      { order: await getCustomerOrder(id, user.uid) },
      { headers: { "Cache-Control": "no-store" } },
    );
  })(request);
}
