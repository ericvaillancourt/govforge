import Link from "next/link";
import { localePath, type Locale } from "@/lib/i18n";

interface LogoProps {
  className?: string;
  lang?: Locale;
}

export function Logo({ className = "", lang }: LogoProps) {
  const href = lang ? localePath(lang, "/") : "/";
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}
      aria-label="GovForge home"
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M4 7L12 3L20 7V17L12 21L4 17V7Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M4 7L12 11M12 11L20 7M12 11V21"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="11" r="2" fill="currentColor" />
      </svg>
      <span className="text-base">GovForge</span>
    </Link>
  );
}
