// Shared type contracts for the extension <-> webview message bus.
//
// Imported by both the extension host (src/forms/form-panel.ts) and the
// browser-side webview bundle (webview/index.tsx). Discriminated unions
// + a small enum of form names keep both sides honest.

import type {
    FindingInput,
    ReviewVerdict,
    Severity,
    FindingCat,
} from "../api/client";

export type FormName =
    | "submitReview"
    | "createTask"
    | "recordDecision"
    | "requestReview"
    | "recordDisagreement";

// -----------------------------------------------------------------------------
// Options the extension injects on form open. Each form picks the subset
// it actually needs. The full union lives here so the webview's router
// can type-narrow on `form`.
// -----------------------------------------------------------------------------

export interface SubmitReviewOptions {
    form: "submitReview";
    decisionId: string;
    decisionTitle: string;
    defaultReviewer: string;
    severities: Severity[];
    categories: FindingCat[];
    verdicts: ReviewVerdict[];
}

export interface CreateTaskOptions {
    form: "createTask";
    projectName: string;
    projectRootPath: string;
    defaultActor: string;
    riskLevels: Array<"low" | "medium" | "high" | "critical">;
}

export interface RecordDecisionOptions {
    form: "recordDecision";
    taskId: string;            // pre-selected; the form shows it locked
    taskTitle: string;
    defaultAuthor: string;
    riskLevels: Array<"low" | "medium" | "high" | "critical">;
}

export interface RequestReviewOptions {
    form: "requestReview";
    decisionId: string;
    decisionTitle: string;
}

export interface RecordDisagreementOptions {
    form: "recordDisagreement";
    decisionId: string;
    decisionTitle: string;
    defaultActor: string;
}

export type FormOptions =
    | SubmitReviewOptions
    | CreateTaskOptions
    | RecordDecisionOptions
    | RequestReviewOptions
    | RecordDisagreementOptions;

// -----------------------------------------------------------------------------
// Submission payloads — what the webview ships back when the user
// clicks Submit. Mirrors the existing client `*Input` types minus the
// fields the extension fills in (project_path, etc.).
// -----------------------------------------------------------------------------

export interface SubmitReviewPayload {
    reviewer_agent: string;
    status: ReviewVerdict;
    summary?: string;
    findings: FindingInput[];
}

export interface CreateTaskPayload {
    title: string;
    risk_level: "low" | "medium" | "high" | "critical";
    description?: string;
}

export interface RecordDecisionPayload {
    title: string;
    summary?: string;
    rationale?: string;
    risk_level: "low" | "medium" | "high" | "critical";
    human_approval_required: boolean;
}

export interface RequestReviewPayload {
    reviewer_agent: string;
    focus: string[];
}

export interface RecordDisagreementPayload {
    topic: string;
    author_position?: string;
    reviewer_position?: string;
    risk_summary?: string;
    requires_human_decision: boolean;
}

// -----------------------------------------------------------------------------
// Discriminated message unions
// -----------------------------------------------------------------------------

export type ToExtension =
    | { type: "submit"; form: "submitReview"; payload: SubmitReviewPayload }
    | { type: "submit"; form: "createTask"; payload: CreateTaskPayload }
    | { type: "submit"; form: "recordDecision"; payload: RecordDecisionPayload }
    | { type: "submit"; form: "requestReview"; payload: RequestReviewPayload }
    | { type: "submit"; form: "recordDisagreement"; payload: RecordDisagreementPayload }
    | { type: "boot"; ok: true; form: FormName }
    | { type: "bootError"; message: string }
    | { type: "cancel" };

export type ToWebview =
    | { type: "submitDone"; resultLabel: string }
    | { type: "submitError"; message: string };
