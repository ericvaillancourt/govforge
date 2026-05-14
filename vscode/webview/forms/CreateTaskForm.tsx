import { useState } from "react";
import type { CreateTaskOptions } from "../../src/forms/messages";
import { postToExtension } from "../api";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { Select } from "../components/Select";

type Risk = "low" | "medium" | "high" | "critical";

const FALLBACK_RISK: readonly Risk[] = ["low", "medium", "high", "critical"];

interface Props {
    options: CreateTaskOptions;
    state:
        | { kind: "idle" }
        | { kind: "submitting" }
        | { kind: "done"; label: string }
        | { kind: "error"; message: string };
    onSubmittingChange: (submitting: boolean) => void;
}

export function CreateTaskForm({ options, state, onSubmittingChange }: Props): JSX.Element {
    const riskLevels: readonly Risk[] =
        Array.isArray(options.riskLevels) && options.riskLevels.length > 0
            ? options.riskLevels
            : FALLBACK_RISK;
    const [title, setTitle] = useState("");
    const [risk, setRisk] = useState<Risk>(
        riskLevels.includes("medium") ? "medium" : riskLevels[0],
    );
    const [description, setDescription] = useState("");
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
            form: "createTask",
            payload: {
                title: title.trim(),
                risk_level: risk,
                description: description.trim() || undefined,
            },
        });
    }

    function handleCancel(): void {
        postToExtension({ type: "cancel" });
    }

    return (
        <form onSubmit={handleSubmit}>
            <h1>Create task</h1>
            <div className="subject">on project: {options.projectName}</div>

            {state.kind === "error" ? (
                <div className="banner error">{state.message}</div>
            ) : null}
            {state.kind === "done" ? (
                <div className="banner success">✓ Created {state.label}</div>
            ) : null}

            <Field label="Title" error={titleError}>
                <input
                    type="text"
                    value={title}
                    disabled={disabled}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Wire OAuth refresh-token rotation"
                    autoFocus
                />
            </Field>

            <Field label="Risk level">
                <Select
                    value={risk}
                    options={riskLevels}
                    onChange={setRisk}
                    disabled={disabled}
                />
            </Field>

            <Field
                label="Description"
                helper="What's the scope? Markdown OK."
                optional
            >
                <textarea
                    value={description}
                    disabled={disabled}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    placeholder="e.g. Migrate the existing endpoints to issue refresh tokens..."
                />
            </Field>

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
                            <span className="spinner" /> Creating…
                        </>
                    ) : (
                        "Create task"
                    )}
                </Button>
            </div>
        </form>
    );
}
