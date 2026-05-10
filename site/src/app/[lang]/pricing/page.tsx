import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/site/button-link";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { getDictionary } from "@/dictionaries";
import { isLocale, localePath, type Locale } from "@/lib/i18n";

type CtaVariant = "default" | "outline";

export async function generateMetadata(
  { params }: { params: Promise<{ lang: string }> },
): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    metadataBase: new URL("https://govforge.dev"),
    title: dict.pricing.metaTitle,
    description: dict.pricing.metaDescription,
    alternates: {
      canonical: `/${lang}/pricing/`,
      languages: {
        en: "/en/pricing/",
        fr: "/fr/pricing/",
        "x-default": "/en/pricing/",
      },
    },
  };
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const locale = lang as Locale;
  const dict = (await getDictionary(locale)).pricing;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28">
      <div className="max-w-2xl">
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
          {dict.heading}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">{dict.subheading}</p>
      </div>

      <div className="mt-12 grid md:grid-cols-3 gap-4">
        {dict.tiers.map((tier) => {
          const variant = tier.ctaVariant as CtaVariant;
          const href = tier.ctaHref.startsWith("mailto:")
            ? tier.ctaHref
            : localePath(locale, tier.ctaHref);
          return (
            <div
              key={tier.name}
              className={`rounded-xl border p-8 flex flex-col ${
                tier.highlighted
                  ? "border-foreground/30 bg-card shadow-sm"
                  : "border-border/60 bg-card"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{tier.name}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {tier.description}
                  </p>
                </div>
                {tier.badge ? (
                  <Badge variant="secondary">{tier.badge}</Badge>
                ) : null}
              </div>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="text-4xl font-semibold tracking-tight">
                  {tier.price}
                </span>
                <span className="text-sm text-muted-foreground">
                  {tier.period}
                </span>
              </div>
              <ul className="mt-6 space-y-2.5 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <span className="text-foreground" aria-hidden="true">
                      ✓
                    </span>
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <ButtonLink
                  href={href}
                  variant={variant}
                  className="w-full"
                >
                  {tier.ctaLabel}
                  <ArrowRight className="h-4 w-4" />
                </ButtonLink>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        {dict.noLockIn}
      </p>

      <div className="mt-24">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          {dict.faqHeading}
        </h2>
        <Accordion className="mt-6 max-w-3xl">
          {dict.faq.map((item, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-left">{item.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}
