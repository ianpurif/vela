import "server-only";
import { AppError } from "@/lib/errors";

/** One explicit origin for cookies, same-origin mutations, and public metadata. */
export function getApplicationUrl(): URL {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (!configured) {
    throw new AppError(503, "The application URL is not configured.", "CONFIGURATION_REQUIRED");
  }
  let url: URL;
  try {
    // Reject forgiving URL parser repairs, empty credentials, and non-root suffixes.
    if (!/^https?:\/\/[^\s/?#\\@]+\/?$/i.test(configured)) throw new Error("Invalid origin.");
    url = new URL(configured);
  } catch {
    throw new AppError(
      503,
      "Configure a valid application origin without credentials, a path, query, or fragment.",
      "CONFIGURATION_REQUIRED",
    );
  }
  const loopback =
    url.hostname === "localhost" ||
    url.hostname === "[::1]" ||
    /^127(?:\.\d{1,3}){3}$/.test(url.hostname);
  if (
    (loopback && Boolean(process.env.VERCEL)) ||
    (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new AppError(
      503,
      "The application origin must use HTTPS, except for local loopback development.",
      "CONFIGURATION_REQUIRED",
    );
  }
  return url;
}
