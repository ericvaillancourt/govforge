"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LogIn, LogOut, User } from "lucide-react";
import { authApi, type SessionInfo, API_BASE } from "@/lib/auth-api";
import type { Locale } from "@/lib/i18n";

type AuthState =
  | { kind: "loading" }
  | { kind: "anonymous" }
  | { kind: "user"; session: SessionInfo };

interface NavAuthProps {
  lang: Locale;
  dict: {
    login: string;
    account: string;
    logout: string;
    menuAriaLabel: string;
  };
}

function initialsOf(s: SessionInfo): string {
  const base = s.user.display_name ?? s.user.email;
  return base
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

export function NavAuth({ lang, dict }: NavAuthProps) {
  const [state, setState] = useState<AuthState>({ kind: "loading" });
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    authApi
      .getSession()
      .then((session) => {
        if (!cancelled) setState({ kind: "user", session });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "anonymous" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (state.kind === "loading") {
    return <div className="h-8 w-8 rounded-full bg-muted/40 animate-pulse" aria-hidden />;
  }

  if (state.kind === "anonymous") {
    return (
      <Link
        href={`/${lang}/login/`}
        className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        <LogIn className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{dict.login}</span>
      </Link>
    );
  }

  const user = state.session.user;
  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Even if the API rejects we still want to clear local state.
    }
    setState({ kind: "anonymous" });
    setOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={dict.menuAriaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        className="h-8 w-8 overflow-hidden rounded-full border border-border/60 bg-muted/30 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 flex items-center justify-center"
      >
        {user.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatar_url}
            alt=""
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span>{initialsOf(state.session)}</span>
        )}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 rounded-lg border border-border/60 bg-background/95 backdrop-blur shadow-lg p-1 text-sm"
        >
          <div className="px-3 py-2 border-b border-border/40">
            <div className="font-medium text-foreground truncate">
              {user.display_name ?? user.email}
            </div>
            {user.display_name && (
              <div className="text-xs text-muted-foreground truncate">
                {user.email}
              </div>
            )}
            {user.accounts.length > 0 && (
              <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">
                {user.accounts.join(" · ")}
              </div>
            )}
          </div>
          <Link
            href={`/${lang}/account/`}
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            onClick={() => setOpen(false)}
          >
            <User className="h-4 w-4" />
            {dict.account}
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            {dict.logout}
          </button>
        </div>
      )}
    </div>
  );
}

// Re-export for callers that want to surface the API base when wiring helpers.
export { API_BASE };
