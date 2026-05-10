"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, LogOut, Trash2 } from "lucide-react";
import {
  authApi,
  tokensApi,
  ALL_SCOPES,
  AGENT_TYPES,
  type SessionInfo,
  type ApiTokenSummary,
  type CreateTokenOut,
} from "@/lib/auth-api";

interface Dict {
  loading: string;
  notSignedIn: string;
  signInHere: string;
  profileHeading: string;
  emailLabel: string;
  providersLabel: string;
  signOut: string;
  tokensHeading: string;
  tokensSubheading: string;
  noTokens: string;
  labelHeader: string;
  agentHeader: string;
  scopesHeader: string;
  lastUsedHeader: string;
  neverUsed: string;
  revoke: string;
  revokeConfirm: string;
  createHeading: string;
  createLabelField: string;
  createLabelPlaceholder: string;
  createAgentField: string;
  createScopesField: string;
  createBtn: string;
  createSuccess: string;
  copyBtn: string;
  copyDone: string;
}

interface Props {
  dict: Dict;
  lang: string;
}

type AsyncState =
  | { kind: "loading" }
  | { kind: "unauthed" }
  | { kind: "ready"; session: SessionInfo; tokens: ApiTokenSummary[] };

export function AccountPanel({ dict, lang }: Props) {
  const [state, setState] = useState<AsyncState>({ kind: "loading" });
  const [createdSecret, setCreatedSecret] = useState<CreateTokenOut | null>(
    null,
  );

  const reload = useCallback(async () => {
    try {
      const session = await authApi.getSession();
      const tokens = await tokensApi.list();
      setState({ kind: "ready", session, tokens });
    } catch {
      setState({ kind: "unauthed" });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (state.kind === "loading") {
    return <p className="text-muted-foreground">{dict.loading}</p>;
  }
  if (state.kind === "unauthed") {
    return (
      <div>
        <p className="text-muted-foreground">{dict.notSignedIn}</p>
        <a
          href={`/${lang}/login/`}
          className="mt-3 inline-flex text-foreground hover:underline"
        >
          {dict.signInHere}
        </a>
      </div>
    );
  }

  const { session, tokens } = state;

  return (
    <div className="space-y-16">
      <ProfileSection
        dict={dict}
        session={session}
        onLogout={async () => {
          try {
            await authApi.logout();
          } finally {
            setState({ kind: "unauthed" });
          }
        }}
      />

      <TokensSection
        dict={dict}
        tokens={tokens}
        onRevoke={async (id) => {
          if (!confirm(dict.revokeConfirm)) return;
          await tokensApi.revoke(id);
          await reload();
        }}
      />

      <CreateTokenSection
        dict={dict}
        createdSecret={createdSecret}
        onCreate={async (body) => {
          const out = await tokensApi.create(body);
          setCreatedSecret(out);
          await reload();
        }}
        onDismiss={() => setCreatedSecret(null)}
      />
    </div>
  );
}

function ProfileSection({
  dict,
  session,
  onLogout,
}: {
  dict: Dict;
  session: SessionInfo;
  onLogout: () => void | Promise<void>;
}) {
  const user = session.user;
  return (
    <section>
      <h2 className="text-2xl font-semibold tracking-tight">
        {dict.profileHeading}
      </h2>
      <div className="mt-6 flex items-start gap-4">
        {user.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatar_url}
            alt={user.display_name ?? user.email}
            className="h-14 w-14 rounded-full border border-border/60"
          />
        ) : null}
        <div className="flex-1 min-w-0">
          {user.display_name ? (
            <p className="text-lg font-medium">{user.display_name}</p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            <span className="text-xs uppercase tracking-wider mr-2">
              {dict.emailLabel}
            </span>
            {user.email}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="text-xs uppercase tracking-wider mr-2">
              {dict.providersLabel}
            </span>
            {user.accounts.join(", ") || "—"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onLogout()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-3 py-1.5 text-sm hover:bg-muted/40 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          {dict.signOut}
        </button>
      </div>
    </section>
  );
}

function TokensSection({
  dict,
  tokens,
  onRevoke,
}: {
  dict: Dict;
  tokens: ApiTokenSummary[];
  onRevoke: (id: string) => Promise<void>;
}) {
  return (
    <section>
      <h2 className="text-2xl font-semibold tracking-tight">
        {dict.tokensHeading}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{dict.tokensSubheading}</p>

      {tokens.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">{dict.noTokens}</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">{dict.labelHeader}</th>
                <th className="px-4 py-2 text-left">{dict.agentHeader}</th>
                <th className="px-4 py-2 text-left">{dict.scopesHeader}</th>
                <th className="px-4 py-2 text-left">{dict.lastUsedHeader}</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((t) => (
                <tr key={t.id} className="border-t border-border/40">
                  <td className="px-4 py-2 font-medium">
                    {t.label}
                    <span className="ml-2 text-xs font-mono text-muted-foreground">
                      gfp_{t.prefix}…
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {t.agent_type}
                  </td>
                  <td className="px-4 py-2 text-xs font-mono text-muted-foreground">
                    {t.scopes_csv}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {t.last_used_at
                      ? new Date(t.last_used_at).toLocaleString()
                      : dict.neverUsed}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {t.revoked_at ? (
                      <span className="text-xs text-muted-foreground/60">
                        ×
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void onRevoke(t.id)}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                        {dict.revoke}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function CreateTokenSection({
  dict,
  createdSecret,
  onCreate,
  onDismiss,
}: {
  dict: Dict;
  createdSecret: CreateTokenOut | null;
  onCreate: (body: {
    label: string;
    agent_type: string;
    scopes: string[];
  }) => Promise<void>;
  onDismiss: () => void;
}) {
  const [label, setLabel] = useState("");
  const [agent, setAgent] = useState<string>("claude");
  const [scopes, setScopes] = useState<string[]>([
    "decisions:write",
    "reviews:read",
    "policies:read",
    "events:read",
  ]);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  if (createdSecret) {
    return (
      <section className="rounded-xl border border-green-500/40 bg-green-500/5 p-6">
        <h3 className="text-base font-semibold text-foreground">
          {dict.createSuccess}
        </h3>
        <pre className="mt-3 overflow-x-auto rounded-md border border-border/60 bg-background/60 p-3 font-mono text-xs">
          {createdSecret.secret}
        </pre>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(createdSecret.secret);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-3 py-1.5 text-sm hover:bg-muted/40 transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-green-500" />
                {dict.copyDone}
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                {dict.copyBtn}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ×
          </button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-2xl font-semibold tracking-tight">
        {dict.createHeading}
      </h2>
      <form
        className="mt-6 grid gap-4 max-w-xl"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!label || scopes.length === 0) return;
          setBusy(true);
          try {
            await onCreate({ label, agent_type: agent, scopes });
            setLabel("");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="grid gap-1">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {dict.createLabelField}
          </span>
          <input
            type="text"
            required
            value={label}
            placeholder={dict.createLabelPlaceholder}
            onChange={(e) => setLabel(e.target.value)}
            className="rounded-md border border-border/60 bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/40"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {dict.createAgentField}
          </span>
          <select
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
            className="rounded-md border border-border/60 bg-card px-3 py-2 text-sm"
          >
            {AGENT_TYPES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="grid gap-1">
          <legend className="text-xs uppercase tracking-wider text-muted-foreground">
            {dict.createScopesField}
          </legend>
          <div className="grid grid-cols-2 gap-1 mt-2">
            {ALL_SCOPES.map((s) => (
              <label key={s} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={scopes.includes(s)}
                  onChange={(e) =>
                    setScopes(
                      e.target.checked
                        ? [...scopes, s]
                        : scopes.filter((x) => x !== s),
                    )
                  }
                />
                <span className="font-mono text-xs">{s}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <button
          type="submit"
          disabled={busy || !label || scopes.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {dict.createBtn}
        </button>
      </form>
    </section>
  );
}
