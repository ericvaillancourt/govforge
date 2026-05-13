import { useState } from "react";
import type { RecordDecisionOptions } from "../../src/forms/messages";
import { postToExtension } from "../api";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { Select } from "../components/Select";

type Risk = "low" | "medium" | "high" | "critical";

interface Props {
    options: RecordDecisionOptions;
    state:
        | { kind: "idle" }
        | { kind: "submitting" }
        | { kind: "done"; label: string }
        | { kind: "error"; message: string };
    onSubmittingChange: (submitting: boolean) => void;
}

export function RecordDecisionForm({
    options,
    state,
    onSubmittingChange,
}: Props): JSX.Element {
    const [title, setTitle] = useState("");
    const [summary, setSummary] = useState("");
    const [rationale, setRationale] = useState("");
    const [risk, setRisk] = useState<Risk>(
        (options.riskLevels.includes("medium") ? "medium" : options.riskLevels[0]) as Risk,
    );
    const [humanApproval, setHumanApproval] = useState(false);
    const [titleError, setTitleError] = useState("");

    const disabled = state.kind === "submitting" || state.kind === "done";

    function handleSubmit(e: React.FormEvent): void {
        e.preventDefault();
        if (!title.trim()) {
            setTitleError("Required");
            return;
        }
        setTitleError("");
        onSubmittingChange(true);
        postToExtension({
            type: "submit",
            form: "recordDecision",
            payload: {
                title: title.trim(),
                summary: summary.trim() || undefined,
                rationale: rationale.trim() || undefined,
                risk_level: risk,
                human_approval_required: humanApproval,
            },
        });
    }

    function handleCancel(): void {
        postToExtension({ type: "cancel" });
    }

    return (
        <form onSubmit={handleSubmit}>
            <h1>Record decision</h1>
            <div className="subject">
                under {options.taskId} — {options.taskTitle}
            </div>

            {state.kind === "error" ? (
                <div className="banner error">{state.message}</div>
            ) : null}
            {state.kind === "done" ? (
                <div className="banner success">✓ Recorded {state.label}</div>
            ) : null}

            <Field label="Title" error={titleError}>
                <input
                    type="text"
                    value={title}
                    disabled={disabled}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Use RS256 for JWT signing"
                    autoFocus
                />
            </Field>

            <Field
                label="Summary"
                helper="One-line outcome. Markdown OK."
                optional
            >
                <textarea
                    value={summary}
                    disabled={disabled}
                    onChange={(e) => setSummary(e.target.value)}
                    rows={2}
                />
            </Field>

            <Field
                label="Rationale"
                helper="Why this choice over the alternatives? Markdown OK."
                optional
            >
                <textarea
                    value={rationale}
                    disabled={disabled}
                    onChange={(e) => setRationale(e.target.value)}
                    rows={4}
                />
            </Field>

            <Field label="Risk level">
                <Select
                    value={risk}
                    options={options.riskLevels}
                    onChange={setRisk}
                    disabled={disabled}
                />
            </Field>

            <label className="checkbox-field">
                <input
                    type="checkbox"
                    checked={humanApproval}
                    disabled={disabled}
                    onChange={(e) => setHumanApproval(e.target.checked)}
                />
                Human approval required
            </label>

            <div className="buttons">
                <Button
                    variant="secondary"
                    type="button"
                    onClick={handleCancel}
                    disabled={state.kind === "submitting"}
                >
                    Cancel
                </Button>
                <Button type="submit" disabled={disabled}>
                    {state.kind === "submitting" ? (
                        <>
                            <span className="spinner" /> Recording…
                        </>
                    ) : (
                        "Record decision"
                    )}
                </Button>
            </div>
        </form>
    );
}
