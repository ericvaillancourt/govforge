package commands

import (
	"fmt"
	"strings"
	"time"

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
	var (
		token  string
		device bool
		label  string
		agent  string
	)
	c := &cobra.Command{
		Use:   "login",
		Short: "Sign in via device-code flow OR by saving a pasted token",
		Long: `Authenticate the CLI with GovForge.

Two flows are supported:

  $ gf auth login --device
      Opens a browser to https://govforge.dev/<lang>/device/ where you
      type the shown code, sign in (GitHub or Google), and authorize.
      The CLI polls until the page approves and saves the issued token.

  $ gf auth login --token gfp_…
      Pastes a token you already minted via the web UI at
      https://govforge.dev/en/account/. Same effect as the device flow
      but without the browser handshake — useful in scripts.`,
		RunE: func(cmd *cobra.Command, _ []string) error {
			if device {
				return runDeviceLogin(cmd, flags, label, agent)
			}
			t := strings.TrimSpace(token)
			if t == "" {
				return fmt.Errorf("missing --token (or use --device for the browser flow)")
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
	c.Flags().BoolVar(&device, "device", false, "Use the browser device-code flow")
	c.Flags().StringVar(&label, "label", "", "Label for the token created via --device (default: 'cli on <hostname>')")
	c.Flags().StringVar(&agent, "agent", "other", "Agent type for the token created via --device (human/claude/codex/cursor/cline/aider/other)")
	return c
}

// runDeviceLogin drives the gf auth login --device flow:
//
//  1. Calls POST /auth/device/code on api.govforge.dev
//  2. Prints the user code + verification URL
//  3. Polls /auth/device/poll every N seconds until approved or expired
//  4. Saves the resulting gfp_… token via auth.Save
func runDeviceLogin(cmd *cobra.Command, flags *RootFlags, label, agent string) error {
	ctx, err := Resolve(flags, false)
	if err != nil {
		return err
	}
	if label == "" {
		host, _ := osHostname()
		if host == "" {
			host = "workstation"
		}
		label = "cli on " + host
	}
	if agent == "" {
		agent = "other"
	}
	start, err := ctx.Client.DeviceCodeStart(client.DeviceCodeStartIn{
		Label:     label,
		AgentType: agent,
	})
	if err != nil {
		return err
	}
	out := ctx.Out
	out.Heading("Authorize this device")
	out.Detail("1. Open in your browser", start.VerificationURI+"?code="+stripDash(start.UserCode))
	out.Detail("2. Enter the code", start.UserCode)
	out.Detail("3. Sign in & authorize", "(GitHub or Google)")
	_, _ = fmt.Fprintln(cmd.OutOrStderr(), "")
	_, _ = fmt.Fprintln(cmd.OutOrStderr(), "Waiting for approval… (Ctrl+C to abort)")

	interval := time.Duration(start.Interval) * time.Second
	if interval <= 0 {
		interval = 5 * time.Second
	}
	deadline := time.Now().Add(time.Duration(start.ExpiresIn) * time.Second)
	for time.Now().Before(deadline) {
		time.Sleep(interval)
		poll, err := ctx.Client.DeviceCodePoll(start.DeviceCode)
		if err != nil {
			return err
		}
		switch poll.Status {
		case "authorization_pending":
			_, _ = fmt.Fprint(cmd.OutOrStderr(), ".")
			continue
		case "complete":
			_, _ = fmt.Fprintln(cmd.OutOrStderr(), "")
			path, err := auth.Save(poll.Token)
			if err != nil {
				return err
			}
			if out.JSON {
				return out.JSON1(map[string]string{"saved_to": path, "token_id": poll.TokenID})
			}
			out.Heading("Signed in")
			out.Detail("token saved to", path)
			out.Detail("token id", poll.TokenID)
			return nil
		case "expired":
			return fmt.Errorf("authorization expired before approval; re-run `gf auth login --device`")
		case "denied":
			return fmt.Errorf("authorization denied")
		default:
			return fmt.Errorf("unexpected status from server: %q", poll.Status)
		}
	}
	return fmt.Errorf("authorization timed out (>%ds) without approval", start.ExpiresIn)
}

func stripDash(s string) string { return strings.ReplaceAll(s, "-", "") }

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
