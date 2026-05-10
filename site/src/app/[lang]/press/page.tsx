import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Download, ExternalLink, Mail } from "lucide-react";
import { ButtonLink } from "@/components/site/button-link";
import { CopyButton } from "@/components/site/copy-button";
import { getDictionary } from "@/dictionaries";
import { isLocale, type Locale } from "@/lib/i18n";

export async function generateMetadata(
  { params }: { params: Promise<{ lang: string }> },
): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = (await getDictionary(lang)).press;
  return {
    title: dict.metaTitle,
    description: dict.metaDescription,
    alternates: {
      canonical: `/${lang}/press/`,
      languages: {
        en: "/en/press/",
        fr: "/fr/press/",
        "x-default": "/en/press/",
      },
    },
  };
}

export default async function PressPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const locale = lang as Locale;
  const dict = (await getDictionary(locale)).press;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-20 sm:py-28">
      <div className="max-w-2xl">
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
          {dict.heading}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">{dict.subheading}</p>
      </div>

      {/* Quick facts */}
      <section className="mt-12 grid sm:grid-cols-2 gap-3 sm:gap-4">
        {dict.facts.map((fact) => (
          <div
            key={fact.label}
            className="rounded-xl border border-border/60 bg-card p-5"
          >
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {fact.label}
            </div>
            <div className="mt-2 text-base">{fact.value}</div>
          </div>
        ))}
      </section>

      {/* Boilerplate */}
      <section className="mt-16">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          {dict.boilerplate.heading}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {dict.boilerplate.subheading}
        </p>
        <div className="mt-6 space-y-6">
          {dict.boilerplate.entries.map((entry) => (
            <div
              key={entry.length}
              className="rounded-xl border border-border/60 bg-card p-6"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium">{entry.length}</div>
                <CopyButton value={entry.text} />
              </div>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                {entry.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Logo & marks */}
      <section className="mt-16">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          {dict.assets.heading}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {dict.assets.subheading}
        </p>
        <div className="mt-6 grid sm:grid-cols-3 gap-4">
          {dict.assets.items.map((asset) => (
            <div
              key={asset.file}
              className="rounded-xl border border-border/60 bg-card p-6 flex flex-col"
            >
              <div className="flex h-32 items-center justify-center rounded-lg bg-muted/30">
                <Image
                  src={`/brand/${asset.file}`}
                  alt={asset.alt}
                  width={asset.width}
                  height={asset.height}
                  className="text-foreground"
                />
              </div>
              <div className="mt-4 text-sm font-medium">{asset.name}</div>
              <p className="mt-1 text-xs text-muted-foreground flex-1">
                {asset.description}
              </p>
              <a
                href={`/brand/${asset.file}`}
                download
                className="mt-4 inline-flex items-center gap-1.5 text-sm underline underline-offset-4 hover:text-foreground"
              >
                <Download className="h-3.5 w-3.5" />
                {dict.assets.downloadLabel}
              </a>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          {dict.assets.note}
        </p>
      </section>

      {/* Brand do/don't */}
      <section className="mt-16 grid sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border/60 bg-card p-6">
          <h3 className="text-base font-semibold">{dict.dos.heading}</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {dict.dos.items.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-foreground" aria-hidden="true">
                  ✓
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-6">
          <h3 className="text-base font-semibold">{dict.donts.heading}</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {dict.donts.items.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-foreground" aria-hidden="true">
                  ✗
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Screenshots */}
      <section className="mt-16">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          {dict.screenshots.heading}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {dict.screenshots.subheading}
        </p>
        <div className="mt-6 grid sm:grid-cols-2 gap-4">
          {dict.screenshots.items.map((shot) => (
            <div
              key={shot.label}
              className="rounded-xl border border-border/60 bg-card overflow-hidden"
            >
              <div className="aspect-[16/9] bg-muted/30 flex items-center justify-center text-xs text-muted-foreground border-b border-border/60">
                {shot.placeholderHint}
              </div>
              <div className="p-4">
                <div className="text-sm font-medium">{shot.label}</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {shot.description}
                </p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          {dict.screenshots.note}
        </p>
      </section>

      {/* Founder */}
      <section className="mt-16">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          {dict.founder.heading}
        </h2>
        <div className="mt-6 rounded-xl border border-border/60 bg-card p-6">
          <div className="text-sm font-medium">{dict.founder.name}</div>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            {dict.founder.bio}
          </p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {dict.founder.links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                target={link.href.startsWith("http") ? "_blank" : undefined}
                rel={
                  link.href.startsWith("http") ? "noopener noreferrer" : undefined
                }
                className="inline-flex items-center gap-1.5 underline underline-offset-4 hover:text-foreground"
              >
                {link.label}
                {link.href.startsWith("http") ? (
                  <ExternalLink className="h-3.5 w-3.5" />
                ) : null}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="mt-16 rounded-xl border border-border/60 bg-card p-8">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          {dict.contact.heading}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {dict.contact.subheading}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink
            href={`mailto:${dict.contact.email}?subject=Press%20inquiry%20—%20GovForge`}
            variant="default"
          >
            <Mail className="h-4 w-4" />
            {dict.contact.emailLabel}
          </ButtonLink>
          <ButtonLink
            href="https://github.com/ericvaillancourt/govforge"
            variant="outline"
          >
            {dict.contact.githubLabel}
            <ArrowRight className="h-4 w-4" />
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
