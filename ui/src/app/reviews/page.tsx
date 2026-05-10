"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { RequireProject } from "@/components/EmptyProject";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/lib/api";

export default function ReviewsListPage() {
  return (
    <RequireProject>
      {(project) => <ReviewsList projectPath={project.root_path} />}
    </RequireProject>
  );
}

function ReviewsList({ projectPath }: { projectPath: string }) {
  const params = useSearchParams();
  const openOnly = params.get("open") === "1";

  const { data, isLoading, error } = useQuery({
    queryKey: ["reviews", projectPath, openOnly],
    queryFn: () => api.reviews.list(projectPath, openOnly),
  });

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Reviews</h1>
        <div className="flex gap-2 text-sm">
          <Link
            href="/reviews"
            className={
              openOnly
                ? "text-[hsl(var(--muted-foreground))] hover:underline"
                : "font-medium underline"
            }
          >
            All
          </Link>
          <Link
            href="/reviews?open=1"
            className={
              openOnly
                ? "font-medium underline"
                : "text-[hsl(var(--muted-foreground))] hover:underline"
            }
          >
            Open only
          </Link>
        </div>
      </div>
      {isLoading && <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>}
      {error && (
        <p className="surface p-4 text-sm text-red-600">{(error as Error).message}</p>
      )}
      <ul className="surface divide-y divide-[hsl(var(--border))]">
        {(data ?? []).map((r) => (
          <li key={r.id}>
            <Link
              href={`/reviews/${r.display_id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-[hsl(var(--muted))]"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-[hsl(var(--muted-foreground))]">
                  {r.display_id}
                </span>
                <span>{r.summary ?? "(no summary)"}</span>
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  {r.findings.length} finding{r.findings.length === 1 ? "" : "s"}
                </span>
              </div>
              <StatusBadge value={r.status} />
            </Link>
          </li>
        ))}
        {data && data.length === 0 && (
          <li className="px-4 py-6 text-sm text-[hsl(var(--muted-foreground))]">
            No reviews.
          </li>
        )}
      </ul>
    </section>
  );
}
