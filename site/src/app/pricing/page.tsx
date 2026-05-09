import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/site/button-link";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Open source forever. Pay only when teams need cloud sync, RBAC, SSO, or compliance reporting.",
};

const TIERS = [
  {
    name: "Open Source",
    price: "$0",
    period: "forever",
    description: "Everything you need to govern AI agents on your own machine.",
    features: [
      "MCP server",
      "CLI gf",
      "Local UI cockpit",
      "All default policies",
      "Self-hosted, no cloud",
      "Apache 2.0 license",
      "Community support",
    ],
    cta: { label: "Install", href: "/docs/quickstart", variant: "outline" as const },
    highlighted: false,
  },
  {
    name: "Team",
    price: "TBD",
    period: "per seat / month",
    description: "Cloud sync, shared timelines, notifications. (Coming Phase 3.)",
    badge: "Phase 3",
    features: [
      "Everything in OSS",
      "Cloud sync",
      "Team workspaces",
      "Slack / Teams notifications",
      "Shared timelines",
      "Email support",
    ],
    cta: { label: "Get notified", href: "mailto:eric.vaillancourt@talsom.com?subject=GovForge%20Team%20waitlist", variant: "default" as const },
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "contact us",
    description: "Air-gapped, RBAC, SSO/SAML, compliance reports, SLA.",
    features: [
      "Everything in Team",
      "Air-gapped deployment",
      "SSO / SAML",
      "RBAC + audit export",
      "Compliance reports (Loi 25, AI Act, SOC2)",
      "Dedicated support + SLA",
    ],
    cta: { label: "Contact sales", href: "mailto:eric.vaillancourt@talsom.com?subject=GovForge%20Enterprise", variant: "default" as const },
    highlighted: false,
  },
];

const FAQ = [
  {
    q: "Is the OSS version really fully functional?",
    a: "Yes. Phase 1 ships a complete local-first product. You can govern AI agents end-to-end without paying us a cent.",
  },
  {
    q: "Can I self-host the Enterprise features?",
    a: "Yes — air-gapped deployment is one of the core Enterprise features. Cloud sync becomes optional rather than mandatory.",
  },
  {
    q: "Do you store any of my code?",
    a: "Never on the OSS tier. On Team/Enterprise, only the metadata you explicitly choose to sync (decisions, reviews, events) — never raw source code.",
  },
  {
    q: "When will Team / Enterprise be available?",
    a: "Team: Phase 3 (post-launch). Enterprise: pilot programs available now via direct contact, full GA after Team.",
  },
  {
    q: "What if you shut down the SaaS one day?",
    a: "The OSS core works forever, fully self-hosted, with no dependency on our cloud. There is no vendor lock-in by design.",
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28">
      <div className="max-w-2xl">
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
          Pricing as boring as governance should be.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Open core. Free OSS forever. Pay only when teams need collaboration or
          compliance.
        </p>
      </div>

      <div className="mt-12 grid md:grid-cols-3 gap-4">
        {TIERS.map((tier) => (
          <div
            key={tier.name}
            className={`rounded-xl border p-8 flex flex-col ${
              tier.highlighted
                ? "border-foreground/30 bg-card shadow-sm"
                : "border-border/60 bg-card"
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">{tier.name}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {tier.description}
                </p>
              </div>
              {tier.badge ? (
                <Badge variant="secondary">{tier.badge}</Badge>
              ) : null}
            </div>
            <div className="mt-6 flex items-baseline gap-2">
              <span className="text-4xl font-semibold tracking-tight">
                {tier.price}
              </span>
              <span className="text-sm text-muted-foreground">
                {tier.period}
              </span>
            </div>
            <ul className="mt-6 space-y-2.5 flex-1">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <span className="text-foreground" aria-hidden="true">
                    ✓
                  </span>
                  <span className="text-muted-foreground">{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <ButtonLink
                href={tier.cta.href}
                variant={tier.cta.variant}
                className="w-full"
              >
                {tier.cta.label}
                <ArrowRight className="h-4 w-4" />
              </ButtonLink>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        No lock-in. Switch tiers anytime. OSS works forever even if SaaS shuts down.
      </p>

      {/* FAQ */}
      <div className="mt-24">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Frequently asked
        </h2>
        <Accordion className="mt-6 max-w-3xl">
          {FAQ.map((item, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-left">{item.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}
