import {
  CheckCircle2,
  Circle,
  FileEdit,
  GitCommit,
  MessageSquare,
  ShieldCheck,
  Stamp,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/cn";
import type { Event } from "@/lib/api";

const ICONS: Record<string, LucideIcon> = {
  "decision.created": FileEdit,
  "decision.git_attached": GitCommit,
  "decision.policy_evaluated": ShieldCheck,
  "decision.status_changed": Circle,
  "decision.approved": CheckCircle2,
  "decision.rejected": XCircle,
  "decision.needs_changes": Circle,
  "review.requested": MessageSquare,
  "review.submitted": MessageSquare,
  "disagreement.recorded": Stamp,
  "disagreement.resolved": Stamp,
};

const TONE: Record<string, string> = {
  "decision.approved": "text-green-600",
  "decision.rejected": "text-red-600",
  "decision.needs_changes": "text-amber-600",
  "decision.policy_evaluated": "text-amber-600",
};

/**
 * Vertical event timeline. The list is ordered by `created_at` (the API
 * returns it sorted ascending) and falls back to a generic icon for
 * unknown event types so a future backend addition still renders.
 */
export function Timeline({ events }: { events: Event[] }) {
  if (events.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-[hsl(var(--muted-foreground))]">
        No events yet.
      </p>
    );
  }
  return (
    <ol className="relative ml-3 space-y-3 border-l border-[hsl(var(--border))] pl-4 py-2">
      {events.map((e) => {
        const Icon = ICONS[e.event_type] ?? Circle;
        const tone = TONE[e.event_type] ?? "text-[hsl(var(--muted-foreground))]";
        return (
          <li key={e.id} className="relative">
            <span
              className={cn(
                "absolute -left-[1.45rem] top-0 flex h-5 w-5 items-center justify-center rounded-full bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]",
                tone,
              )}
            >
              <Icon className="h-3 w-3" />
            </span>
            <div className="text-sm">
              <span className="font-medium">{e.event_type}</span>{" "}
              <span className="text-[hsl(var(--muted-foreground))]">
                · {new Date(e.created_at).toLocaleString()}
              </span>
            </div>
            {e.payload_json && Object.keys(e.payload_json).length > 0 && (
              <pre className="surface-muted mt-1 overflow-x-auto px-3 py-2 text-xs">
                {JSON.stringify(e.payload_json, null, 2)}
              </pre>
            )}
          </li>
        );
      })}
    </ol>
  );
}
