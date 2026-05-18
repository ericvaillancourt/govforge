"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { api, APIError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useMe } from "@/lib/me";

/**
 * Human approval gate. Shows two buttons (Approve / Reject) plus an
 * optional comment field. On success the decision query is invalidated
 * so the surrounding page reflects the new status without a full reload.
 */
export function ApprovalActions({
  decisionId,
  status,
}: {
  decisionId: string;
  status: string;
}) {
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const [approver, setApprover] = useState("eric");
  const { hasScope } = useMe();

  const approve = useMutation({
    mutationFn: () =>
      api.decisions.approve(decisionId, {
        approver,
        comment: comment.trim() || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["decision", decisionId] });
      void qc.invalidateQueries({ queryKey: ["timeline", decisionId] });
    },
  });
  const reject = useMutation({
    mutationFn: () =>
      api.decisions.reject(decisionId, {
        approver,
        comment: comment.trim() || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["decision", decisionId] });
      void qc.invalidateQueries({ queryKey: ["timeline", decisionId] });
    },
  });

  const finalised = status === "approved" || status === "rejected";
  const error = (approve.error ?? reject.error) as APIError | Error | null;

  // Hide the section entirely when the active token can't approve.
  // Matches the VS Code v0.3 "no banner, just no button" UX — the
  // TokenGate chip already tells the user which scopes they have.
  // Scopes unknown (404 from /me on an older backend) → fall through
  // to the visible state so we don't regress UX on stale backends.
  if (!hasScope("approvals:write")) return null;

  return (
    <section className="surface space-y-3 p-4">
      <h2 className="text-sm font-medium">Human approval</h2>
      {finalised ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Decision is <strong>{status}</strong>. Further actions are recorded
          via a new decision.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span className="block text-[hsl(var(--muted-foreground))]">
                Approver
              </span>
              <input
                value={approver}
                onChange={(e) => setApprover(e.target.value)}
                className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1.5"
              />
            </label>
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="block text-[hsl(var(--muted-foreground))]">
                Comment (optional)
              </span>
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Why is this decision approved or rejected?"
                className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1.5"
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => approve.mutate()}
              disabled={approve.isPending || reject.isPending || !approver}
              className={cn(
                "rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-green-700",
                "disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              {approve.isPending ? "Approving…" : "Approve"}
            </button>
            <button
              type="button"
              onClick={() => reject.mutate()}
              disabled={approve.isPending || reject.isPending || !approver}
              className={cn(
                "rounded-md border border-red-600 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50",
                "disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              {reject.isPending ? "Rejecting…" : "Reject"}
            </button>
          </div>
          {error && (
            <p className="text-sm text-red-600">{error.message}</p>
          )}
        </>
      )}
    </section>
  );
}
