package commands

import (
	"github.com/spf13/cobra"

	"github.com/ericvaillancourt/govforge/cli/internal/client"
	"github.com/ericvaillancourt/govforge/cli/internal/render"
)

// NewPolicyCmd returns `gf policy` with subcommands list + check.
func NewPolicyCmd(flags *RootFlags) *cobra.Command {
	cmd := &cobra.Command{Use: "policy", Short: "Inspect policies and run checks"}
	cmd.AddCommand(newPolicyListCmd(flags), newPolicyCheckCmd(flags))
	return cmd
}

func newPolicyListCmd(flags *RootFlags) *cobra.Command {
	return &cobra.Command{
		Use:   "list",
		Short: "List registered policies",
		RunE: func(_ *cobra.Command, _ []string) error {
			ctx, err := Resolve(flags, true)
			if err != nil {
				return err
			}
			policies, err := ctx.Client.ListPolicies()
			if err != nil {
				return err
			}
			rows := make([]render.Row, len(policies))
			for i, p := range policies {
				rows[i] = render.Row{p.Name, boolStr(p.Enabled), p.Severity, render.Strp(p.Description)}
			}
			return ctx.Out.JSONOrTable(policies, []string{"Name", "Enabled", "Severity", "Description"}, rows)
		},
	}
}

func newPolicyCheckCmd(flags *RootFlags) *cobra.Command {
	var decisionID string
	cmd := &cobra.Command{
		Use:   "check",
		Short: "Evaluate active policies against a decision",
		RunE: func(_ *cobra.Command, _ []string) error {
			ctx, err := Resolve(flags, true)
			if err != nil {
				return err
			}
			results, err := ctx.Client.CheckPolicies(client.CheckPoliciesInput{DecisionID: decisionID})
			if err != nil {
				return err
			}
			// Look up policy names so the table shows readable identifiers
			// instead of UUIDs. /policies is cheap (~5 rows).
			nameByID := map[string]string{}
			if policies, perr := ctx.Client.ListPolicies(); perr == nil {
				for _, p := range policies {
					nameByID[p.ID] = p.Name
				}
			}
			rows := make([]render.Row, len(results))
			for i, r := range results {
				name := nameByID[r.PolicyID]
				if name == "" {
					name = r.PolicyID
				}
				rows[i] = render.Row{name, ctx.Out.Status(r.Status), render.Strp(r.Message)}
			}
			return ctx.Out.JSONOrTable(results, []string{"Policy", "Status", "Message"}, rows)
		},
	}
	cmd.Flags().StringVar(&decisionID, "decision", "", "Decision display ID (required)")
	_ = cmd.MarkFlagRequired("decision")
	return cmd
}

func boolStr(b bool) string {
	if b {
		return "yes"
	}
	return "no"
}
