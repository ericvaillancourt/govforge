"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { RequireProject } from "@/components/EmptyProject";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/lib/api";

export default function TasksListPage() {
  return (
    <RequireProject>
      {(project) => <TasksList projectPath={project.root_path} />}
    </RequireProject>
  );
}

function TasksList({ projectPath }: { projectPath: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["tasks", projectPath],
    queryFn: () => api.tasks.list(projectPath),
  });

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
      {isLoading && <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>}
      {error && (
        <p className="surface p-4 text-sm text-red-600">{(error as Error).message}</p>
      )}
      <ul className="surface divide-y divide-[hsl(var(--border))]">
        {(data ?? []).map((t) => (
          <li key={t.id}>
            <Link
              href={`/tasks/${t.display_id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-[hsl(var(--muted))]"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-[hsl(var(--muted-foreground))]">
                  {t.display_id}
                </span>
                <span>{t.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge value={t.risk_level} />
                <StatusBadge value={t.status} />
              </div>
            </Link>
          </li>
        ))}
        {data && data.length === 0 && (
          <li className="px-4 py-6 text-sm text-[hsl(var(--muted-foreground))]">
            No tasks yet.
          </li>
        )}
      </ul>
    </section>
  );
}
