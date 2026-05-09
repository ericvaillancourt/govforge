import { CopyButton } from "@/components/site/copy-button";

interface TerminalCardProps {
  command: string;
  output?: string;
  copyValue?: string;
  caption?: string;
}

export function TerminalCard({
  command,
  output,
  copyValue,
  caption,
}: TerminalCardProps) {
  const valueToCopy = copyValue ?? command;
  return (
    <div className="group rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm shadow-sm overflow-hidden">
      {caption ? (
        <div className="border-b border-border/60 px-4 py-2 text-xs text-muted-foreground font-mono">
          {caption}
        </div>
      ) : null}
      <div className="flex items-start gap-2 px-4 py-3 font-mono text-sm">
        <span aria-hidden="true" className="text-muted-foreground select-none">
          $
        </span>
        <pre className="flex-1 overflow-x-auto whitespace-pre text-foreground">
          {command}
        </pre>
        <CopyButton value={valueToCopy} label="Copy command" />
      </div>
      {output ? (
        <div className="border-t border-border/60 px-4 py-3 font-mono text-sm text-muted-foreground bg-muted/30">
          <pre className="overflow-x-auto whitespace-pre">{output}</pre>
        </div>
      ) : null}
    </div>
  );
}
