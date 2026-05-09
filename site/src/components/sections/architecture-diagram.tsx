const NODES = [
  {
    id: "agents",
    title: "AI Agents",
    items: ["Claude Code", "Codex", "Cursor", "+ MCP clients"],
    col: 1,
    row: 1,
  },
  {
    id: "mcp",
    title: "GovForge MCP Server",
    items: ["create_task", "record_decision", "submit_review", "..."],
    col: 2,
    row: 1,
    accent: true,
  },
  {
    id: "git",
    title: "Git (read-only)",
    items: ["diff, commits", "files, branches"],
    col: 3,
    row: 1,
  },
  {
    id: "store",
    title: "Decision Store",
    items: ["SQLite local", "events, reviews", "policies, approvals"],
    col: 1,
    row: 2,
  },
  {
    id: "policy",
    title: "Policy Engine",
    items: ["auth-change", "secret-pattern", "diff-size", "..."],
    col: 2,
    row: 2,
  },
  {
    id: "audit",
    title: "Audit Timeline",
    items: ["append-only", "Git-aware", "event sourced"],
    col: 3,
    row: 2,
  },
];

export function ArchitectureDiagram() {
  return (
    <section className="border-t border-border/40 bg-muted/20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28">
        <div className="max-w-2xl">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Local-first. Git-native.
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            Everything runs on your machine. No cloud unless you choose. Optional
            team sync (Phase 3) for collaboration and enterprise.
          </p>
        </div>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {NODES.map((node) => (
            <div
              key={node.id}
              className={`rounded-xl border p-5 ${
                node.accent
                  ? "border-foreground/30 bg-card shadow-sm"
                  : "border-border/60 bg-card/60"
              }`}
            >
              <h3 className="text-sm font-semibold tracking-tight">
                {node.title}
              </h3>
              <ul className="mt-3 space-y-1">
                {node.items.map((item) => (
                  <li
                    key={item}
                    className="text-xs font-mono text-muted-foreground"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          The MCP server is the integration point. Everything else is offline-by-default.
        </p>
      </div>
    </section>
  );
}
