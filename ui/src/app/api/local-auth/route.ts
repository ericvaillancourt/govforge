import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { NextResponse } from "next/server";

/**
 * Local-first auth helper for the cockpit.
 *
 * Reads `~/.config/govforge/auth.toml` (the same file written by
 * `gf auth login`) and returns the token so the browser-side TokenGate
 * can auto-sign-in without forcing the operator to paste manually.
 *
 * Only useful when the cockpit runs on the same machine as the CLI —
 * which is the canonical local-first deployment. The hosted cockpit
 * (app.govforge.dev, Phase 3) will replace this path with OAuth
 * session cookies.
 *
 * Returns `{ token: null }` if the file is missing, unreadable, or
 * doesn't contain a token line. Never throws — the TokenGate will
 * just fall back to manual paste.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const path = join(homedir(), ".config", "govforge", "auth.toml");
  try {
    const content = await fs.readFile(path, "utf-8");
    const match = content.match(/^token\s*=\s*"(gfp_[^"]+)"/m);
    if (match) {
      return NextResponse.json(
        { token: match[1] },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
  } catch {
    // File missing or unreadable — fall through.
  }
  return NextResponse.json(
    { token: null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
