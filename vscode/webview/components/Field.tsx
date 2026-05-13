import type { ReactNode } from "react";

interface Props {
    label: string;
    helper?: string;
    error?: string;
    children: ReactNode;
    optional?: boolean;
}

export function Field({ label, helper, error, children, optional }: Props): JSX.Element {
    return (
        <div className={`field${error ? " error" : ""}`}>
            <label>
                {label}
                {optional ? <span style={{ opacity: 0.6 }}> (optional)</span> : null}
            </label>
            {children}
            {error ? <span className="error">{error}</span> : helper ? <span className="helper">{helper}</span> : null}
        </div>
    );
}
