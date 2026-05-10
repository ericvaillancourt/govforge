"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { use } from "react";

import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/lib/api";

export default function ReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, isLoading, error } = useQuery({
    queryKey: ["review", id],
    queryFn: () => api.reviews.get(id),
  });

  if (isLoading) {
    return <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>;
  }
  if (error) {
    return (
      <p className="surface p-4 text-sm text-red-600">
        {(error as Error).message}
      </p>
    );
  }
  if (!data) return null;

  const r = data;
  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-xs text-[hsl(var(--muted-foreground))]">
          {r.display_id}
        </p>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {r.summary ?? "(no summary)"}
          </h1>
          <StatusBadge value={r.status} />
        </div>
        <Link
          href={`/decisions/${r.decision_id}`}
          className="text-xs text-[hsl(var(--primary))] hover:underline"
        >
          ← linked decision
        </Link>
      </header>

      <section className="surface">
        <header className="border-b border-[hsl(var(--border))] px-4 py-3 text-sm font-medium">
          Findings ({r.findings.length})
        </header>
        <ul className="divide-y divide-[hsl(var(--border))]">
          {r.findings.map((f) => (
            <li key={f.id} className="space-y-1 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge value={f.severity} />
                <span className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  {f.category}
                </span>
                {f.file_path && (
                  <span className="font-mono text-xs">
                    {f.file_path}
                    {f.line_start ? `:${f.line_start}` : ""}
                    {f.line_end && f.line_end !== f.line_start ? `-${f.line_end}` : ""}
                  </span>
                )}
              </div>
              <p className="text-sm">{f.message}</p>
              {f.recommendation && (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  ↳ {f.recommendation}
                </p>
              )}
            </li>
          ))}
          {r.findings.length === 0 && (
            <li className="px-4 py-6 text-sm text-[hsl(var(--muted-foreground))]">
              This review has no structured findings.
            </li>
          )}
        </ul>
      </section>
    </article>
  );
}
