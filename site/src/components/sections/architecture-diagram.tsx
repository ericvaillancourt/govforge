import type { Dictionary } from "@/dictionaries";

const ACCENT_IDS = new Set(["mcp"]);

interface ArchitectureDiagramProps {
  dict: Dictionary["architecture"];
}

export function ArchitectureDiagram({ dict }: ArchitectureDiagramProps) {
  return (
    <section className="border-t border-border/40 bg-muted/20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28">
        <div className="max-w-2xl">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            {dict.heading}
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">{dict.subheading}</p>
        </div>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {dict.nodes.map((node) => {
            const accent = ACCENT_IDS.has(node.id);
            return (
              <div
                key={node.id}
                className={`rounded-xl border p-5 ${
                  accent
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
            );
          })}
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          {dict.footnote}
        </p>
      </div>
    </section>
  );
}
