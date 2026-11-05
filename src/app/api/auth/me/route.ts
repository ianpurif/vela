import { api } from "@/server/http";
import { getSession } from "@/server/auth";
export const GET = api(async () =>
  Response.json({ user: await getSession() }, { headers: { "Cache-Control": "no-store" } }),
);
