import Link from "next/link";
import { localePath, type Locale } from "@/lib/i18n";
import type { DocEntry } from "@/lib/docs";

interface DocsSidebarProps {
  entries: DocEntry[];
  currentSlug: string;
  lang: Locale;
}

const SECTIONS: { title: string; slugs: string[] }[] = [
  { title: "Getting started", slugs: ["quickstart", "configuration"] },
  { title: "Reference", slugs: ["cli-reference", "mcp-reference", "mcp-integration"] },
  { title: "Architecture", slugs: ["architecture", "data-model", "policy-authoring"] },
  { title: "Operations", slugs: ["release", "threat-model"] },
  { title: "About", slugs: ["workflow-example", "faq", "brand"] },
];

const SECTIONS_FR: Record<string, string> = {
  "Getting started": "Pour commencer",
  "Reference": "Référence",
  "Architecture": "Architecture",
  "Operations": "Opérations",
  "About": "À propos",
};

export function DocsSidebar({ entries, currentSlug, lang }: DocsSidebarProps) {
  const map = new Map(entries.map((e) => [e.slug, e]));
  return (
    <nav aria-label="Documentation" className="text-sm">
      <ul className="space-y-6">
        {SECTIONS.map((section) => {
          const items = section.slugs
            .map((s) => map.get(s))
            .filter((e): e is DocEntry => Boolean(e));
          if (items.length === 0) return null;
          const sectionTitle = lang === "fr" ? SECTIONS_FR[section.title] : section.title;
          return (
            <li key={section.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {sectionTitle}
              </h3>
              <ul className="space-y-1">
                {items.map((item) => {
                  const active = item.slug === currentSlug;
                  return (
                    <li key={item.slug}>
                      <Link
                        href={localePath(lang, `/docs/${item.slug}`)}
                        className={
                          active
                            ? "block rounded-md px-2 py-1 bg-muted/60 text-foreground"
                            : "block rounded-md px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                        }
                        aria-current={active ? "page" : undefined}
                      >
                        {item.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
