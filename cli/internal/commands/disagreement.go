package commands

import (
	"github.com/spf13/cobra"

	"github.com/ericvaillancourt/govforge/cli/internal/client"
	"github.com/ericvaillancourt/govforge/cli/internal/render"
)

// NewDisagreementCmd returns `gf disagreement` with subcommands record / list.
//
// Wraps the disagreement HTTP API (added in Stage C item C follow-up) so a
// non-agent caller — CI pipelines, demos, devs without an MCP client — can
// record a structured disagreement. Agents still get the equivalent MCP
// `record_disagreement` tool, which shares the backend service layer.
func NewDisagreementCmd(flags *RootFlags) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "disagreement",
		Aliases: []string{"dis"},
		Short:   "Record and list structured disagreements on a decision",
	}
	cmd.AddCommand(
		newDisagreementRecordCmd(flags),
		newDisagreementListCmd(flags),
	)
	return cmd
}

func newDisagreementRecordCmd(flags *RootFlags) *cobra.Command {
	var (
		decisionID            string
		topic                 string
		authorPosition        string
		reviewerPosition      string
		riskSummary           string
		requiresHumanDecision bool
		actor                 string
	)
	cmd := &cobra.Command{
		Use:   "record",
		Short: "Record a structured disagreement on a decision",
		RunE: func(_ *cobra.Command, _ []string) error {
			ctx, err := Resolve(flags, true)
			if err != nil {
				return err
			}
			in := client.DisagreementRecordInput{
				DecisionID:            decisionID,
				Topic:                 topic,
				RequiresHumanDecision: requiresHumanDecision,
			}
			if authorPosition != "" {
				in.AuthorPosition = strPtr(authorPosition)
			}
			if reviewerPosition != "" {
				in.ReviewerPosition = strPtr(reviewerPosition)
			}
			if riskSummary != "" {
				in.RiskSummary = strPtr(riskSummary)
			}
			if actor != "" {
				in.ActorAgent = strPtr(actor)
			}
			d, err := ctx.Client.RecordDisagreement(in)
			if err != nil {
				return err
			}
			if ctx.Out.JSON {
				return ctx.Out.JSON1(d)
			}
			ctx.Out.Heading("Disagreement recorded")
			ctx.Out.Detail("id", d.ID)
			ctx.Out.Detail("decision", d.DecisionID)
			ctx.Out.Detail("topic", d.Topic)
			if d.RequiresHumanDecision {
				ctx.Out.Detail("requires human", "yes")
			}
			return nil
		},
	}
	cmd.Flags().StringVar(&decisionID, "decision", "", "Decision display ID (required)")
	cmd.Flags().StringVar(&topic, "topic", "", "One-line topic of the disagreement (required)")
	cmd.Flags().StringVar(&authorPosition, "author-position", "", "Author's position")
	cmd.Flags().StringVar(&reviewerPosition, "reviewer-position", "", "Reviewer's position")
	cmd.Flags().StringVar(&riskSummary, "risk-summary", "", "One-line risk summary")
	cmd.Flags().BoolVar(&requiresHumanDecision, "requires-human", true,
		"Whether this disagreement needs a human to break the tie")
	cmd.Flags().StringVar(&actor, "actor", "", "Actor agent name for the audit log")
	_ = cmd.MarkFlagRequired("decision")
	_ = cmd.MarkFlagRequired("topic")
	return cmd
}

func newDisagreementListCmd(flags *RootFlags) *cobra.Command {
	var decisionID string
	cmd := &cobra.Command{
		Use:   "list",
		Short: "List disagreements on a decision",
		RunE: func(_ *cobra.Command, _ []string) error {
			ctx, err := Resolve(flags, true)
			if err != nil {
				return err
			}
			rows, err := ctx.Client.ListDisagreements(decisionID)
			if err != nil {
				return err
			}
			renderRows := make([]render.Row, len(rows))
			for i, d := range rows {
				status := "open"
				if d.ResolvedAt != nil {
					status = "resolved"
				}
				renderRows[i] = render.Row{
					render.Truncate(d.Topic, 60),
					status,
					ynBool(d.RequiresHumanDecision),
				}
			}
			return ctx.Out.JSONOrTable(rows,
				[]string{"Topic", "Status", "Needs Human"},
				renderRows,
			)
		},
	}
	cmd.Flags().StringVar(&decisionID, "decision", "", "Decision display ID (required)")
	_ = cmd.MarkFlagRequired("decision")
	return cmd
}

func ynBool(b bool) string {
	if b {
		return "yes"
	}
	return "no"
}
