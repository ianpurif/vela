import { api } from "@/server/http";
import { requireCron } from "@/server/cron-auth";
import { reconcileReservations } from "@/server/services/payments";

export const runtime = "nodejs";
export const maxDuration = 60;
export const GET = api(async (request) => {
  requireCron(request);
  return Response.json(await reconcileReservations(), { headers: { "Cache-Control": "no-store" } });
});
