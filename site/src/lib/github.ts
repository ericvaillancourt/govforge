/**
 * GitHub API helpers — used at build time only (server components).
 * Static export bakes the result into the HTML; rebuilds refresh it.
 *
 * Unauthenticated rate limit: 60 req/hour/IP — fine for build use.
 */

export async function getGithubStars(repo: string): Promise<number> {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "govforge-site-build",
      },
    });
    if (!res.ok) {
      console.warn(`[github] failed to fetch ${repo}: HTTP ${res.status}`);
      return 0;
    }
    const data = (await res.json()) as { stargazers_count?: number };
    return data.stargazers_count ?? 0;
  } catch (err) {
    console.warn(`[github] fetch error for ${repo}:`, err);
    return 0;
  }
}

/**
 * Format a star count for compact display:
 *   42       → "42"
 *   1500     → "1.5k"
 *   12345    → "12k"
 *   1500000  → "1.5M"
 */
export function formatStars(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 10_000) return `${(count / 1_000).toFixed(0)}k`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return count.toString();
}
