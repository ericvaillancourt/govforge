import type { ReactNode } from "react";

interface Props {
    children: ReactNode;
    onClick?: () => void;
    type?: "submit" | "button";
    variant?: "primary" | "secondary";
    disabled?: boolean;
}

export function Button({
    children,
    onClick,
    type = "button",
    variant = "primary",
    disabled,
}: Props): JSX.Element {
    return (
        <button
            type={type}
            className={variant}
            onClick={onClick}
            disabled={disabled}
        >
            {children}
        </button>
    );
}
