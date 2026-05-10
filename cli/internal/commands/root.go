package commands

import (
	"errors"
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"github.com/ericvaillancourt/govforge/cli/internal/client"
	"github.com/ericvaillancourt/govforge/cli/internal/config"
)

// Exit codes documented in devis.md:
//
//	0 — success
//	1 — user error (missing arg, bad flag)
//	2 — backend error (API returned 4xx/5xx)
//	3 — network/connectivity error
const (
	ExitOK         = 0
	ExitUserError  = 1
	ExitBackend    = 2
	ExitNetwork    = 3
	ExitInternal   = 4
)

// NewRoot builds the cobra command tree.
func NewRoot(version string) *cobra.Command {
	flags := &RootFlags{}

	root := &cobra.Command{
		Use:           "gf",
		Short:         "GovForge CLI — govern AI coding agents",
		Long:          "gf is the GovForge developer CLI. It talks to the local HTTP API on 127.0.0.1:8787 (started by `gf api serve`).",
		SilenceUsage:  true,
		SilenceErrors: true,
		Version:       version,
	}

	root.PersistentFlags().StringVar(&flags.APIURL, "api-url", "", "Override the local API URL (default: from .govforge/config.toml)")
	root.PersistentFlags().StringVar(&flags.Config, "config", "", "Path to a config.toml (overrides project autodetection)")
	root.PersistentFlags().BoolVar(&flags.JSON, "json", false, "Emit JSON instead of human-readable tables")
	root.PersistentFlags().BoolVar(&flags.NoColor, "no-color", false, "Disable ANSI styling")

	root.AddCommand(
		NewInitCmd(),
		NewProjectCmd(flags),
		NewTaskCmd(flags),
		NewDecisionCmd(flags),
		NewGitCmd(flags),
		NewPolicyCmd(flags),
		NewReviewCmd(flags),
		NewApproveCmd(flags),
		NewRejectCmd(flags),
		NewAuthCmd(flags),
		NewTokenCmd(flags),
		NewMCPCmd(flags),
		NewAPICmd(flags),
		NewUICmd(flags),
		NewVersionCmd(flags, version),
	)

	return root
}

// Execute runs the root command, mapping known error types to documented exit codes.
func Execute(version string) int {
	if err := NewRoot(version).Execute(); err != nil {
		return classifyError(err)
	}
	return ExitOK
}

func classifyError(err error) int {
	if err == nil {
		return ExitOK
	}
	var apiErr *client.APIError
	if errors.As(err, &apiErr) {
		fmt.Fprintln(os.Stderr, "Error:", err)
		return ExitBackend
	}
	if errors.Is(err, config.ErrNotInitialized) {
		fmt.Fprintln(os.Stderr, "Error:", err)
		return ExitUserError
	}
	// Heuristic: connection/timeout errors from resty surface as plain errors.
	if isNetworkError(err) {
		fmt.Fprintln(os.Stderr, "Error:", err)
		return ExitNetwork
	}
	fmt.Fprintln(os.Stderr, "Error:", err)
	return ExitUserError
}

func isNetworkError(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	for _, sig := range []string{"connection refused", "no such host", "dial tcp", "i/o timeout"} {
		if contains(msg, sig) {
			return true
		}
	}
	return false
}

func contains(haystack, needle string) bool {
	for i := 0; i+len(needle) <= len(haystack); i++ {
		if haystack[i:i+len(needle)] == needle {
			return true
		}
	}
	return false
}
