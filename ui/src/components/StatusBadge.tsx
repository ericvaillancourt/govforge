import { cn } from "@/lib/cn";

const KIND: Record<string, string> = {
  // Decision / task statuses
  draft: "bg-slate-200 text-slate-800",
  open: "bg-slate-200 text-slate-800",
  in_progress: "bg-blue-100 text-blue-800",
  review_required: "bg-amber-100 text-amber-800",
  changes_requested: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  closed: "bg-slate-100 text-slate-600",
  // Risk levels
  low: "bg-slate-100 text-slate-700",
  medium: "bg-blue-100 text-blue-800",
  high: "bg-amber-100 text-amber-800",
  critical: "bg-red-100 text-red-800",
  // Policy results
  passed: "bg-green-100 text-green-800",
  warning: "bg-amber-100 text-amber-800",
  blocked: "bg-red-100 text-red-800",
  // Severities
  info: "bg-slate-100 text-slate-600",
};

/** Pill-shaped status indicator. Falls back to a neutral style on unknown kinds. */
export function StatusBadge({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const variant = KIND[value.toLowerCase()] ?? "bg-slate-100 text-slate-700";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        variant,
        className,
      )}
    >
      {value}
    </span>
  );
}
