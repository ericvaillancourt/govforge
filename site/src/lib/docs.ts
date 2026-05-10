import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { marked, type Tokens } from "marked";

const DOCS_DIR = path.join(process.cwd(), "..", "docs");

export interface DocEntry {
  slug: string;
  title: string;
  filename: string;
}

export interface ParsedDoc extends DocEntry {
  html: string;
  rawTitle: string;
}

const SLUG_TO_FILE: Record<string, string> = {
  quickstart: "quickstart.md",
  architecture: "architecture.md",
  "data-model": "data-model.md",
  configuration: "configuration.md",
  "cli-reference": "cli-reference.md",
  "mcp-integration": "mcp-integration.md",
  "mcp-reference": "mcp-reference.md",
  "policy-authoring": "policy-authoring.md",
  "threat-model": "threat-model.md",
  "workflow-example": "workflow-example.md",
  faq: "faq.md",
  brand: "brand.md",
  release: "release.md",
};

export const docSlugs = Object.keys(SLUG_TO_FILE);

export function isDocSlug(slug: string): boolean {
  return slug in SLUG_TO_FILE;
}

async function readMarkdown(slug: string): Promise<string> {
  const filename = SLUG_TO_FILE[slug];
  if (!filename) throw new Error(`Unknown doc slug: ${slug}`);
  const filepath = path.join(DOCS_DIR, filename);
  return fs.readFile(filepath, "utf-8");
}

function extractTitle(md: string): string {
  const match = md.match(/^#\s+(.+)$/m);
  return match ? match[1].replace(/`/g, "").trim() : "";
}

const REPO_BLOB_BASE = "https://github.com/ericvaillancourt/govforge/blob/main";

marked.setOptions({
  gfm: true,
  breaks: false,
});

// Rewrite intra-doc and cross-package links so they resolve on the live site.
//   foo.md            → ../foo/         (sibling doc page on /<lang>/docs/)
//   foo.md#anchor     → ../foo/#anchor
//   ../site/path      → GitHub blob URL (cross-package, repo-only references)
//   ../backend/x.py   → GitHub blob URL
//   http(s):// / mailto: / # / / → unchanged
marked.use({
  renderer: {
    link(token: Tokens.Link): string {
      let href = token.href;
      let openInNewTab = false;
      const sibling = /^([^/:#?]+)\.md(#.*)?$/.exec(href);
      if (sibling) {
        href = `../${sibling[1]}/${sibling[2] ?? ""}`;
      } else if (href.startsWith("../")) {
        href = `${REPO_BLOB_BASE}/${href.slice(3)}`;
        openInNewTab = true;
      } else if (/^https?:/.test(href) && !href.includes("govforge.dev")) {
        openInNewTab = true;
      }
      const inner = this.parser.parseInline(token.tokens);
      const titleAttr = token.title ? ` title="${token.title}"` : "";
      const targetAttr = openInNewTab ? ` target="_blank" rel="noopener noreferrer"` : "";
      return `<a href="${href}"${titleAttr}${targetAttr}>${inner}</a>`;
    },
  },
});

export async function getDoc(slug: string): Promise<ParsedDoc> {
  const md = await readMarkdown(slug);
  const rawTitle = extractTitle(md) || slug;
  const withoutH1 = md.replace(/^#\s+.+$/m, "").trim();
  const html = await marked.parse(withoutH1);
  return {
    slug,
    filename: SLUG_TO_FILE[slug],
    title: rawTitle,
    rawTitle,
    html,
  };
}

export async function listDocs(): Promise<DocEntry[]> {
  const entries: DocEntry[] = [];
  for (const slug of docSlugs) {
    const md = await readMarkdown(slug);
    entries.push({
      slug,
      filename: SLUG_TO_FILE[slug],
      title: extractTitle(md) || slug,
    });
  }
  return entries;
}
