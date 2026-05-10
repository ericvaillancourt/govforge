"use client";

/**
 * Currently-selected project, stored in localStorage so a refresh keeps the
 * cockpit pointed at the right project_path. Used by every page that calls
 * `/tasks` / `/decisions` / `/reviews` (the API requires `project_path`).
 */

import { useEffect, useState } from "react";

import type { Project } from "./api";

const KEY = "govforge.current_project";

export function loadCurrentProject(): Project | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Project;
  } catch {
    return null;
  }
}

export function saveCurrentProject(project: Project | null): void {
  if (typeof window === "undefined") return;
  if (project === null) {
    window.localStorage.removeItem(KEY);
  } else {
    window.localStorage.setItem(KEY, JSON.stringify(project));
  }
}

/** Hook that returns the current project + a setter, hydration-safe. */
export function useCurrentProject(): {
  project: Project | null;
  setProject: (p: Project | null) => void;
  loaded: boolean;
} {
  const [project, setProjectState] = useState<Project | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // localStorage is browser-only, so we hydrate after mount. The
    // cascading-render warning is the price of doing client-only state with
    // SSR-correctness; the alternative (suspending or using a sync external
    // store) is heavier than warranted for one localStorage key.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProjectState(loadCurrentProject());
    setLoaded(true);
  }, []);

  function setProject(p: Project | null): void {
    saveCurrentProject(p);
    setProjectState(p);
  }

  return { project, setProject, loaded };
}
