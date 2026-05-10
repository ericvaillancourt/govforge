"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

import { ProjectSwitcher } from "./ProjectSwitcher";

/**
 * Top navigation bar. Three concerns:
 *  - brand wordmark
 *  - section links (Dashboard / Tasks / Decisions / Reviews)
 *  - project switcher (the cockpit only operates on one project at a time)
 */
export function Nav() {
  const pathname = usePathname();

  const items: Array<{ href: string; label: string }> = [
    { href: "/", label: "Dashboard" },
    { href: "/tasks", label: "Tasks" },
    { href: "/decisions", label: "Decisions" },
    { href: "/reviews", label: "Reviews" },
  ];

  return (
    <header className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-6 px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold tracking-tight">
            <span className="text-[hsl(var(--primary))]">Gov</span>Forge
            <span className="ml-2 rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-xs font-normal text-[hsl(var(--muted-foreground))]">
              cockpit
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            {items.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]"
                      : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <ProjectSwitcher />
      </div>
    </header>
  );
}
