"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { use } from "react";

import { ApprovalActions } from "@/components/ApprovalActions";
import { StatusBadge } from "@/components/StatusBadge";
import { Timeline } from "@/components/Timeline";
import { api, type Event, type Review } from "@/lib/api";
import { useCurrentProject } from "@/lib/project";

/**
 * Decision Detail — the most important page in the cockpit. Shows everything
 * a human needs to make the final approve/reject call:
 *  - title, summary, rationale, risk, status
 *  - linked git commit + files changed
 *  - policy results (passed / warning / blocked)
 *  - reviews + their findings
 *  - approval action buttons
 *  - chronological event timeline
 *
 * Phase 1 trade-off: we don't display the full diff text — the backend
 * stores the commit hash + files list + insertion/deletion counts only.
 * The "Diff Viewer" component listed in TODO § I is therefore reduced to
 * a "Files changed" panel; raw diff rendering is Phase 3+.
 */
export default function DecisionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { project, loaded } = useCurrentProject();
  const projectPath = project?.root_path ?? "";

  const decision = useQuery({
    queryKey: ["decision", id],
    queryFn: () => api.decisions.get(id),
  });
  const timeline = useQuery({
    queryKey: ["timeline", id],
    queryFn: () => api.decisions.timeline(id),
  });
  const reviews = useQuery({
    queryKey: ["reviews", projectPath],
    queryFn: () => api.reviews.list(projectPath),
    enabled: !!projectPath,
  });

  if (!loaded || decision.isLoading) {
    return <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>;
  }
  if (decision.error) {
    return (
      <p className="surface p-4 text-sm text-red-600">
        {(decision.error as Error).message}
      </p>
    );
  }
  if (!decision.data) return null;

  const d = decision.data;
  const decisionReviews =
    reviews.data?.filter((r) => r.decision_id === d.id) ?? [];

  // Pull git_change details out of the timeline payload — the /decisions/{id}
  // route doesn't embed it, but `decision.git_attached` events do.
  const gitEvent = (timeline.data ?? []).find(
    (e) => e.event_type === "decision.git_attached",
  );
  const gitInfo = gitEvent?.payload_json as Record<string, unknown> | undefined;

  return (
    <article className="space-y-6">
      <DecisionHeader decision={d} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {(d.summary || d.rationale) && (
            <section className="surface space-y-4 p-4">
              {d.summary && (
                <div>
                  <h2 className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
                    Summary
                  </h2>
                  <p className="mt-1 whitespace-pre-wrap">{d.summary}</p>
                </div>
              )}
              {d.rationale && (
                <div>
                  <h2 className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
                    Rationale
                  </h2>
                  <p className="mt-1 whitespace-pre-wrap">{d.rationale}</p>
                </div>
              )}
            </section>
          )}

          <GitChangePanel info={gitInfo} />
          <PolicyPanel events={timeline.data ?? []} />
          <ReviewsPanel reviews={decisionReviews} />
          <ApprovalActions decisionId={d.display_id} status={d.status} />
        </div>

        <aside className="surface p-4">
          <h2 className="text-sm font-medium">Timeline</h2>
          <div className="mt-3">
            <Timeline events={timeline.data ?? []} />
          </div>
        </aside>
      </div>
    </article>
  );
}

function DecisionHeader({
  decision,
}: {
  decision: ReturnType<typeof api.decisions.get> extends Promise<infer T>
    ? T
    : never;
}) {
  return (
    <header className="space-y-2">
      <p className="font-mono text-xs text-[hsl(var(--muted-foreground))]">
        {decision.display_id}
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">{decision.title}</h1>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge value={decision.risk_level} />
        <StatusBadge value={decision.status} />
        {decision.human_approval_required && (
          <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
            human approval required
          </span>
        )}
        {decision.task_id && (
          <Link
            href={`/tasks/${decision.task_id}`}
            className="text-xs text-[hsl(var(--primary))] hover:underline"
          >
            ← linked task
          </Link>
        )}
      </div>
    </header>
  );
}

function GitChangePanel({
  info,
}: {
  info: Record<string, unknown> | undefined;
}) {
  if (!info) {
    return (
      <section className="surface p-4 text-sm text-[hsl(var(--muted-foreground))]">
        No git change attached. Have an agent call{" "}
        <code className="font-mono">attach_git_diff</code> via MCP, or use{" "}
        <code className="font-mono">gf git attach --decision …</code>.
      </section>
    );
  }
  const files = (info.files_changed as string[] | undefined) ?? [];
  const insertions = info.insertions as number | undefined;
  const deletions = info.deletions as number | undefined;
  const commit = info.commit_hash as string | undefined;
  const branch = info.branch_name as string | undefined;
  return (
    <section className="surface p-4">
      <h2 className="text-sm font-medium">Git change</h2>
      <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        {commit && (
          <div>
            <dt className="text-[hsl(var(--muted-foreground))]">Commit</dt>
            <dd className="font-mono">{commit.slice(0, 12)}</dd>
          </div>
        )}
        {branch && (
          <div>
            <dt className="text-[hsl(var(--muted-foreground))]">Branch</dt>
            <dd className="font-mono">{branch}</dd>
          </div>
        )}
        <div>
          <dt className="text-[hsl(var(--muted-foreground))]">Lines</dt>
          <dd>
            <span className="text-green-600">+{insertions ?? 0}</span>{" "}
            <span className="text-red-600">-{deletions ?? 0}</span>
          </dd>
        </div>
        <div>
          <dt className="text-[hsl(var(--muted-foreground))]">Files</dt>
          <dd>{files.length}</dd>
        </div>
      </dl>
      {files.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {files.map((f) => (
            <li key={f} className="font-mono text-xs">
              {f}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PolicyPanel({ events }: { events: Event[] }) {
  // The backend persists PolicyResult rows but the only API path that exposes
  // them today is /policies/check (which re-runs them). The summary lives on
  // the most recent `decision.policy_evaluated` event.
  const evt = events.find((e) => e.event_type === "decision.policy_evaluated");
  if (!evt || !evt.payload_json) {
    return (
      <section className="surface p-4 text-sm text-[hsl(var(--muted-foreground))]">
        Policies haven&apos;t been evaluated for this decision yet.
      </section>
    );
  }
  const results =
    (evt.payload_json.results as
      | Array<{ policy: string; status: string; message: string }>
      | undefined) ?? [];
  return (
    <section className="surface p-4">
      <h2 className="text-sm font-medium">Policy results</h2>
      <ul className="mt-3 divide-y divide-[hsl(var(--border))]">
        {results.map((r) => (
          <li key={r.policy} className="flex items-start gap-3 py-2">
            <StatusBadge value={r.status} />
            <div className="text-sm">
              <div className="font-mono text-xs text-[hsl(var(--muted-foreground))]">
                {r.policy}
              </div>
              <p>{r.message}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ReviewsPanel({ reviews }: { reviews: Review[] }) {
  if (reviews.length === 0) {
    return (
      <section className="surface p-4 text-sm text-[hsl(var(--muted-foreground))]">
        No reviews on this decision yet.
      </section>
    );
  }
  return (
    <section className="surface p-4">
      <h2 className="text-sm font-medium">Reviews</h2>
      <ul className="mt-3 divide-y divide-[hsl(var(--border))]">
        {reviews.map((r) => (
          <li key={r.id} className="space-y-2 py-3">
            <div className="flex items-center gap-2">
              <Link
                href={`/reviews/${r.display_id}`}
                className="font-mono text-xs text-[hsl(var(--primary))] hover:underline"
              >
                {r.display_id}
              </Link>
              <StatusBadge value={r.status} />
              {r.summary && <span className="text-sm">{r.summary}</span>}
            </div>
            {r.findings.length > 0 && (
              <ul className="ml-4 list-disc space-y-1 text-sm text-[hsl(var(--muted-foreground))]">
                {r.findings.slice(0, 3).map((f) => (
                  <li key={f.id}>
                    <span className="text-[hsl(var(--foreground))]">
                      {f.severity}/{f.category}
                    </span>{" "}
                    {f.message}
                  </li>
                ))}
                {r.findings.length > 3 && (
                  <li>
                    <Link
                      href={`/reviews/${r.display_id}`}
                      className="text-[hsl(var(--primary))] hover:underline"
                    >
                      … {r.findings.length - 3} more findings
                    </Link>
                  </li>
                )}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
