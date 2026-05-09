import { Check, X } from "lucide-react";

const WITHOUT = [
  "Decisions are implicit",
  "Reviews are inconsistent",
  "Risks slip through",
  "Audit trails don't exist",
  "Disagreements are lost",
  "Humans rubber-stamp",
];

const WITH = [
  "Every decision recorded",
  "Reviews are structured",
  "Policies catch them",
  "Git-aware audit timeline",
  "Disagreements are explicit",
  "Humans approve with context",
];

export function ProblemStatement() {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28">
      <div className="max-w-3xl">
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          AI agents now write production code.
        </h2>
        <p className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-muted-foreground">
          Most teams have no idea what they decided, or why.
        </p>
      </div>
      <div className="mt-10 grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border/60 bg-card p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-red-500/80 mb-4">
            Without GovForge
          </h3>
          <ul className="space-y-2.5">
            {WITHOUT.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm">
                <X className="h-4 w-4 mt-0.5 shrink-0 text-red-500/70" />
                <span className="text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-green-500/80 mb-4">
            With GovForge
          </h3>
          <ul className="space-y-2.5">
            {WITH.map((item) => (
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
