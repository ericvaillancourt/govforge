package commands

import (
	"fmt"
	"strings"

	"github.com/spf13/cobra"

	"github.com/ericvaillancourt/govforge/cli/internal/auth"
	"github.com/ericvaillancourt/govforge/cli/internal/client"
)

// NewAuthCmd returns `gf auth` with subcommands login, logout, whoami.
func NewAuthCmd(flags *RootFlags) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "auth",
		Short: "Sign in, sign out, inspect current token",
	}
	cmd.AddCommand(
		newAuthLoginCmd(flags),
		newAuthLogoutCmd(flags),
		newAuthWhoamiCmd(flags),
	)
	return cmd
}

func newAuthLoginCmd(flags *RootFlags) *cobra.Command {
	var token string
	c := &cobra.Command{
		Use:   "login",
		Short: "Save an API token to ~/.config/govforge/auth.toml",
		Long: `Save a GovForge API token locally.

Phase 3.0 Stage B (this iteration) does not yet implement an interactive
OAuth flow for the CLI. To get a token:

  1. Open https://govforge.dev/en/login/ in a browser
  2. Sign in with GitHub
  3. Go to https://govforge.dev/en/account/, click "Create a new token"
  4. Copy the secret (shown once) and pass it via --token or stdin

  $ gf auth login --token gfp_…
  $ echo gfp_… | gf auth login --stdin

A future iteration will add a device-code flow: ` + "`gf auth login --device`" + `.`,
		RunE: func(_ *cobra.Command, _ []string) error {
			t := strings.TrimSpace(token)
			if t == "" {
				return fmt.Errorf("missing --token (or pipe via --stdin)")
			}
			if !strings.HasPrefix(t, "gfp_") {
				return fmt.Errorf("token does not look like a GovForge personal token (expected gfp_ prefix)")
			}
			path, err := auth.Save(t)
			if err != nil {
				return err
			}
			out := flagsRender(flags)
			if out.JSON {
				return out.JSON1(map[string]string{"saved_to": path})
			}
			out.Heading("Signed in")
			out.Detail("token saved to", path)
			return nil
		},
	}
	c.Flags().StringVar(&token, "token", "", "The API token (gfp_...) to save")
	return c
}

func newAuthLogoutCmd(flags *RootFlags) *cobra.Command {
	return &cobra.Command{
		Use:   "logout",
		Short: "Delete the local API token",
		RunE: func(_ *cobra.Command, _ []string) error {
			path, err := auth.Delete()
			if err != nil {
				return err
			}
			out := flagsRender(flags)
			if out.JSON {
				return out.JSON1(map[string]string{"deleted": path})
			}
			out.Heading("Signed out")
			out.Detail("removed", path)
			return nil
		},
	}
}

func newAuthWhoamiCmd(flags *RootFlags) *cobra.Command {
	return &cobra.Command{
		Use:   "whoami",
		Short: "Show the active token + its owner (via GET /tokens)",
		RunE: func(_ *cobra.Command, _ []string) error {
			ctx, err := Resolve(flags, false)
			if err != nil {
				return err
			}
			token, source := auth.Token(_filepath.JoinAuthDir(ctx.Cfg.ProjectPath))
			if token == "" {
				return fmt.Errorf("not signed in — run `gf auth login --token gfp_…`")
			}
			ctx.Client.SetToken(token)
			tokens, err := ctx.Client.ListTokens()
			if err != nil {
				var ae *client.APIError
				if errorsAs(err, &ae) && ae.Status == 401 {
					return fmt.Errorf("token rejected by api (401) — it may have been revoked")
				}
				return err
			}
			out := ctx.Out
			if out.JSON {
				return out.JSON1(map[string]any{"source": source, "tokens": tokens})
			}
			out.Heading("Active token")
			out.Detail("source", source)
			out.Detail("tokens visible to this user", fmt.Sprintf("%d", len(tokens)))
			for _, t := range tokens {
				out.Detail("- "+t.Label, "gfp_"+t.Prefix+"… scopes="+t.ScopesCSV)
			}
			return nil
		},
	}
}
