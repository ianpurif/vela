import type { MetadataRoute } from "next";
import { getApplicationUrl } from "@/server/application-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin",
        "/account",
        "/cart",
        "/checkout",
        "/sign-in",
        "/register",
        "/reset-password",
        "/newsletter",
      ],
    },
    sitemap: new URL("/sitemap.xml", getApplicationUrl()).href,
  };
}
