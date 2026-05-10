package commands

import (
	"github.com/spf13/cobra"

	"github.com/ericvaillancourt/govforge/cli/internal/client"
)

// NewApproveCmd returns `gf approve DEC-NNN [--comment]`.
func NewApproveCmd(flags *RootFlags) *cobra.Command {
	return newApprovalCmd(flags, "approve", "Approve a decision",
		func(c *client.Client, id string, in client.ApprovalInput) (any, error) {
			return c.ApproveDecision(id, in)
		})
}

// NewRejectCmd returns `gf reject DEC-NNN [--comment]`.
func NewRejectCmd(flags *RootFlags) *cobra.Command {
	return newApprovalCmd(flags, "reject", "Reject a decision",
		func(c *client.Client, id string, in client.ApprovalInput) (any, error) {
			return c.RejectDecision(id, in)
		})
}

func newApprovalCmd(
	flags *RootFlags,
	use, short string,
	call func(*client.Client, string, client.ApprovalInput) (any, error),
) *cobra.Command {
	var (
		approver string
		comment  string
	)
	cmd := &cobra.Command{
		Use:   use + " DEC-NNN",
		Short: short,
		Args:  cobra.ExactArgs(1),
		RunE: func(_ *cobra.Command, args []string) error {
			ctx, err := Resolve(flags, true)
			if err != nil {
				return err
			}
			in := client.ApprovalInput{Approver: approver}
			if comment != "" {
				in.Comment = &comment
			}
			result, err := call(ctx.Client, args[0], in)
			if err != nil {
				return err
			}
			if ctx.Out.JSON {
				return ctx.Out.JSON1(result)
			}
			d, err := ctx.Client.GetDecision(args[0])
			if err != nil {
				return err
			}
			ctx.Out.Heading("Decision " + d.DisplayID)
			ctx.Out.Detail("status", ctx.Out.Status(d.Status))
			if comment != "" {
				ctx.Out.Detail("comment", comment)
			}
			return nil
		},
	}
	cmd.Flags().StringVar(&approver, "approver", "eric", "Approver agent name")
	cmd.Flags().StringVar(&comment, "comment", "", "Approval comment")
	return cmd
}
