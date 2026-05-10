import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { isLocale, locales, localePath, type Locale } from "@/lib/i18n";
import { docSlugs, isDocSlug, getDoc, listDocs } from "@/lib/docs";
import { DocsSidebar } from "@/components/docs/sidebar";

const REPO_DOC_BASE = "https://github.com/ericvaillancourt/govforge/blob/main/docs";

export async function generateStaticParams() {
  const params: { lang: string; slug: string }[] = [];
  for (const lang of locales) {
    for (const slug of docSlugs) {
      params.push({ lang, slug });
    }
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang) || !isDocSlug(slug)) return {};
  const doc = await getDoc(slug);
  return {
    metadataBase: new URL("https://govforge.dev"),
    title: doc.title,
    description: `${doc.title} — GovForge documentation.`,
    alternates: {
      canonical: `/${lang}/docs/${slug}/`,
      languages: {
        en: `/en/docs/${slug}/`,
        fr: `/fr/docs/${slug}/`,
        "x-default": `/en/docs/${slug}/`,
      },
    },
  };
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  if (!isDocSlug(slug)) notFound();
  const locale = lang as Locale;

  const [doc, entries] = await Promise.all([getDoc(slug), listDocs()]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 lg:py-16">
      <Link
        href={localePath(locale, "/docs")}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {locale === "fr" ? "Tous les documents" : "All docs"}
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-[16rem_1fr]">
        <aside className="lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          <DocsSidebar entries={entries} currentSlug={slug} lang={locale} />
        </aside>

        <article className="min-w-0">
          <header className="mb-8 pb-6 border-b border-border/40">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              {doc.title}
            </h1>
            {locale === "fr" && (
              <p className="mt-3 text-sm text-yellow-500/80">
                Cette documentation est actuellement disponible en anglais
                seulement. La traduction française est prévue.
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <a
                href={`${REPO_DOC_BASE}/${doc.filename}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
              >
                {locale === "fr" ? "Voir sur GitHub" : "View on GitHub"}
                <ExternalLink className="h-3 w-3" />
              </a>
              <span>·</span>
              <a
                href={`${REPO_DOC_BASE.replace("blob", "edit")}/${doc.filename}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
              >
                {locale === "fr" ? "Modifier cette page" : "Edit this page"}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </header>

          <div
            className="prose prose-invert prose-zinc max-w-none prose-headings:tracking-tight prose-headings:font-semibold prose-h2:text-2xl prose-h2:mt-10 prose-h3:text-lg prose-h3:mt-6 prose-pre:bg-card prose-pre:border prose-pre:border-border/60 prose-code:before:content-none prose-code:after:content-none prose-code:bg-muted/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:font-normal prose-code:text-foreground prose-a:text-foreground prose-a:underline prose-a:underline-offset-4 hover:prose-a:text-foreground prose-table:text-sm prose-th:font-semibold prose-th:text-foreground prose-blockquote:border-l-foreground/30 prose-blockquote:text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: doc.html }}
          />
        </article>
      </div>
    </div>
  );
}
