import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { getApplicationUrl } from "@/server/application-url";

export function assertSameOrigin(request: Request) {
  const configured = getApplicationUrl();
  const origin = request.headers.get("origin");
  if (!origin || origin !== configured.origin)
    throw new AppError(403, "This request must come from the VELA website.", "ORIGIN_REJECTED");
}
export async function readBody(request: Request, maxBytes = 64000): Promise<string> {
  if (Number(request.headers.get("content-length")) > maxBytes)
    throw new AppError(413, "Request is too large.");
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const decode = (bytes?: Uint8Array, stream = false) => {
    try {
      return decoder.decode(bytes, { stream });
    } catch {
      throw new AppError(400, "Request body must contain valid UTF-8.", "INVALID_BODY_ENCODING");
    }
  };
  let size = 0;
  let body = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        throw new AppError(413, "Request is too large.");
      }
      body += decode(value, true);
    }
    return body + decode();
  } catch (error) {
    if (error instanceof AppError) {
      // Stop consuming rejected input; a stream cancellation failure must not mask its status.
      await reader.cancel().catch(() => undefined);
    }
    throw error;
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
      if (
        error instanceof Error &&
        "code" in error &&
        (error.code === 9 || error.code === "FAILED_PRECONDITION") &&
        /requires an index|index.{0,100}(?:building|not ready)/i.test(error.message)
      ) {
        console.error("VELA database index is unavailable:", error.message);
        return Response.json(
          {
            error: "The service is temporarily unavailable. Please try again shortly.",
            code: "DATABASE_INDEX_NOT_READY",
          },
          { status: 503, headers: { "Retry-After": "60" } },
        );
      }
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
