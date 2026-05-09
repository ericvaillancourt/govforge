import { ArrowRight, Building2, Package } from "lucide-react";
import { ButtonLink } from "@/components/site/button-link";

const OSS = [
  "MCP server",
  "CLI (gf)",
  "Local SQLite",
  "Git-aware reviews",
  "Decision timeline",
  "Default policies",
  "Local UI cockpit",
  "Self-hosted",
];

const ENTERPRISE = [
  "Cloud sync",
  "Team workspaces",
  "RBAC + SSO/SAML",
  "Air-gapped deployment",
  "Advanced policies",
  "Compliance reports",
  "SLA support",
];

export function OssVsEnterprise() {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28">
      <div className="max-w-2xl">
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          Open core. Pay only for what teams actually need.
        </h2>
      </div>

      <div className="mt-12 grid md:grid-cols-2 gap-4">
        {/* Open Source */}
        <div className="rounded-xl border border-border/60 bg-card p-8">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50 border border-border/40">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Open Source</h3>
              <p className="text-xs text-muted-foreground">
                Apache 2.0 · Forever free
              </p>
            </div>
          </div>
          <ul className="mt-6 space-y-2.5">
            {OSS.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm">
                <span className="text-foreground" aria-hidden="true">
                  ✓
                </span>
                <span className="text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <ButtonLink
              href="/docs/quickstart"
              variant="outline"
              className="w-full sm:w-auto"
            >
              Install
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
          </div>
        </div>

        {/* Enterprise */}
        <div className="rounded-xl border border-foreground/30 bg-card p-8 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-foreground/10 border border-foreground/20">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Enterprise</h3>
              <p className="text-xs text-muted-foreground">
                For teams &amp; compliance
              </p>
            </div>
          </div>
          <p className="mt-6 text-xs uppercase tracking-wider text-muted-foreground">
            Everything in OSS, plus:
          </p>
          <ul className="mt-3 space-y-2.5">
            {ENTERPRISE.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm">
                <span className="text-foreground" aria-hidden="true">
                  ✓
                </span>
                <span className="text-foreground">{item}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <ButtonLink
              href="mailto:eric.vaillancourt@talsom.com?subject=GovForge%20Enterprise"
              className="w-full sm:w-auto"
            >
              Contact sales
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
