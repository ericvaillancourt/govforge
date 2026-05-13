import { useState } from "react";
import type {
    FindingCat,
    FindingInput,
    ReviewVerdict,
    Severity,
} from "../../src/api/client";
import type { SubmitReviewOptions } from "../../src/forms/messages";
import { postToExtension } from "../api";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { FindingRow } from "../components/FindingRow";
import { Select } from "../components/Select";

interface Props {
    options: SubmitReviewOptions;
    state: { kind: "idle" } | { kind: "submitting" } | { kind: "done"; label: string } | { kind: "error"; message: string };
    onSubmittingChange: (submitting: boolean) => void;
}

export function SubmitReviewForm({ options, state, onSubmittingChange }: Props): JSX.Element {
    const [reviewer, setReviewer] = useState(options.defaultReviewer);
    const [status, setStatus] = useState<ReviewVerdict>(options.verdicts[0]);
    const [summary, setSummary] = useState("");
    const [findings, setFindings] = useState<FindingInput[]>([]);
    const [reviewerError, setReviewerError] = useState("");

    const disabled = state.kind === "submitting" || state.kind === "done";

    function addFinding(): void {
        setFindings([
            ...findings,
            {
                severity: (options.severities[2] ?? options.severities[0]) as Severity,
                category: options.categories[0] as FindingCat,
                message: "",
            },
        ]);
    }

    function updateFinding(idx: number, next: FindingInput): void {
        setFindings(findings.map((f, i) => (i === idx ? next : f)));
    }

    function removeFinding(idx: number): void {
        setFindings(findings.filter((_, i) => i !== idx));
    }

    function handleSubmit(e: React.FormEvent): void {
        e.preventDefault();
        if (!reviewer.trim()) {
            setReviewerError("Required");
            return;
        }
        setReviewerError("");
        onSubmittingChange(true);
        postToExtension({
            type: "submit",
            form: "submitReview",
            payload: {
                reviewer_agent: reviewer.trim(),
                status,
                summary: summary.trim() || undefined,
                findings,
            },
        });
    }

    function handleCancel(): void {
        postToExtension({ type: "cancel" });
    }

    return (
        <form onSubmit={handleSubmit}>
            <h1>Submit review</h1>
            <div className="subject">
                {options.decisionId} — {options.decisionTitle}
            </div>

            {state.kind === "error" ? (
                <div className="banner error">{state.message}</div>
            ) : null}
            {state.kind === "done" ? (
                <div className="banner success">
                    ✓ Submitted as {state.label}
                </div>
            ) : null}

            <Field label="Reviewer agent" error={reviewerError}>
                <input
                    type="text"
                    value={reviewer}
                    disabled={disabled}
                    onChange={(e) => setReviewer(e.target.value)}
                    placeholder="e.g. codex, claude, eric"
                />
            </Field>

            <Field label="Verdict">
                <Select
                    value={status}
                    options={options.verdicts}
                    onChange={setStatus}
                    disabled={disabled}
                />
            </Field>

            <Field label="Summary" helper="One-line takeaway. Markdown OK." optional>
                <textarea
                    value={summary}
                    disabled={disabled}
                    onChange={(e) => setSummary(e.target.value)}
                    rows={2}
                />
            </Field>

            <div className="section-header">
                <h2>Findings ({findings.length})</h2>
                <button
                    type="button"
                    className="add-row"
                    onClick={addFinding}
                    disabled={disabled}
                >
                    + Add finding
                </button>
            </div>

            {findings.length === 0 ? (
                <p style={{ color: "var(--vscode-descriptionForeground)", fontStyle: "italic" }}>
                    No findings — fine for a `commented` review or a green light.
                </p>
            ) : (
                findings.map((f, i) => (
                    <FindingRow
                        key={i}
                        index={i}
                        value={f}
                        severities={options.severities}
                        categories={options.categories}
                        onChange={(next) => updateFinding(i, next)}
                        onRemove={() => removeFinding(i)}
                        disabled={disabled}
                    />
                ))
            )}

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
                            <span className="spinner" /> Submitting…
                        </>
                    ) : (
                        "Submit review"
                    )}
                </Button>
            </div>
        </form>
    );
}
