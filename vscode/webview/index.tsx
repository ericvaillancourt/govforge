import { Component, type ErrorInfo, type ReactNode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { FormOptions } from "../src/forms/messages";
import { onExtensionMessage, postToExtension } from "./api";
import { CreateTaskForm } from "./forms/CreateTaskForm";
import { RecordDecisionForm } from "./forms/RecordDecisionForm";
import { SubmitReviewForm } from "./forms/SubmitReviewForm";
import "./styles.css";

class ErrorBoundary extends Component<
    { children: ReactNode },
    { error: Error | null }
> {
    state = { error: null as Error | null };

    static getDerivedStateFromError(error: Error): { error: Error } {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        // Show in DevTools too.
        console.error("GovForge form crashed:", error, info.componentStack);
    }

    render(): ReactNode {
        if (this.state.error) {
            return (
                <div className="banner error" style={{ whiteSpace: "pre-wrap" }}>
                    {`Form crashed: ${this.state.error.message}\n\n${this.state.error.stack ?? ""}`}
                </div>
            );
        }
        return this.props.children;
    }
}

type FormState =
    | { kind: "idle" }
    | { kind: "submitting" }
    | { kind: "done"; label: string }
    | { kind: "error"; message: string };

function App({ options }: { options: FormOptions }): JSX.Element {
    const [state, setState] = useState<FormState>({ kind: "idle" });

    useEffect(() => {
        return onExtensionMessage((msg) => {
            if (msg.type === "submitDone") {
                setState({ kind: "done", label: msg.resultLabel });
            } else if (msg.type === "submitError") {
                setState({ kind: "error", message: msg.message });
            }
        });
    }, []);

    const onSubmittingChange = (submitting: boolean): void => {
        setState(submitting ? { kind: "submitting" } : { kind: "idle" });
    };

    if (options.form === "submitReview") {
        return (
            <SubmitReviewForm
                options={options}
                state={state}
                onSubmittingChange={onSubmittingChange}
            />
        );
    }
    if (options.form === "createTask") {
        return (
            <CreateTaskForm
                options={options}
                state={state}
                onSubmittingChange={onSubmittingChange}
            />
        );
    }
    if (options.form === "recordDecision") {
        return (
            <RecordDecisionForm
                options={options}
                state={state}
                onSubmittingChange={onSubmittingChange}
            />
        );
    }
    return <UnknownForm name={options.form} />;
}

function UnknownForm({ name }: { name: string }): JSX.Element {
    return (
        <div className="banner error">
            Unknown form &laquo;{name}&raquo;. Update the GovForge extension.
        </div>
    );
}

function pingError(msg: string): void {
    try {
        postToExtension({ type: "bootError", message: msg });
    } catch {
        /* best effort */
    }
}

window.addEventListener("error", (e) => {
    pingError(`window.error: ${e.message} @ ${e.filename}:${e.lineno}`);
});
window.addEventListener("unhandledrejection", (e) => {
    pingError(`unhandledrejection: ${String(e.reason)}`);
});

const root = document.getElementById("root");
try {
    if (!root) {
        document.body.appendChild(
            Object.assign(document.createElement("div"), {
                className: "banner error",
                textContent: "Boot error: #root not found",
            }),
        );
        pingError("#root not found");
    } else if (!window.__GF_FORM__) {
        createRoot(root).render(
            <div className="banner error">
                Boot error: window.__GF_FORM__ was not set by the extension host.
            </div>,
        );
        pingError("window.__GF_FORM__ was not set");
    } else {
        createRoot(root).render(
            <ErrorBoundary>
                <App options={window.__GF_FORM__} />
            </ErrorBoundary>,
        );
        // Boot-success ping so the Output channel can confirm script load.
        try {
            postToExtension({
                type: "boot",
                ok: true,
                form: window.__GF_FORM__.form,
            });
        } catch {
            /* best effort */
        }
    }
} catch (err) {
    const msg = err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err);
    if (root) {
        root.innerHTML = "";
        const div = document.createElement("div");
        div.className = "banner error";
        div.style.whiteSpace = "pre-wrap";
        div.textContent = `Boot crash: ${msg}`;
        root.appendChild(div);
    }
    pingError(`Boot crash: ${msg}`);
}
