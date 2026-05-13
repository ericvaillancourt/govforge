import type { ChangeEvent } from "react";

interface Props<T extends string> {
    value: T;
    options: readonly T[];
    onChange: (value: T) => void;
    id?: string;
    disabled?: boolean;
}

export function Select<T extends string>({
    value,
    options,
    onChange,
    id,
    disabled,
}: Props<T>): JSX.Element {
    return (
        <select
            id={id}
            value={value}
            disabled={disabled}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value as T)}
        >
            {options.map((opt) => (
                <option key={opt} value={opt}>
                    {opt}
                </option>
            ))}
        </select>
    );
}
