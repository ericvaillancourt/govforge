"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { locales, swapLocaleInPath, type Locale } from "@/lib/i18n";

interface LanguageToggleProps {
  current: Locale;
}

export function LanguageToggle({ current }: LanguageToggleProps) {
  const pathname = usePathname() ?? `/${current}/`;
  return (
    <div className="flex items-center text-xs font-medium" role="group" aria-label="Language">
      {locales.map((l, i) => {
        const isActive = l === current;
        const href = swapLocaleInPath(pathname, l);
        return (
          <span key={l} className="flex items-center">
            {i > 0 && (
              <span className="mx-1 text-muted-foreground/40" aria-hidden="true">
                /
              </span>
            )}
            <Link
              href={href}
              aria-current={isActive ? "true" : undefined}
              className={
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground transition-colors"
              }
            >
              {l.toUpperCase()}
            </Link>
          </span>
        );
      })}
    </div>
  );
}
