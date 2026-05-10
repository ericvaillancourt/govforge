import Link from "next/link";
import { localePath, type Locale } from "@/lib/i18n";

interface LogoProps {
  className?: string;
  lang?: Locale;
}

/**
 * Site brand mark — same composition as `public/brand/mark.svg` and the
 * favicon at `app/icon.tsx`. Inherits colour via `currentColor` so the
 * single component works on any background. Marked aria-hidden because
 * the wordmark text alongside it is the accessible label.
 *
 * Source of truth for the artwork: `docs/brand.md`. Don't fork the
 * paths into another component — import this one.
 */
export function Logo({ className = "", lang }: LogoProps) {
  const href = lang ? localePath(lang, "/") : "/";
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}
      aria-label="GovForge home"
    >
      <svg
        width="28"
        height="28"
        viewBox="0 0 64 64"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="4" y="4" width="56" height="56" rx="12" ry="12" />
        <path d="M40 22 H26 a8 8 0 0 0 -8 8 v4 a8 8 0 0 0 8 8 h6 a4 4 0 0 0 4 -4 v-4 H30" />
        <path d="M44 38 v6" />
      </svg>
      <span className="text-base">GovForge</span>
    </Link>
  );
}
