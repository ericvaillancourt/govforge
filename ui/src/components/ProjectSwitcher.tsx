"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { useCurrentProject } from "@/lib/project";

/**
 * Renders a `<select>` with every project from /projects. Picking one writes
 * to localStorage and the rest of the app picks it up.
 */
export function ProjectSwitcher() {
  const { project, setProject, loaded } = useCurrentProject();
  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: api.projects.list,
  });

  if (!loaded) return null;

  if (!projects || projects.length === 0) {
    return (
      <span className="text-xs text-[hsl(var(--muted-foreground))]">
        No projects — run <code className="font-mono">gf init</code>
      </span>
    );
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-[hsl(var(--muted-foreground))]">Project</span>
      <select
        className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1"
        value={project?.id ?? ""}
        onChange={(e) => {
          const p = projects.find((x) => x.id === e.target.value) ?? null;
          setProject(p);
        }}
      >
        <option value="" disabled>
          Choose…
        </option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}
