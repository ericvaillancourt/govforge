"use client";

import { useState } from "react";
import { Check, Clock } from "lucide-react";

import { TerminalCard } from "@/components/site/terminal-card";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/dictionaries";

interface InstallSectionProps {
  dict: Dictionary["install"];
}

/**
 * Section "Install": tabs for source / Homebrew / pipx / pre-built. Each
 * tab shows the install command in a TerminalCard, plus an honest
 * "available today" / "Phase 2" status pill so we don't promise channels
 * that don't ship yet.
 */
export function InstallSection({ dict }: InstallSectionProps) {
  const [active, setActive] = useState(dict.tabs[0]?.id ?? "source");
  const tab = dict.tabs.find((t) => t.id === active) ?? dict.tabs[0];

  return (
    <section id="install" className="border-t border-border/40">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-24">
        <div className="max-w-2xl">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            {dict.heading}
          </h2>
          <p className="mt-3 text-base sm:text-lg text-muted-foreground">
            {dict.subheading}
          </p>
        </div>

        <div className="mt-10">
          <div role="tablist" className="flex flex-wrap gap-2">
            {dict.tabs.map((t) => {
              const isActive = t.id === active;
              const isAvailable = t.status === "available";
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={isActive}
                  type="button"
                  onClick={() => setActive(t.id)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "border-foreground bg-foreground text-background"
                      : "border-border/60 bg-card hover:bg-muted",
                  )}
                >
                  {isAvailable ? (
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {t.label}
                </button>
              );
            })}
          </div>

          {tab ? (
            <div className="mt-6 grid gap-4">
              <div
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-1 text-xs font-medium w-fit",
                  tab.status === "available"
                    ? "bg-green-500/10 text-green-700 dark:text-green-400"
                    : "bg-amber-500/10 text-amber-700 dark:text-amber-400",
                )}
              >
                {tab.status === "available" ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Clock className="h-3.5 w-3.5" />
                )}
                {tab.statusLabel}
              </div>

              <TerminalCard caption={tab.caption} command={tab.command} />

              {tab.note ? (
                <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
                  {tab.note}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
