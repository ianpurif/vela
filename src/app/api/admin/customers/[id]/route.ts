import { AppError } from "@/lib/errors";
import { api } from "@/server/http";
import { getAdminCustomer } from "@/server/services/operations";

export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const customer = await getAdminCustomer((await context.params).id);
    if (!customer) throw new AppError(404, "Customer not found.", "CUSTOMER_NOT_FOUND");
    return Response.json(customer, { headers: { "Cache-Control": "no-store" } });
  })(request);
}
