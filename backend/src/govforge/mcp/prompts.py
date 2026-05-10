"""MCP prompts — guide agents toward structured output.

Three prompts (devis.md §12):

- ``review_code_decision``  : produce structured findings for a diff.
- ``explain_disagreement``  : synthesise opposing positions for a human.
- ``summarize_decision``    : audit-ready summary of a closed decision.

Prompts are static text templates (no DB access). They take small string
arguments and return a single message body that the calling agent can
forward to its model.
"""

from __future__ import annotations

from fastmcp import FastMCP


def register_prompts(server: FastMCP) -> None:
    """Attach every prompt handler to the given FastMCP instance."""

    @server.prompt(name="review_code_decision")
    def review_code_decision(decision_id: str, focus: str = "security,tests,architecture") -> str:
        """Prompt the reviewer agent to produce structured findings for a decision."""
        return _REVIEW_PROMPT.format(decision_id=decision_id, focus=focus)

    @server.prompt(name="explain_disagreement")
    def explain_disagreement(decision_id: str) -> str:
        """Prompt the agent to synthesise opposing positions for a human reviewer."""
        return _DISAGREEMENT_PROMPT.format(decision_id=decision_id)

    @server.prompt(name="summarize_decision")
    def summarize_decision(decision_id: str) -> str:
        """Prompt the agent to produce an audit-ready summary of the decision."""
        return _SUMMARY_PROMPT.format(decision_id=decision_id)


_REVIEW_PROMPT = """\
You are reviewing decision {decision_id} for a coding agent's proposed change.

1. Read the attached diff and the decision summary/rationale via
   `get_decision_context`.
2. Focus your review on these areas: {focus}.
3. For each issue, produce a structured finding with:
   - severity: info | low | medium | high | critical
   - category: security | performance | architecture | bug | maintainability | tests
   - file_path + line range when applicable
   - message: the concrete problem (one sentence)
   - recommendation: the concrete fix (one sentence)
4. Avoid vague comments ("this could be better"). If you can't articulate
   a concrete recommendation, drop the finding.
5. Submit your review with `submit_review`. Status:
   - approved if no issues at severity >= medium,
   - changes_requested if any medium/high issues are addressable,
   - rejected only if the design itself is unsalvageable.
"""

_DISAGREEMENT_PROMPT = """\
You are mediating a disagreement on decision {decision_id}.

Use `get_decision_context` to load the decision, the latest reviews, and any
existing disagreements.

Produce a synthesis that contains:

1. **The actual conflict**: what specifically do the author and reviewer
   disagree on? Strip away surface phrasing and identify the underlying
   technical or design choice.
2. **Author's position**: a one-paragraph steelman of the author's view.
3. **Reviewer's position**: a one-paragraph steelman of the reviewer's view.
4. **Risk if the reviewer is right and we ship the author's version**:
   what happens? How likely? How recoverable?
5. **Questions for the human**: 2-4 specific questions the human should
   answer to resolve this. Each question should be answerable in one
   sentence.

Do not advocate for either side. Your job is to make the trade-off legible.
"""

_SUMMARY_PROMPT = """\
Produce an audit-ready summary of decision {decision_id}.

Use `get_decision_context` to load the full record. The summary must be
readable months later by someone who was not in the loop. Structure:

1. **What changed** (1-2 sentences): the concrete code modification.
2. **Why** (1-3 sentences): the motivation, including the rejected
   alternatives if any are recorded.
3. **Risks identified** (bullet list): each from a finding or policy result,
   with how it was addressed (mitigation, accepted, deferred).
4. **Approval chain**: who reviewed, who approved, who dissented; cite
   review IDs and approval IDs so the record is traceable.
5. **Final state**: decision status, commit hash, and the date of the last
   approval.

Do not speculate about effects not present in the record. If a field is
empty, write "n/a" rather than inferring.
"""


__all__ = ["register_prompts"]
