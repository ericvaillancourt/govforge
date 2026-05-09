import { ArrowRight, Play } from "lucide-react";
import { ButtonLink } from "@/components/site/button-link";

const STEPS = [
  {
    n: 1,
    title: "Claude modifies auth.py",
    lines: [
      { kind: "cmd", value: "gf task create --title \"Migrate auth to signed cookies\"" },
      { kind: "out", value: "TASK-001 created" },
      { kind: "blank" },
      { kind: "comment", value: "# Claude commits the change" },
      { kind: "cmd", value: "git commit -m \"refactor(auth): signed session cookies\"" },
      { kind: "blank" },
      { kind: "cmd", value: "gf git attach --decision DEC-001 --commit HEAD" },
    ],
  },
  {
    n: 2,
    title: "Policy engine flags the change",
    lines: [
      { kind: "cmd", value: "gf policy check --decision DEC-001" },
      { kind: "blank" },
      { kind: "warn", value: "⚠ BLOCKED  auth_change_requires_review" },
      { kind: "warn-detail", value: "          auth.py modified — review required" },
      { kind: "ok", value: "✓ PASSED   secret_pattern_detection" },
      { kind: "ok", value: "✓ PASSED   test_required_for_high_risk" },
    ],
  },
  {
    n: 3,
    title: "Codex reviews and disagrees",
    lines: [
      { kind: "cmd", value: "gf review request --decision DEC-001 --reviewer codex" },
      { kind: "blank" },
      { kind: "out", value: "📝 codex submitted REV-001 → changes_requested" },
      { kind: "out", value: "   high  security  middleware/session.py:42" },
      { kind: "out", value: "         Session token is not rotated after login." },
      { kind: "blank" },
      { kind: "warn", value: "⚡ Disagreement recorded:" },
      { kind: "out", value: "   Author:   signed cookies are sufficient" },
      { kind: "out", value: "   Reviewer: signed cookies do not prevent fixation" },
    ],
  },
  {
    n: 4,
    title: "Human approves after fix",
    lines: [
      { kind: "cmd", value: "gf approve DEC-001 --comment \"Approved after token rotation\"" },
      { kind: "blank" },
      { kind: "ok", value: "✓ DEC-001 approved by eric" },
      { kind: "ok", value: "✓ TASK-001 closed" },
      { kind: "blank" },
      { kind: "out", value: "Audit trail: 7 events, 1 commit, 1 review, 1 disagreement" },
    ],
  },
];

function lineClasses(kind: string) {
  switch (kind) {
    case "cmd":
      return "text-foreground";
    case "out":
      return "text-muted-foreground";
    case "comment":
      return "text-muted-foreground/60 italic";
    case "warn":
      return "text-yellow-500/90";
    case "warn-detail":
      return "text-yellow-500/60";
    case "ok":
      return "text-green-500/90";
    case "blank":
      return "h-4";
    default:
      return "text-muted-foreground";
  }
}

export function WorkflowDemo() {
  return (
    <section id="workflow" className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28">
      <div className="max-w-2xl">
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          How it works
        </h2>
        <p className="mt-3 text-lg text-muted-foreground">
          Four steps. Real CLI commands. Real audit trail at the end.
        </p>
      </div>

      <div className="mt-12 space-y-6">
        {STEPS.map((step) => (
          <div key={step.n} className="grid md:grid-cols-[auto_1fr] gap-4 md:gap-6 items-start">
            <div className="flex md:flex-col items-center md:items-start gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-card text-sm font-mono font-medium">
                {step.n}
              </span>
              <h3 className="text-base font-medium md:max-w-[8rem]">
                {step.title}
              </h3>
            </div>
            <div className="rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm overflow-hidden">
              <div className="px-4 py-3 font-mono text-sm">
                {step.lines.map((line, i) => {
                  if (line.kind === "blank") {
                    return <div key={i} className="h-4" aria-hidden="true" />;
                  }
                  if (line.kind === "cmd") {
                    return (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-muted-foreground select-none" aria-hidden="true">
                          $
                        </span>
                        <span className={lineClasses(line.kind)}>{line.value}</span>
                      </div>
                    );
                  }
                  return (
                    <div key={i} className={`${lineClasses(line.kind)} pl-4`}>
                      {line.value}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <ButtonLink href="/docs/workflow">
          See the full workflow
          <ArrowRight className="h-4 w-4" />
        </ButtonLink>
        <ButtonLink href="/demo" variant="outline">
          <Play className="h-4 w-4" />
          Watch 90s demo
        </ButtonLink>
      </div>
    </section>
  );
}
