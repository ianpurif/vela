import { AppError } from "@/lib/errors";
import { api } from "@/server/http";
import { getAdminOrder } from "@/server/services/operations";

export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const order = await getAdminOrder((await context.params).id);
    if (!order) throw new AppError(404, "Order not found.", "ORDER_NOT_FOUND");
    return Response.json(order, { headers: { "Cache-Control": "no-store" } });
  })(request);
}
