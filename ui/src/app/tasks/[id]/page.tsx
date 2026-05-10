"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { use } from "react";

import { RequireProject } from "@/components/EmptyProject";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/lib/api";

export default function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <RequireProject>
      {(project) => <TaskDetail id={id} projectPath={project.root_path} />}
    </RequireProject>
  );
}

function TaskDetail({ id, projectPath }: { id: string; projectPath: string }) {
  const task = useQuery({ queryKey: ["task", id], queryFn: () => api.tasks.get(id) });
  const decisions = useQuery({
    queryKey: ["decisions", projectPath],
    queryFn: () => api.decisions.list(projectPath),
  });

  if (task.isLoading) {
    return <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>;
  }
  if (task.error) {
    return <p className="surface p-4 text-sm text-red-600">{(task.error as Error).message}</p>;
  }
  if (!task.data) return null;

  const t = task.data;
  const linked = (decisions.data ?? []).filter((d) => d.task_id === t.id);

  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-xs text-[hsl(var(--muted-foreground))]">
          {t.display_id}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <div className="flex items-center gap-2">
          <StatusBadge value={t.risk_level} />
          <StatusBadge value={t.status} />
        </div>
      </header>

      {t.description && (
        <section className="surface p-4 text-sm whitespace-pre-wrap">
          {t.description}
        </section>
      )}

      <section className="surface">
        <header className="border-b border-[hsl(var(--border))] px-4 py-3 text-sm font-medium">
          Decisions on this task
        </header>
        <ul className="divide-y divide-[hsl(var(--border))]">
          {linked.map((d) => (
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
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge value={d.risk_level} />
                  <StatusBadge value={d.status} />
                </div>
              </Link>
            </li>
          ))}
          {linked.length === 0 && (
            <li className="px-4 py-6 text-sm text-[hsl(var(--muted-foreground))]">
              No decisions linked to this task yet.
            </li>
          )}
        </ul>
      </section>
    </article>
  );
}
