import { api } from "@/server/http";
import { getAdminAnalytics } from "@/server/services/operations";

export const runtime = "nodejs";
export const GET = api(async (request) => {
  const days = new URL(request.url).searchParams.get("days");
  return Response.json(await getAdminAnalytics(days === null ? 30 : Number(days)), {
    headers: { "Cache-Control": "no-store" },
  });
});
