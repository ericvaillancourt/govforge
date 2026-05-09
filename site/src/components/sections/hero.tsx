import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/site/button-link";
import { TerminalCard } from "@/components/site/terminal-card";
import { GithubIcon } from "@/components/site/icons";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--muted)_0%,_transparent_60%)] opacity-50" />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-20 pb-24 sm:pt-32 sm:pb-32">
        <div className="max-w-3xl">
          <h1 className="font-sans text-5xl sm:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.05]">
            Govern AI coding agents
            <br />
            <span className="text-muted-foreground">
              before they govern your codebase.
            </span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl leading-relaxed">
            Audit, review and control every code decision produced by Claude
            Code, Codex, Cursor and other AI coding agents.
          </p>
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
            <GithubIcon className="h-4 w-4" />
            View on GitHub
          </ButtonLink>
          <a
            href="/docs"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
          >
            Read the docs →
          </a>
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
            Open source
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
            Apache 2.0
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
            Self-hosted
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
            No telemetry
          </span>
        </div>
      </div>
    </section>
  );
}
