import { ArrowRight, Star } from "lucide-react";
import { ButtonLink } from "@/components/site/button-link";
import { TerminalCard } from "@/components/site/terminal-card";
import { localePath, type Locale } from "@/lib/i18n";
import type { Dictionary } from "@/dictionaries";

interface FinalCtaProps {
  dict: Dictionary["finalCta"];
  lang: Locale;
}

export function FinalCta({ dict, lang }: FinalCtaProps) {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 py-24 sm:py-32">
      <div className="max-w-3xl">
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.05]">
          {dict.titleLine1}
          <br />
          <span className="text-muted-foreground">{dict.titleLine2}</span>
        </h2>
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
          <Star className="h-4 w-4" />
          {dict.ctaGithub}
        </ButtonLink>
      </div>
    </section>
  );
}
