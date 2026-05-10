import type { MetadataRoute } from "next";
import { docSlugs } from "@/lib/docs";
import { locales } from "@/lib/i18n";

export const dynamic = "force-static";

const BASE = "https://govforge.dev";

const STATIC_ROUTES = [
  { path: "", priority: 1.0, changeFrequency: "weekly" as const },
  { path: "/pricing", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/docs", priority: 0.9, changeFrequency: "weekly" as const },
  { path: "/press", priority: 0.5, changeFrequency: "monthly" as const },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const entries: MetadataRoute.Sitemap = [];

  const allRoutes = [
    ...STATIC_ROUTES,
    ...docSlugs.map((slug) => ({
      path: `/docs/${slug}`,
      priority: 0.7,
      changeFrequency: "monthly" as const,
    })),
  ];

  for (const route of allRoutes) {
    const languages: Record<string, string> = {};
    for (const lang of locales) {
      languages[lang] = `${BASE}/${lang}${route.path}/`;
    }
    languages["x-default"] = languages.en;

    for (const lang of locales) {
      entries.push({
        url: `${BASE}/${lang}${route.path}/`,
        lastModified,
        changeFrequency: route.changeFrequency,
        priority: route.priority,
        alternates: { languages },
      });
    }
  }

  return entries;
}
