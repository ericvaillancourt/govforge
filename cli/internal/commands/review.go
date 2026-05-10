package commands

import (
	"github.com/spf13/cobra"

	"github.com/ericvaillancourt/govforge/cli/internal/client"
	"github.com/ericvaillancourt/govforge/cli/internal/render"
)

// NewReviewCmd returns `gf review` with subcommands request / list / show.
//
// `gf review submit` is intentionally omitted from Phase 1 CLI: submitting
// a structured review with multiple findings is the agent's responsibility
// and is exposed via the MCP `submit_review` tool. The CLI lists/inspects
// reviews and triggers the request — humans rarely submit by hand.
func NewReviewCmd(flags *RootFlags) *cobra.Command {
	cmd := &cobra.Command{Use: "review", Short: "Request and inspect reviews"}
	cmd.AddCommand(newReviewRequestCmd(flags), newReviewListCmd(flags), newReviewShowCmd(flags))
	return cmd
}

func newReviewRequestCmd(flags *RootFlags) *cobra.Command {
	var (
		decisionID string
		reviewer   string
		focusList  []string
	)
	cmd := &cobra.Command{
		Use:   "request",
		Short: "Request a review on a decision",
		RunE: func(_ *cobra.Command, _ []string) error {
			ctx, err := Resolve(flags, true)
			if err != nil {
				return err
			}
			updated, err := ctx.Client.RequestReview(client.RequestReviewInput{
				DecisionID:    decisionID,
				ReviewerAgent: reviewer,
				Focus:         focusList,
			})
			if err != nil {
				return err
			}
			if ctx.Out.JSON {
				return ctx.Out.JSON1(updated)
			}
			ctx.Out.Heading("Review requested")
			ctx.Out.Detail("decision", updated.DisplayID)
			ctx.Out.Detail("status", ctx.Out.Status(updated.Status))
			ctx.Out.Detail("reviewer", reviewer)
			return nil
		},
	}
	cmd.Flags().StringVar(&decisionID, "decision", "", "Decision display ID (required)")
	cmd.Flags().StringVar(&reviewer, "reviewer", "", "Reviewer agent name (required)")
	cmd.Flags().StringSliceVar(&focusList, "focus", nil, "Focus areas (e.g. security,tests)")
	_ = cmd.MarkFlagRequired("decision")
	_ = cmd.MarkFlagRequired("reviewer")
	return cmd
}

func newReviewListCmd(flags *RootFlags) *cobra.Command {
	var openOnly bool
	cmd := &cobra.Command{
		Use:   "list",
		Short: "List reviews",
		RunE: func(_ *cobra.Command, _ []string) error {
			ctx, err := Resolve(flags, true)
			if err != nil {
				return err
			}
			reviews, err := ctx.Client.ListReviews(ctx.Cfg.ProjectPath, openOnly)
			if err != nil {
				return err
			}
			rows := make([]render.Row, len(reviews))
			for i, r := range reviews {
				rows[i] = render.Row{
					r.DisplayID,
					ctx.Out.Status(r.Status),
					itoa(len(r.Findings)),
					render.Truncate(render.Strp(r.Summary), 60),
				}
			}
			return ctx.Out.JSONOrTable(reviews, []string{"ID", "Status", "Findings", "Summary"}, rows)
		},
	}
	cmd.Flags().BoolVar(&openOnly, "open", false, "Only reviews on decisions still in REVIEW_REQUIRED")
	return cmd
}

func newReviewShowCmd(flags *RootFlags) *cobra.Command {
	return &cobra.Command{
		Use:   "show REV-NNN",
		Short: "Show one review with its findings",
		Args:  cobra.ExactArgs(1),
		RunE: func(_ *cobra.Command, args []string) error {
			ctx, err := Resolve(flags, true)
			if err != nil {
				return err
			}
			r, err := ctx.Client.GetReview(args[0])
			if err != nil {
				return err
			}
			if ctx.Out.JSON {
				return ctx.Out.JSON1(r)
			}
			ctx.Out.Heading("Review " + r.DisplayID)
			ctx.Out.Detail("decision", r.DecisionID)
			ctx.Out.Detail("status", ctx.Out.Status(r.Status))
			ctx.Out.Detail("summary", render.Strp(r.Summary))
			if len(r.Findings) > 0 {
				rows := make([]render.Row, len(r.Findings))
				for i, f := range r.Findings {
					rows[i] = render.Row{ctx.Out.Status(f.Severity), f.Category, render.Strp(f.FilePath), f.Message}
				}
				_ = ctx.Out.Table([]string{"Severity", "Category", "File", "Message"}, rows)
			}
			return nil
		},
	}
}
