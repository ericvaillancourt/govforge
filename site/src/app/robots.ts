import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/_next/", "/_not-found/"],
      },
    ],
    sitemap: "https://govforge.dev/sitemap.xml",
    host: "https://govforge.dev",
  };
}
