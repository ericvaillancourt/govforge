import Link from "next/link";
import { Logo } from "@/components/site/logo";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/#features", label: "Features" },
      { href: "/pricing", label: "Pricing" },
      { href: "/#workflow", label: "Workflow" },
      {
        href: "https://github.com/govforge/govforge#roadmap",
        label: "Roadmap",
        external: true,
      },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/docs", label: "Documentation" },
      { href: "/changelog", label: "Changelog" },
      { href: "/blog", label: "Blog" },
      { href: "/docs/api", label: "API" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "mailto:eric.vaillancourt@talsom.com", label: "Contact" },
      {
        href: "https://github.com/govforge",
        label: "GitHub",
        external: true,
      },
    ],
  },
  {
    title: "Legal",
    links: [
      {
        href: "https://www.apache.org/licenses/LICENSE-2.0",
        label: "License",
        external: true,
      },
      { href: "/security", label: "Security" },
      { href: "/privacy", label: "Privacy" },
    ],
  },
];

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border/40 bg-background mt-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 lg:py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Logo />
            <p className="mt-3 text-sm text-muted-foreground max-w-xs">
              Governance infrastructure for AI coding agents.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                {col.title}
              </h3>
              <ul className="mt-3 space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {link.label}
                        <span aria-hidden="true"> ↗</span>
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 pt-6 border-t border-border/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            © {year} GovForge. Apache 2.0 licensed.
          </p>
          <p className="text-xs text-muted-foreground">
            Made with care in Montréal.
          </p>
        </div>
      </div>
    </footer>
  );
}
