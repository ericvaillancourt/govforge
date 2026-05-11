"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/site/button-link";
import { GithubIcon, GoogleIcon } from "@/components/site/icons";
import { authApi, API_BASE, type SessionInfo } from "@/lib/auth-api";
import type { Locale } from "@/lib/i18n";

interface Dict {
  github: string;
  google: string;
  magicComingSoon: string;
  tos: string;
  alreadySignedIn: string;
  goToAccount: string;
}

type State =
  | { kind: "loading" }
  | { kind: "anonymous" }
  | { kind: "user"; session: SessionInfo };

export function LoginPanel({ dict, lang }: { dict: Dict; lang: Locale }) {
  const [state, setState] = useState<State>({ kind: "loading" });

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

  if (state.kind === "loading") {
    return (
      <div className="mt-8 space-y-3" aria-hidden>
        <div className="h-11 rounded-lg bg-muted/40 animate-pulse" />
        <div className="h-11 rounded-lg bg-muted/40 animate-pulse" />
        <div className="h-11 rounded-lg bg-muted/40 animate-pulse" />
      </div>
    );
  }

  if (state.kind === "user") {
    const u = state.session.user;
    return (
      <div className="mt-8 rounded-lg border border-border/60 bg-card/40 p-6 text-center">
        <div className="flex items-center justify-center gap-3">
          {u.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={u.avatar_url}
              alt=""
              className="h-12 w-12 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="h-12 w-12 rounded-full bg-muted/60 flex items-center justify-center text-sm font-medium text-muted-foreground">
              {(u.display_name ?? u.email).slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="text-left">
            <div className="text-sm font-medium text-foreground">
              {u.display_name ?? u.email}
            </div>
            {u.display_name && (
              <div className="text-xs text-muted-foreground">{u.email}</div>
            )}
          </div>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          {dict.alreadySignedIn}
        </p>
        <Link
          href={`/${lang}/account/`}
          className="mt-4 inline-flex items-center gap-1 text-sm text-foreground hover:underline"
        >
          {dict.goToAccount}
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mt-8 space-y-3">
        <ButtonLink
          href={`${API_BASE}/auth/github/start`}
          external
          size="lg"
          className="w-full justify-center"
        >
          <GithubIcon className="h-4 w-4" />
          {dict.github}
          <ArrowRight className="h-4 w-4" />
        </ButtonLink>

        <ButtonLink
          href={`${API_BASE}/auth/google/start`}
          external
          size="lg"
          variant="outline"
          className="w-full justify-center"
        >
          <GoogleIcon className="h-4 w-4" />
          {dict.google}
          <ArrowRight className="h-4 w-4" />
        </ButtonLink>

        <button
          type="button"
          disabled
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-border/40 bg-card/40 px-4 py-2.5 text-sm text-muted-foreground/60 cursor-not-allowed"
        >
          {dict.magicComingSoon}
        </button>
      </div>

      <p className="mt-8 text-xs text-muted-foreground leading-relaxed">
        {dict.tos}
      </p>
    </>
  );
}
