import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { FormOptions } from "../src/forms/messages";
import { onExtensionMessage } from "./api";
import { CreateTaskForm } from "./forms/CreateTaskForm";
import { RecordDecisionForm } from "./forms/RecordDecisionForm";
import { SubmitReviewForm } from "./forms/SubmitReviewForm";
import "./styles.css";

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

const root = document.getElementById("root");
if (root && window.__GF_FORM__) {
    createRoot(root).render(<App options={window.__GF_FORM__} />);
}
