import { api } from "@/server/http";
import { listAdminCustomers } from "@/server/services/operations";

export const runtime = "nodejs";
export const GET = api(async (request) =>
  Response.json(await listAdminCustomers(new URL(request.url).searchParams.get("q") ?? ""), {
    headers: { "Cache-Control": "no-store" },
  }),
);
