export const locales = ["en", "fr"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export function localePath(lang: Locale, path: string): string {
  if (path.startsWith("http") || path.startsWith("mailto:") || path.startsWith("tel:")) {
    return path;
  }
  if (path.startsWith("#")) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (normalized === "/") return `/${lang}/`;
  return `/${lang}${normalized}`;
}

export function swapLocaleInPath(pathname: string, target: Locale): string {
  const hadTrailing = pathname.length > 1 && pathname.endsWith("/");
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return `/${target}/`;
  if (isLocale(segments[0])) {
    segments[0] = target;
  } else {
    segments.unshift(target);
  }
  const joined = "/" + segments.join("/");
  return hadTrailing ? joined + "/" : joined;
}
