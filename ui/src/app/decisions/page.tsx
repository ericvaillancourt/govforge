"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { RequireProject } from "@/components/EmptyProject";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/lib/api";

export default function DecisionsListPage() {
  return (
    <RequireProject>
      {(project) => <DecisionsList projectPath={project.root_path} />}
    </RequireProject>
  );
}

function DecisionsList({ projectPath }: { projectPath: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["decisions", projectPath],
    queryFn: () => api.decisions.list(projectPath),
  });

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Decisions</h1>
      {isLoading && <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>}
      {error && (
        <p className="surface p-4 text-sm text-red-600">{(error as Error).message}</p>
      )}
      <ul className="surface divide-y divide-[hsl(var(--border))]">
        {(data ?? []).map((d) => (
          <li key={d.id}>
            <Link
              href={`/decisions/${d.display_id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-[hsl(var(--muted))]"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-[hsl(var(--muted-foreground))]">
                  {d.display_id}
                </span>
                <span>{d.title}</span>
                {d.human_approval_required && (
                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">
                    human approval
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge value={d.risk_level} />
                <StatusBadge value={d.status} />
              </div>
            </Link>
          </li>
        ))}
        {data && data.length === 0 && (
          <li className="px-4 py-6 text-sm text-[hsl(var(--muted-foreground))]">
            No decisions yet.
          </li>
        )}
      </ul>
    </section>
  );
}
