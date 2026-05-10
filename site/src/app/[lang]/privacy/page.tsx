import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/dictionaries";
import { isLocale, type Locale } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = (await getDictionary(lang)).privacy;
  return {
    metadataBase: new URL("https://govforge.dev"),
    title: dict.metaTitle,
    description: dict.metaDescription,
    alternates: {
      canonical: `/${lang}/privacy/`,
      languages: {
        en: "/en/privacy/",
        fr: "/fr/privacy/",
        "x-default": "/en/privacy/",
      },
    },
  };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = (await getDictionary(lang as Locale)).privacy;

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 py-16 sm:py-24">
      <header className="border-b border-border/40 pb-6">
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
          {dict.heading}
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">{dict.lastUpdated}</p>
      </header>

      <div className="mt-10 space-y-10">
        {dict.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-xl font-semibold tracking-tight">
              {section.heading}
            </h2>
            <p className="mt-3 text-base text-muted-foreground leading-relaxed">
              {section.body}
            </p>
          </section>
        ))}
      </div>
    </main>
  );
}
