package commands

import (
	"fmt"
	"strings"

	"github.com/spf13/cobra"

	"github.com/ericvaillancourt/govforge/cli/internal/client"
)

// NewTokenCmd returns `gf token` with subcommands list, create, revoke.
func NewTokenCmd(flags *RootFlags) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "token",
		Short: "Create / list / revoke API tokens",
	}
	cmd.AddCommand(
		newTokenListCmd(flags),
		newTokenCreateCmd(flags),
		newTokenRevokeCmd(flags),
	)
	return cmd
}

func newTokenListCmd(flags *RootFlags) *cobra.Command {
	return &cobra.Command{
		Use:   "list",
		Short: "List your API tokens",
		RunE: func(_ *cobra.Command, _ []string) error {
			ctx, err := Resolve(flags, false)
			if err != nil {
				return err
			}
			tokens, err := ctx.Client.ListTokens()
			if err != nil {
				return err
			}
			out := ctx.Out
			if out.JSON {
				return out.JSON1(tokens)
			}
			out.Heading("API tokens")
			if len(tokens) == 0 {
				out.Detail("(none)", "")
				return nil
			}
			for _, t := range tokens {
				status := "active"
				if t.RevokedAt != nil {
					status = "revoked"
				}
				out.Detail(
					t.Label,
					fmt.Sprintf("gfp_%s… %s %s scopes=%s", t.Prefix, t.AgentType, status, t.ScopesCSV),
				)
			}
			return nil
		},
	}
}

func newTokenCreateCmd(flags *RootFlags) *cobra.Command {
	var (
		label     string
		agent     string
		scopesStr string
		expDays   int
	)
	c := &cobra.Command{
		Use:   "create",
		Short: "Create a new API token (secret shown once)",
		RunE: func(_ *cobra.Command, _ []string) error {
			if label == "" {
				return fmt.Errorf("missing --label")
			}
			if agent == "" {
				agent = "other"
			}
			if scopesStr == "" {
				return fmt.Errorf("missing --scopes (comma-separated, e.g. decisions:write,reviews:read)")
			}
			scopes := splitCSV(scopesStr)
			in := client.TokenCreateIn{
				Label:     label,
				AgentType: agent,
				Scopes:    scopes,
			}
			if expDays > 0 {
				in.ExpiresInDays = &expDays
			}
			ctx, err := Resolve(flags, false)
			if err != nil {
				return err
			}
			created, err := ctx.Client.CreateToken(in)
			if err != nil {
				return err
			}
			out := ctx.Out
			if out.JSON {
				return out.JSON1(created)
			}
			out.Heading("Token created")
			out.Detail("id", created.Token.ID)
			out.Detail("label", created.Token.Label)
			out.Detail("agent", created.Token.AgentType)
			out.Detail("scopes", created.Token.ScopesCSV)
			out.Detail("secret (shown once)", created.Secret)
			return nil
		},
	}
	c.Flags().StringVar(&label, "label", "", "Human-readable label, e.g. \"claude on my laptop\"")
	c.Flags().StringVar(&agent, "agent", "other", "Agent type (human/claude/codex/cursor/cline/aider/other)")
	c.Flags().StringVar(&scopesStr, "scopes", "", "Comma-separated scopes (e.g. decisions:write,reviews:read)")
	c.Flags().IntVar(&expDays, "expires-in-days", 0, "Token expiration in days (0 = never)")
	return c
}

func newTokenRevokeCmd(flags *RootFlags) *cobra.Command {
	return &cobra.Command{
		Use:   "revoke <token-id>",
		Short: "Revoke a token by its UUID",
		Args:  cobra.ExactArgs(1),
		RunE: func(_ *cobra.Command, args []string) error {
			ctx, err := Resolve(flags, false)
			if err != nil {
				return err
			}
			if err := ctx.Client.RevokeToken(args[0]); err != nil {
				return err
			}
			out := ctx.Out
			if out.JSON {
				return out.JSON1(map[string]string{"revoked": args[0]})
			}
			out.Heading("Token revoked")
			out.Detail("id", args[0])
			return nil
		},
	}
}

func splitCSV(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		v := strings.TrimSpace(p)
		if v != "" {
			out = append(out, v)
		}
	}
	return out
}
