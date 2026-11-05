"use client";

export async function adminRequest<T>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  data: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      typeof body.error === "string"
        ? body.error
        : "This change couldn’t be saved. Please try again.",
    );
  return body as T;
}

export function adminError(error: unknown) {
  if (error instanceof Error && error.message !== "Failed to fetch") return error.message;
  return "We couldn’t connect to the store. Please try again.";
}
