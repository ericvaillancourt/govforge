"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { RequireProject } from "@/components/EmptyProject";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/lib/api";

/**
 * Dashboard — four cards summarising the project's current backlog:
 *  - decisions awaiting review/approval
 *  - reviews still open
 *  - policy results that blocked recent decisions
 *  - active tasks (open / in-progress)
 *
 * Each card is a link to the corresponding list page so the cockpit's
 * standing rule "from the dashboard you reach every detail in <= 2 clicks"
 * holds.
 */
export default function DashboardPage() {
  return (
    <RequireProject>
      {(project) => <Dashboard projectPath={project.root_path} />}
    </RequireProject>
  );
}

function Dashboard({ projectPath }: { projectPath: string }) {
  const decisions = useQuery({
    queryKey: ["decisions", projectPath],
    queryFn: () => api.decisions.list(projectPath),
  });
  const tasks = useQuery({
    queryKey: ["tasks", projectPath],
    queryFn: () => api.tasks.list(projectPath),
  });
  const openReviews = useQuery({
    queryKey: ["reviews", projectPath, "open"],
    queryFn: () => api.reviews.list(projectPath, true),
  });

  const pendingDecisions = (decisions.data ?? []).filter((d) =>
    ["review_required", "changes_requested", "draft"].includes(d.status),
  );
  const activeTasks = (tasks.data ?? []).filter(
    (t) => t.status === "open" || t.status === "in_progress",
  );
  const reviews = openReviews.data ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashCard
          title="Pending decisions"
          count={pendingDecisions.length}
          href="/decisions"
          subtitle="awaiting review or approval"
        />
        <DashCard
          title="Open reviews"
          count={reviews.length}
          href="/reviews?open=1"
          subtitle="reviewer not done yet"
        />
        <DashCard
          title="Active tasks"
          count={activeTasks.length}
          href="/tasks"
          subtitle="open + in progress"
        />
        <DashCard
          title="All decisions"
          count={(decisions.data ?? []).length}
          href="/decisions"
          subtitle="full audit log"
        />
      </div>

      <section className="surface">
        <header className="border-b border-[hsl(var(--border))] px-4 py-3 text-sm font-medium">
          Recent decisions
        </header>
        <ul className="divide-y divide-[hsl(var(--border))]">
          {(decisions.data ?? []).slice(0, 8).map((d) => (
            <li key={d.id}>
              <Link
                href={`/decisions/${d.display_id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-[hsl(var(--muted))]"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-[hsl(var(--muted-foreground))]">
                    {d.display_id}
                  </span>
                  <span className="font-medium">{d.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge value={d.risk_level} />
                  <StatusBadge value={d.status} />
                </div>
              </Link>
            </li>
          ))}
          {(decisions.data ?? []).length === 0 && (
            <li className="px-4 py-6 text-sm text-[hsl(var(--muted-foreground))]">
              No decisions yet. Have an agent call <code className="font-mono">record_decision</code>{" "}
              via MCP, or use <code className="font-mono">gf decision create</code>.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}

function DashCard({
  title,
  count,
  href,
  subtitle,
}: {
  title: string;
  count: number;
  href: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="surface block p-4 transition-colors hover:bg-[hsl(var(--muted))]"
    >
      <div className="text-sm text-[hsl(var(--muted-foreground))]">{title}</div>
      <div className="mt-1 text-3xl font-semibold tabular-nums">{count}</div>
      <div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
        {subtitle}
      </div>
    </Link>
  );
}
