"use client";

import { useCurrentProject } from "@/lib/project";

/**
 * Wrap a page in `<RequireProject>` to short-circuit rendering when no
 * project is selected yet. The hook is hydration-safe so we don't flash
 * the warning on the first paint.
 */
export function RequireProject({
  children,
}: {
  children: (project: { id: string; root_path: string; name: string }) => React.ReactNode;
}) {
  const { project, loaded } = useCurrentProject();
  if (!loaded) return null;
  if (!project) {
    return (
      <div className="surface p-6 text-sm">
        <p className="text-[hsl(var(--muted-foreground))]">
          Pick a project in the top-right switcher to see its tasks, decisions,
          and reviews.
        </p>
        <p className="mt-2 text-[hsl(var(--muted-foreground))]">
          No project listed?{" "}
          <code className="font-mono">gf init</code> in your repo, then run the
          backend with <code className="font-mono">gf api serve</code>.
        </p>
      </div>
    );
  }
  return <>{children(project)}</>;
}
