import { AppError } from "@/lib/errors";
import { api } from "@/server/http";
import { getAdminSupportMessage } from "@/server/services/support";

export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const message = await getAdminSupportMessage((await context.params).id);
    if (!message) throw new AppError(404, "Message not found.", "SUPPORT_NOT_FOUND");
    return Response.json({ message }, { headers: { "Cache-Control": "no-store" } });
  })(request);
}
