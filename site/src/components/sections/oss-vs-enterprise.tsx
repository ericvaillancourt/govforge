import { ArrowRight, Building2, Package } from "lucide-react";
import { ButtonLink } from "@/components/site/button-link";
import { localePath, type Locale } from "@/lib/i18n";
import type { Dictionary } from "@/dictionaries";

interface OssVsEnterpriseProps {
  dict: Dictionary["ossVsEnterprise"];
  lang: Locale;
}

export function OssVsEnterprise({ dict, lang }: OssVsEnterpriseProps) {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28">
      <div className="max-w-2xl">
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          {dict.heading}
        </h2>
      </div>

      <div className="mt-12 grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border/60 bg-card p-8">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50 border border-border/40">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">{dict.ossLabel}</h3>
              <p className="text-xs text-muted-foreground">{dict.ossSubtitle}</p>
            </div>
          </div>
          <ul className="mt-6 space-y-2.5">
            {dict.ossItems.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm">
                <span className="text-foreground" aria-hidden="true">
                  ✓
                </span>
                <span className="text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <ButtonLink
              href={localePath(lang, "/docs/quickstart")}
              variant="outline"
              className="w-full sm:w-auto"
            >
              {dict.ossCta}
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
          </div>
        </div>

        <div className="rounded-xl border border-foreground/30 bg-card p-8 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-foreground/10 border border-foreground/20">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">{dict.enterpriseLabel}</h3>
              <p className="text-xs text-muted-foreground">
                {dict.enterpriseSubtitle}
              </p>
            </div>
          </div>
          <p className="mt-6 text-xs uppercase tracking-wider text-muted-foreground">
            {dict.enterpriseEverythingPlus}
          </p>
          <ul className="mt-3 space-y-2.5">
            {dict.enterpriseItems.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm">
                <span className="text-foreground" aria-hidden="true">
                  ✓
                </span>
                <span className="text-foreground">{item}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <ButtonLink
              href="mailto:eric.vaillancourt@talsom.com?subject=GovForge%20Enterprise"
              className="w-full sm:w-auto"
            >
              {dict.enterpriseCta}
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
