import * as os from "node:os";
import * as vscode from "vscode";

/**
 * Returns the agent name to credit on author actions (createTask,
 * recordDecision, attach-git, run-policy). Read from `govforge.agent`
 * if set, else falls back to the OS user. Used by every "I did this"
 * write that needs an actor_agent.
 *
 * Convention: agents in the backend are looked up by free-form name
 * (`get_or_create_agent`) and the type is inferred from the name —
 * 'claude' → CLAUDE, 'codex' → CODEX, anything else → HUMAN. So an
 * arbitrary username works.
 */
export function getAgentName(): string {
    const setting = vscode.workspace
        .getConfiguration("govforge")
        .get<string>("agent", "")
        .trim();
    if (setting) return setting;
    return os.userInfo().username || "human";
}
