"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { authApi, API_BASE, type SessionInfo } from "@/lib/auth-api";
import type { Locale } from "@/lib/i18n";

interface Dict {
  codeLabel: string;
  codePlaceholder: string;
  approveBtn: string;
  approving: string;
  successHeading: string;
  successBody: string;
  errorUnknown: string;
  errorExpired: string;
  errorGeneric: string;
  signInPrompt: string;
  signInCta: string;
}

type AuthState =
  | { kind: "loading" }
  | { kind: "anonymous" }
  | { kind: "user"; session: SessionInfo };

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "error"; message: string };

/** Auto-format "ABCDEFGH" → "ABCD-EFGH" while typing. Uppercase + strip whitespace. */
function formatUserCode(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  if (clean.length <= 4) return clean;
  return clean.slice(0, 4) + "-" + clean.slice(4);
}

export function DevicePanel({ lang, dict }: { lang: Locale; dict: Dict }) {
  const [auth, setAuth] = useState<AuthState>({ kind: "loading" });
  const [code, setCode] = useState("");
  const [submit, setSubmit] = useState<SubmitState>({ kind: "idle" });

  useEffect(() => {
    let cancelled = false;
    authApi
      .getSession()
      .then((session) => {
        if (!cancelled) setAuth({ kind: "user", session });
      })
      .catch(() => {
        if (!cancelled) setAuth({ kind: "anonymous" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Read ?code=… from the URL once on mount and prefill the input — saves
  // the user from re-typing what the CLI just printed if we put it there.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prefill = params.get("code");
    if (prefill) setCode(formatUserCode(prefill));
  }, []);

  if (auth.kind === "loading") {
    return (
      <div className="mt-8 h-32 rounded-lg bg-muted/40 animate-pulse" aria-hidden />
    );
  }

  if (auth.kind === "anonymous") {
    const next = encodeURIComponent(`/${lang}/device/${code ? `?code=${code}` : ""}`);
    return (
      <div className="mt-8 rounded-lg border border-border/60 bg-card/40 p-6 text-center">
        <p className="text-sm text-muted-foreground">{dict.signInPrompt}</p>
        <Link
          href={`/${lang}/login/?next=${next}`}
          className="mt-4 inline-flex text-sm text-foreground hover:underline"
        >
          {dict.signInCta}
        </Link>
      </div>
    );
  }

  if (submit.kind === "success") {
    return (
      <div className="mt-8 rounded-lg border border-border/60 bg-card/40 p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-foreground" aria-hidden />
        <h2 className="mt-4 text-lg font-semibold">{dict.successHeading}</h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          {dict.successBody}
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;
    setSubmit({ kind: "submitting" });
    try {
      const res = await fetch(`${API_BASE}/auth/device/approve`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_code: code }),
      });
      if (res.ok) {
        setSubmit({ kind: "success" });
        return;
      }
      const detail =
        res.status === 404
          ? dict.errorUnknown
          : res.status === 410
            ? dict.errorExpired
            : dict.errorGeneric;
      setSubmit({ kind: "error", message: detail });
    } catch {
      setSubmit({ kind: "error", message: dict.errorGeneric });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4">
      <label className="block">
        <span className="text-sm font-medium text-foreground">
          {dict.codeLabel}
        </span>
        <input
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          autoFocus
          value={code}
          onChange={(e) => setCode(formatUserCode(e.target.value))}
          placeholder={dict.codePlaceholder}
          className="mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-center font-mono text-lg tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-ring/50"
          aria-label={dict.codeLabel}
        />
      </label>
      {submit.kind === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {submit.message}
        </p>
      )}
      <button
        type="submit"
        disabled={code.length < 9 || submit.kind === "submitting"}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-transparent bg-foreground px-4 py-2.5 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        {submit.kind === "submitting" ? dict.approving : dict.approveBtn}
      </button>
    </form>
  );
}
