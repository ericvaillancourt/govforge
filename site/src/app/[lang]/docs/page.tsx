import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, ArrowRight, BookOpen } from "lucide-react";
import { notFound } from "next/navigation";

import { getDictionary } from "@/dictionaries";
import { isLocale, localePath, type Locale } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang as Locale);
  return {
    title: dict.docs.metaTitle,
    description: dict.docs.metaDescription,
    alternates: {
      canonical: `/${lang}/docs/`,
      languages: {
        en: "/en/docs/",
        fr: "/fr/docs/",
        "x-default": "/en/docs/",
      },
    },
  };
}

interface DocCard {
  title: string;
  desc: string;
  href: string;
  external?: boolean;
}

export default async function DocsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const locale = lang as Locale;
  const dict = await getDictionary(locale);
  const cards = dict.docs.cards as DocCard[];

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
      <div className="max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1 text-xs text-muted-foreground">
          <BookOpen className="h-3.5 w-3.5" />
          {locale === "fr" ? "Phase 1" : "Phase 1"}
        </div>
        <h1 className="mt-4 text-4xl sm:text-5xl font-semibold tracking-tight">
          {dict.docs.heading}
        </h1>
        <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed">
          {dict.docs.subheading}
        </p>
      </div>

      <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const isExternal = Boolean(card.external);
          const href = isExternal ? card.href : localePath(locale, card.href);
          const Icon = isExternal ? ArrowUpRight : ArrowRight;
          const linkProps = isExternal
            ? { href, target: "_blank" as const, rel: "noreferrer" }
            : { href };
          const Comp = isExternal ? "a" : Link;
          return (
            <li key={card.href}>
              <Comp
                {...linkProps}
                className="group block h-full rounded-xl border border-border/60 bg-card p-6 transition-colors hover:border-foreground/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-base font-semibold tracking-tight">
                    {card.title}
                  </h2>
                  <Icon
                    className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {card.desc}
                </p>
              </Comp>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
