import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/site/button-link";
import { GithubIcon } from "@/components/site/icons";
import { getDictionary } from "@/dictionaries";
import { isLocale, type Locale } from "@/lib/i18n";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.govforge.dev";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = (await getDictionary(lang)).login;
  return {
    metadataBase: new URL("https://govforge.dev"),
    title: dict.metaTitle,
    description: dict.metaDescription,
    alternates: {
      canonical: `/${lang}/login/`,
      languages: {
        en: "/en/login/",
        fr: "/fr/login/",
        "x-default": "/en/login/",
      },
    },
  };
}

export default async function LoginPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = (await getDictionary(lang as Locale)).login;

  return (
    <main className="mx-auto max-w-md px-4 sm:px-6 py-16 sm:py-24">
      <header>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          {dict.heading}
        </h1>
        <p className="mt-3 text-base text-muted-foreground leading-relaxed">
          {dict.subheading}
        </p>
      </header>

      <div className="mt-8 space-y-3">
        <ButtonLink
          href={`${API_BASE}/auth/github/start`}
          external
          size="lg"
          className="w-full justify-center"
        >
          <GithubIcon className="h-4 w-4" />
          {dict.github}
          <ArrowRight className="h-4 w-4" />
        </ButtonLink>

        <button
          type="button"
          disabled
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-border/40 bg-card/40 px-4 py-2.5 text-sm text-muted-foreground/60 cursor-not-allowed"
        >
          {dict.googleComingSoon}
        </button>
        <button
          type="button"
          disabled
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-border/40 bg-card/40 px-4 py-2.5 text-sm text-muted-foreground/60 cursor-not-allowed"
        >
          {dict.magicComingSoon}
        </button>
      </div>

      <p className="mt-8 text-xs text-muted-foreground leading-relaxed">
        {dict.tos}
      </p>
    </main>
  );
}
