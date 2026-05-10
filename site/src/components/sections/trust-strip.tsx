import { Lock, FileText, ShieldOff, Network, type LucideIcon } from "lucide-react";
import type { Dictionary } from "@/dictionaries";

const ICONS: Record<string, LucideIcon> = {
  Lock,
  FileText,
  ShieldOff,
  Network,
};

interface TrustStripProps {
  dict: Dictionary["trustStrip"];
}

export function TrustStrip({ dict }: TrustStripProps) {
  return (
    <section className="border-t border-border/40 bg-muted/20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
        <div className="max-w-2xl">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            {dict.heading}
          </h2>
        </div>
        <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {dict.items.map((item) => {
            const Icon = ICONS[item.icon] ?? Lock;
            return (
              <div
                key={item.title}
                className="rounded-xl border border-border/60 bg-card p-5"
              >
                <Icon className="h-5 w-5 text-muted-foreground" />
                <h3 className="mt-3 text-sm font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground leading-snug">
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
