import { Lock, FileText, ShieldOff, Network } from "lucide-react";

const ITEMS = [
  {
    icon: Lock,
    title: "Local-first",
    desc: "Your code never leaves your machine.",
  },
  {
    icon: FileText,
    title: "Apache 2.0",
    desc: "Permissive, enterprise-friendly license.",
  },
  {
    icon: ShieldOff,
    title: "No telemetry",
    desc: "Zero phone-home. Verify on GitHub.",
  },
  {
    icon: Network,
    title: "Air-gapped ready",
    desc: "Deployment in isolated networks.",
  },
];

export function TrustStrip() {
  return (
    <section className="border-t border-border/40 bg-muted/20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
        <div className="max-w-2xl">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Built for code that actually matters.
          </h2>
        </div>
        <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {ITEMS.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-xl border border-border/60 bg-card p-5"
            >
              <Icon className="h-5 w-5 text-muted-foreground" />
              <h3 className="mt-3 text-sm font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground leading-snug">
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
