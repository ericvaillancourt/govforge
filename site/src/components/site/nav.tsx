"use client";

import { Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/site/button-link";
import { Logo } from "@/components/site/logo";
import { LanguageToggle } from "@/components/site/language-toggle";
import { NavAuth } from "@/components/site/nav-auth";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { GithubIcon } from "@/components/site/icons";
import { formatStars } from "@/lib/github";
import type { Locale } from "@/lib/i18n";
import type { Dictionary } from "@/dictionaries";

interface NavProps {
  stars: number;
  repo: string;
  dict: Dictionary["nav"];
  lang: Locale;
}

export function Nav({ stars, repo, dict, lang }: NavProps) {
  const repoUrl = `https://github.com/${repo}`;
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { href: `/${lang}/#features`, label: dict.features },
    { href: `/${lang}/#workflow`, label: dict.workflow },
    { href: `/${lang}/pricing`, label: dict.pricing },
    { href: `/${lang}/docs`, label: dict.docs },
  ];

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-200 ${
        scrolled
          ? "border-b border-border/40 bg-background/80 backdrop-blur"
          : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Logo lang={lang} />
          <ul className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="hover:text-foreground transition-colors"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            aria-label={`${stars} ${dict.starsAriaLabel}`}
          >
            <Star className="h-3.5 w-3.5" />
            <span>{formatStars(stars)}</span>
          </a>
          <LanguageToggle current={lang} />
          <ThemeToggle ariaLabel={dict.themeAriaLabel} />
          <ButtonLink
            href={repoUrl}
            size="sm"
            className="hidden sm:inline-flex"
          >
            <GithubIcon className="h-4 w-4" />
            {dict.github}
          </ButtonLink>
          <NavAuth
            lang={lang}
            dict={{
              login: dict.login,
              account: dict.account,
              logout: dict.logout,
              menuAriaLabel: dict.menuAriaLabel,
            }}
          />
        </div>
      </nav>
    </header>
  );
}
