import { ArrowRight, Star } from "lucide-react";
import { ButtonLink } from "@/components/site/button-link";
import { TerminalCard } from "@/components/site/terminal-card";

export function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 py-24 sm:py-32">
      <div className="max-w-3xl">
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.05]">
          Stop trusting AI agents on faith.
          <br />
          <span className="text-muted-foreground">Start governing them.</span>
        </h2>
      </div>
      <div className="mt-10 max-w-xl">
        <TerminalCard command="curl -sSL https://govforge.dev/install.sh | sh" />
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <ButtonLink href="/docs/quickstart" size="lg">
          Get started
          <ArrowRight className="h-4 w-4" />
        </ButtonLink>
        <ButtonLink
          href="https://github.com/govforge/govforge"
          variant="outline"
          size="lg"
        >
          <Star className="h-4 w-4" />
          Star on GitHub
        </ButtonLink>
      </div>
    </section>
  );
}
