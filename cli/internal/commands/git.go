package commands

import (
	"github.com/spf13/cobra"

	"github.com/ericvaillancourt/govforge/cli/internal/client"
)

// NewGitCmd returns `gf git` with subcommands attach + diff.
//
// Phase 1: `gf git attach` POSTs to /decisions/{id}/attach-git which runs
// the read-only Git extractor on the backend. `gf git diff` is a thin
// re-render of the resulting GitChange — there is no separate diff route
// in Phase 1, so we just print the metadata.
func NewGitCmd(flags *RootFlags) *cobra.Command {
	cmd := &cobra.Command{Use: "git", Short: "Attach Git changes to decisions"}
	cmd.AddCommand(newGitAttachCmd(flags), newGitDiffCmd(flags))
	return cmd
}

func newGitAttachCmd(flags *RootFlags) *cobra.Command {
	var (
		decisionID string
		commit     string
		actor      string
	)
	cmd := &cobra.Command{
		Use:   "attach",
		Short: "Run the Git extractor and persist a GitChange",
		RunE: func(_ *cobra.Command, _ []string) error {
			ctx, err := Resolve(flags, true)
			if err != nil {
				return err
			}
			in := client.AttachGitInput{
				RepoPath:   ctx.Cfg.ProjectPath,
				CommitHash: commit,
			}
			if actor != "" {
				in.ActorAgent = &actor
			}
			gc, err := ctx.Client.AttachGit(decisionID, in)
			if err != nil {
				return err
			}
			if ctx.Out.JSON {
				return ctx.Out.JSON1(gc)
			}
			ctx.Out.Heading("Git change attached")
			ctx.Out.Detail("decision", decisionID)
			ctx.Out.Detail("commit", gc.CommitHash)
			ctx.Out.Detail("files", joinStrings(gc.FilesChanged))
			ctx.Out.Detail("insertions", itoa(gc.Insertions))
			ctx.Out.Detail("deletions", itoa(gc.Deletions))
			return nil
		},
	}
	cmd.Flags().StringVar(&decisionID, "decision", "", "Decision display ID (required)")
	cmd.Flags().StringVar(&commit, "commit", "HEAD", "Commit ref to attach (default: HEAD)")
	cmd.Flags().StringVar(&actor, "actor", "", "Acting agent (e.g. claude)")
	_ = cmd.MarkFlagRequired("decision")
	return cmd
}

func newGitDiffCmd(flags *RootFlags) *cobra.Command {
	var decisionID string
	cmd := &cobra.Command{
		Use:   "diff",
		Short: "Show the GitChange metadata attached to a decision",
		RunE: func(_ *cobra.Command, _ []string) error {
			ctx, err := Resolve(flags, true)
			if err != nil {
				return err
			}
			d, err := ctx.Client.GetDecision(decisionID)
			if err != nil {
				return err
			}
			// Phase 1: the decision payload doesn't embed git_change; surface what we have.
			if ctx.Out.JSON {
				return ctx.Out.JSON1(d)
			}
			ctx.Out.Heading("Decision " + d.DisplayID)
			ctx.Out.Detail("title", d.Title)
			ctx.Out.Detail("status", ctx.Out.Status(d.Status))
			ctx.Out.Detail("note", "Use `gf git attach` to refresh the attached commit; full diff text is not exposed in Phase 1.")
			return nil
		},
	}
	cmd.Flags().StringVar(&decisionID, "decision", "", "Decision display ID (required)")
	_ = cmd.MarkFlagRequired("decision")
	return cmd
}

func joinStrings(xs []string) string {
	out := ""
	for i, x := range xs {
		if i > 0 {
			out += ", "
		}
		out += x
	}
	return out
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		buf[i] = '-'
	}
	return string(buf[i:])
}
