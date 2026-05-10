package commands

import (
	"github.com/spf13/cobra"

	"github.com/ericvaillancourt/govforge/cli/internal/client"
	"github.com/ericvaillancourt/govforge/cli/internal/render"
)

// NewDecisionCmd returns `gf decision` with create / show / timeline / list.
func NewDecisionCmd(flags *RootFlags) *cobra.Command {
	cmd := &cobra.Command{Use: "decision", Short: "Manage decisions"}
	cmd.AddCommand(
		newDecisionCreateCmd(flags),
		newDecisionListCmd(flags),
		newDecisionShowCmd(flags),
		newDecisionTimelineCmd(flags),
	)
	return cmd
}

func newDecisionCreateCmd(flags *RootFlags) *cobra.Command {
	var (
		taskID    string
		author    string
		title     string
		summary   string
		rationale string
		risk      string
		human     bool
	)
	cmd := &cobra.Command{
		Use:   "create",
		Short: "Create a decision linked to a task",
		RunE: func(_ *cobra.Command, _ []string) error {
			ctx, err := Resolve(flags, true)
			if err != nil {
				return err
			}
			in := client.CreateDecisionInput{
				TaskID:                taskID,
				AuthorAgent:           author,
				Title:                 title,
				RiskLevel:             risk,
				HumanApprovalRequired: human,
			}
			if summary != "" {
				in.Summary = &summary
			}
			if rationale != "" {
				in.Rationale = &rationale
			}
			d, err := ctx.Client.CreateDecision(in)
			if err != nil {
				return err
			}
			if ctx.Out.JSON {
				return ctx.Out.JSON1(d)
			}
			ctx.Out.Heading("Decision created")
			ctx.Out.Detail("id", d.DisplayID)
			ctx.Out.Detail("title", d.Title)
			ctx.Out.Detail("risk", d.RiskLevel)
			ctx.Out.Detail("status", ctx.Out.Status(d.Status))
			return nil
		},
	}
	cmd.Flags().StringVar(&taskID, "task", "", "Task display ID (required, e.g. TASK-001)")
	cmd.Flags().StringVar(&author, "author", "", "Author agent name (required)")
	cmd.Flags().StringVar(&title, "title", "", "Decision title (required)")
	cmd.Flags().StringVar(&summary, "summary", "", "One-paragraph summary")
	cmd.Flags().StringVar(&rationale, "rationale", "", "Why this decision over alternatives")
	cmd.Flags().StringVar(&risk, "risk", "medium", "Risk level: low|medium|high|critical")
	cmd.Flags().BoolVar(&human, "human-approval", false, "Require explicit human approval")
	_ = cmd.MarkFlagRequired("task")
	_ = cmd.MarkFlagRequired("author")
	_ = cmd.MarkFlagRequired("title")
	return cmd
}

func newDecisionListCmd(flags *RootFlags) *cobra.Command {
	var status string
	cmd := &cobra.Command{
		Use:   "list",
		Short: "List decisions",
		RunE: func(_ *cobra.Command, _ []string) error {
			ctx, err := Resolve(flags, true)
			if err != nil {
				return err
			}
			ds, err := ctx.Client.ListDecisions(ctx.Cfg.ProjectPath, status)
			if err != nil {
				return err
			}
			rows := make([]render.Row, len(ds))
			for i, d := range ds {
				rows[i] = render.Row{d.DisplayID, d.Title, d.RiskLevel, ctx.Out.Status(d.Status)}
			}
			return ctx.Out.JSONOrTable(ds, []string{"ID", "Title", "Risk", "Status"}, rows)
		},
	}
	cmd.Flags().StringVar(&status, "status", "", "Filter by status")
	return cmd
}

func newDecisionShowCmd(flags *RootFlags) *cobra.Command {
	return &cobra.Command{
		Use:   "show DEC-NNN",
		Short: "Show one decision by display ID",
		Args:  cobra.ExactArgs(1),
		RunE: func(_ *cobra.Command, args []string) error {
			ctx, err := Resolve(flags, true)
			if err != nil {
				return err
			}
			d, err := ctx.Client.GetDecision(args[0])
			if err != nil {
				return err
			}
			if ctx.Out.JSON {
				return ctx.Out.JSON1(d)
			}
			ctx.Out.Heading("Decision " + d.DisplayID)
			ctx.Out.Detail("title", d.Title)
			ctx.Out.Detail("risk", d.RiskLevel)
			ctx.Out.Detail("status", ctx.Out.Status(d.Status))
			ctx.Out.Detail("summary", render.Strp(d.Summary))
			ctx.Out.Detail("rationale", render.Strp(d.Rationale))
			return nil
		},
	}
}

func newDecisionTimelineCmd(flags *RootFlags) *cobra.Command {
	return &cobra.Command{
		Use:   "timeline DEC-NNN",
		Short: "Show the chronological event timeline",
		Args:  cobra.ExactArgs(1),
		RunE: func(_ *cobra.Command, args []string) error {
			ctx, err := Resolve(flags, true)
			if err != nil {
				return err
			}
			events, err := ctx.Client.GetDecisionTimeline(args[0])
			if err != nil {
				return err
			}
			rows := make([]render.Row, len(events))
			for i, e := range events {
				rows[i] = render.Row{
					e.CreatedAt.Format("2006-01-02 15:04:05"),
					e.EntityType,
					e.EventType,
				}
			}
			return ctx.Out.JSONOrTable(events, []string{"At", "Entity", "Event"}, rows)
		},
	}
}
