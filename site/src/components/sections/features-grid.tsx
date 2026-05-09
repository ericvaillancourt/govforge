import {
  ScrollText,
  Scale,
  Shield,
  Handshake,
  CircleCheck,
  Search,
} from "lucide-react";

const FEATURES = [
  {
    icon: ScrollText,
    title: "Decision Records",
    description:
      "Every code change becomes a structured decision: author, intent, rationale, risk, status.",
  },
  {
    icon: Scale,
    title: "Policy Engine",
    description:
      "Block changes that touch auth, secrets, or schema without explicit review and approval.",
  },
  {
    icon: Shield,
    title: "Audit Timeline",
    description:
      "Append-only event log linked to every commit, review, finding, and approval.",
  },
  {
    icon: Handshake,
    title: "Structured Disagreement",
    description:
      "Capture conflicts between agents as first-class artifacts — not buried in chat history.",
  },
  {
    icon: CircleCheck,
    title: "Human Approval",
    description:
      "High-risk diffs require a human signature. With full context, not blind rubber-stamping.",
  },
  {
    icon: Search,
    title: "Git-aware Reviews",
    description:
      "Reviews from another agent attached to lines, files, and commits. Findings, not opinions.",
  },
];

export function FeaturesGrid() {
  return (
    <section id="features" className="border-t border-border/40 bg-muted/20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28">
        <div className="max-w-2xl">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            What GovForge gives you
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            Not another agent. The infrastructure to govern the ones you already use.
          </p>
        </div>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="group rounded-xl border border-border/60 bg-card p-6 hover:border-border transition-colors"
            >
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50 border border-border/40">
                <Icon className="h-5 w-5 text-foreground" />
              </div>
              <h3 className="mt-4 text-base font-semibold tracking-tight">
                {title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
