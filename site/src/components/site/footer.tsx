import Link from "next/link";
import { Logo } from "@/components/site/logo";
import { localePath, type Locale } from "@/lib/i18n";
import type { Dictionary } from "@/dictionaries";

interface FooterProps {
  dict: Dictionary["footer"];
  lang: Locale;
}

export function Footer({ dict, lang }: FooterProps) {
  const year = new Date().getFullYear();
  const rights = dict.rights.replace("{year}", String(year));
  return (
    <footer className="border-t border-border/40 bg-background mt-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 lg:py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Logo lang={lang} />
            <p className="mt-3 text-sm text-muted-foreground max-w-xs">
              {dict.tagline}
            </p>
          </div>
          {dict.columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                {col.title}
              </h3>
              <ul className="mt-3 space-y-2">
                {col.links.map((link) => {
                  const href = link.external ? link.href : localePath(lang, link.href);
                  return (
                    <li key={link.href + link.label}>
                      {link.external ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {link.label}
                          <span aria-hidden="true"> ↗</span>
                        </a>
                      ) : (
                        <Link
                          href={href}
                          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {link.label}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 pt-6 border-t border-border/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{rights}</p>
          <p className="text-xs text-muted-foreground">{dict.made}</p>
        </div>
      </div>
    </footer>
  );
}
