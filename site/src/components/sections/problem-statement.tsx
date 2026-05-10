import { Check, X } from "lucide-react";
import type { Dictionary } from "@/dictionaries";

interface ProblemStatementProps {
  dict: Dictionary["problemStatement"];
}

export function ProblemStatement({ dict }: ProblemStatementProps) {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28">
      <div className="max-w-3xl">
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          {dict.title}
        </h2>
        <p className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-muted-foreground">
          {dict.subtitle}
        </p>
      </div>
      <div className="mt-10 grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border/60 bg-card p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-red-500/80 mb-4">
            {dict.withoutHeading}
          </h3>
          <ul className="space-y-2.5">
            {dict.withoutItems.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm">
                <X className="h-4 w-4 mt-0.5 shrink-0 text-red-500/70" />
                <span className="text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-green-500/80 mb-4">
            {dict.withHeading}
          </h3>
          <ul className="space-y-2.5">
            {dict.withItems.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm">
                <Check className="h-4 w-4 mt-0.5 shrink-0 text-green-500/70" />
                <span className="text-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
