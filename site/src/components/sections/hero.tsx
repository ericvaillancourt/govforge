import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/site/button-link";
import { TerminalCard } from "@/components/site/terminal-card";
import { GithubIcon } from "@/components/site/icons";
import { localePath, type Locale } from "@/lib/i18n";
import type { Dictionary } from "@/dictionaries";

interface HeroProps {
  dict: Dictionary["hero"];
  lang: Locale;
}

export function Hero({ dict, lang }: HeroProps) {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--muted)_0%,_transparent_60%)] opacity-50" />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-20 pb-24 sm:pt-32 sm:pb-32">
        <div className="max-w-3xl">
          <h1 className="font-sans text-5xl sm:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.05]">
            {dict.titleLine1}
            <br />
            <span className="text-muted-foreground">{dict.titleLine2}</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl leading-relaxed">
            {dict.subtitle}
          </p>
        </div>

        <div className="mt-10 max-w-xl">
          <TerminalCard command="curl -sSL https://govforge.dev/install.sh | sh" />
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <ButtonLink href={localePath(lang, "/docs/quickstart")} size="lg">
            {dict.ctaPrimary}
            <ArrowRight className="h-4 w-4" />
          </ButtonLink>
          <ButtonLink
            href="https://github.com/ericvaillancourt/govforge"
            variant="outline"
            size="lg"
          >
            <GithubIcon className="h-4 w-4" />
            {dict.ctaGithub}
          </ButtonLink>
          <a
            href={localePath(lang, "/docs")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
          >
            {dict.ctaDocs}
          </a>
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          {dict.trust.map((item) => (
            <span key={item} className="inline-flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
