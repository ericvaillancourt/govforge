import {
  ScrollText,
  Scale,
  Shield,
  Handshake,
  CircleCheck,
  Search,
  type LucideIcon,
} from "lucide-react";
import type { Dictionary } from "@/dictionaries";

const ICONS: Record<string, LucideIcon> = {
  ScrollText,
  Scale,
  Shield,
  Handshake,
  CircleCheck,
  Search,
};

interface FeaturesGridProps {
  dict: Dictionary["features"];
}

export function FeaturesGrid({ dict }: FeaturesGridProps) {
  return (
    <section id="features" className="border-t border-border/40 bg-muted/20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28">
        <div className="max-w-2xl">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            {dict.heading}
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">{dict.subheading}</p>
        </div>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {dict.cards.map((card) => {
            const Icon = ICONS[card.icon] ?? Shield;
            return (
              <div
                key={card.title}
                className="group rounded-xl border border-border/60 bg-card p-6 hover:border-border transition-colors"
              >
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50 border border-border/40">
                  <Icon className="h-5 w-5 text-foreground" />
                </div>
                <h3 className="mt-4 text-base font-semibold tracking-tight">
                  {card.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {card.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
