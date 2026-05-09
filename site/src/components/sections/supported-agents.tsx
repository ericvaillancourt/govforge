const AGENTS = [
  { name: "Claude Code", short: "Claude" },
  { name: "Codex", short: "Codex" },
  { name: "Cursor", short: "Cursor" },
  { name: "Cline", short: "Cline" },
  { name: "Aider", short: "Aider" },
  { name: "RooCode", short: "RooCode" },
  { name: "Continue", short: "Continue" },
  { name: "Zed", short: "Zed" },
  { name: "Any MCP client", short: "+ MCP" },
];

export function SupportedAgents() {
  return (
    <section className="border-y border-border/40 bg-muted/20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-20">
        <h2 className="text-center text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Works with the agents you already use
        </h2>
        <div className="mt-8 grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3">
          {AGENTS.map((agent) => (
            <div
              key={agent.name}
              className="flex h-16 items-center justify-center rounded-lg border border-border/40 bg-card text-sm font-medium text-muted-foreground hover:text-foreground hover:border-border transition-colors"
              title={agent.name}
            >
              {agent.short}
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Any tool that speaks the{" "}
          <a
            href="https://modelcontextprotocol.io"
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-4 hover:underline text-foreground"
          >
            Model Context Protocol
          </a>{" "}
          works.
        </p>
      </div>
    </section>
  );
}
