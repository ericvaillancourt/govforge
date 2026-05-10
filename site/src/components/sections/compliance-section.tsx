import {
  ArrowRight,
  CircleCheck,
  FileLock,
  GitBranch,
  Lock,
  ScrollText,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

import { ButtonLink } from "@/components/site/button-link";
import type { Dictionary } from "@/dictionaries";

interface ComplianceSectionProps {
  dict: Dictionary["compliance"];
}

/**
 * Section "Security & Compliance". Goes deeper than the TrustStrip — six
 * concrete guarantees, each tied (in the copy) to either a code path or a
 * test that pins it. Ends with a CTA to the threat model on GitHub so a
 * skeptical reader can verify the claims line-by-line.
 */
const ICONS: LucideIcon[] = [Lock, GitBranch, ShieldCheck, ScrollText, FileLock, CircleCheck];

export function ComplianceSection({ dict }: ComplianceSectionProps) {
  return (
    <section id="security" className="border-t border-border/40 bg-muted/20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-24">
        <div className="max-w-3xl">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            {dict.heading}
          </h2>
          <p className="mt-3 text-base sm:text-lg text-muted-foreground">
            {dict.subheading}
          </p>
        </div>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dict.guarantees.map((g, i) => {
            const Icon = ICONS[i % ICONS.length] ?? Lock;
            return (
              <li
                key={g.title}
                className="rounded-xl border border-border/60 bg-card p-6 transition-colors hover:border-border"
              >
                <Icon className="h-5 w-5 text-foreground" aria-hidden="true" />
                <h3 className="mt-4 text-base font-semibold tracking-tight">
                  {g.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {g.desc}
                </p>
              </li>
            );
          })}
        </ul>

        <div className="mt-10">
          <ButtonLink
            href={dict.ctaHref}
            variant="outline"
            external
            className="gap-2"
          >
            {dict.ctaLabel}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
