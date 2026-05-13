import type { ChangeEvent } from "react";
import type {
    FindingCat,
    FindingInput,
    Severity,
} from "../../src/api/client";
import { Field } from "./Field";
import { Select } from "./Select";

interface Props {
    index: number;
    value: FindingInput;
    severities: readonly Severity[];
    categories: readonly FindingCat[];
    onChange: (next: FindingInput) => void;
    onRemove: () => void;
    disabled?: boolean;
}

export function FindingRow({
    index,
    value,
    severities,
    categories,
    onChange,
    onRemove,
    disabled,
}: Props): JSX.Element {
    const patch = (delta: Partial<FindingInput>): void =>
        onChange({ ...value, ...delta });

    return (
        <div className="finding-row">
            <button
                type="button"
                className="remove"
                onClick={onRemove}
                disabled={disabled}
                aria-label={`Remove finding ${index + 1}`}
                title="Remove this finding"
            >
                ×
            </button>
            <div className="finding-index">Finding #{index + 1}</div>
            <div className="row">
                <Field label="Severity">
                    <Select
                        value={value.severity}
                        options={severities}
                        onChange={(sev) => patch({ severity: sev })}
                        disabled={disabled}
                    />
                </Field>
                <Field label="Category">
                    <Select
                        value={value.category}
                        options={categories}
                        onChange={(cat) => patch({ category: cat })}
                        disabled={disabled}
                    />
                </Field>
            </div>
            <Field label="Message">
                <textarea
                    value={value.message}
                    disabled={disabled}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                        patch({ message: e.target.value })
                    }
                    rows={2}
                    placeholder="What's wrong?"
                />
            </Field>
            <div className="row">
                <Field label="File path" optional>
                    <input
                        type="text"
                        value={value.file_path ?? ""}
                        disabled={disabled}
                        onChange={(e) =>
                            patch({ file_path: e.target.value || undefined })
                        }
                        placeholder="e.g. backend/src/auth.py"
                    />
                </Field>
                <Field label="Line start" optional>
                    <input
                        type="number"
                        value={value.line_start ?? ""}
                        disabled={disabled}
                        min={1}
                        onChange={(e) =>
                            patch({
                                line_start: e.target.value
                                    ? Number(e.target.value)
                                    : undefined,
                            })
                        }
                    />
                </Field>
                <Field label="Line end" optional>
                    <input
                        type="number"
                        value={value.line_end ?? ""}
                        disabled={disabled}
                        min={1}
                        onChange={(e) =>
                            patch({
                                line_end: e.target.value
                                    ? Number(e.target.value)
                                    : undefined,
                            })
                        }
                    />
                </Field>
            </div>
            <Field label="Recommendation" optional>
                <textarea
                    value={value.recommendation ?? ""}
                    disabled={disabled}
                    onChange={(e) =>
                        patch({ recommendation: e.target.value || undefined })
                    }
                    rows={2}
                    placeholder="How to fix it"
                />
            </Field>
        </div>
    );
}
