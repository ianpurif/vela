import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";

export function assertSameOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (!configured) throw new AppError(503, "The application URL is not configured.");
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(configured).origin)
    throw new AppError(403, "This request must come from the VELA website.", "ORIGIN_REJECTED");
}
export async function readBody(request: Request, maxBytes = 64000): Promise<string> {
  if (Number(request.headers.get("content-length")) > maxBytes)
    throw new AppError(413, "Request is too large.");
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let body = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new AppError(413, "Request is too large.");
      }
      body += decoder.decode(value, { stream: true });
    }
    return body + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
export async function readJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new AppError(415, "Send JSON data.");
  const body = await readBody(request);
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    throw new AppError(400, "Invalid JSON.");
  }
  return schema.parse(data);
}
export function api(handler: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    try {
      return await handler(request);
    } catch (error) {
      if (error instanceof AppError)
        return Response.json({ error: error.message, code: error.code }, { status: error.status });
      if (error instanceof z.ZodError)
        return Response.json(
          { error: "Please check the supplied information.", fields: z.flattenError(error) },
          { status: 400 },
        );
      console.error(
        "VELA request failed:",
        error instanceof Error ? error.message : "Unknown error",
      );
      return Response.json(
        { error: "We couldn’t complete that request. Please try again." },
        { status: 500 },
      );
    }
  };
}
