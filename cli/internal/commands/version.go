package commands

import (
	"github.com/spf13/cobra"
)

// NewVersionCmd returns `gf version`. Reports the CLI version (set at build
// time via -ldflags) plus the backend version reported by `/health` if the
// API is reachable.
func NewVersionCmd(flags *RootFlags, cliVersion string) *cobra.Command {
	return &cobra.Command{
		Use:   "version",
		Short: "Print CLI and detected backend version",
		RunE: func(_ *cobra.Command, _ []string) error {
			ctx, err := Resolve(flags, false)
			if err != nil {
				return err
			}
			h, herr := ctx.Client.Health()
			if ctx.Out.JSON {
				payload := map[string]any{
					"cli":     cliVersion,
					"backend": nil,
				}
				if h != nil {
					payload["backend"] = h
				}
				if herr != nil {
					payload["backend_error"] = herr.Error()
				}
				return ctx.Out.JSON1(payload)
			}
			ctx.Out.Heading("gf")
			ctx.Out.Detail("cli", cliVersion)
			if herr != nil {
				ctx.Out.Detail("backend", "unreachable ("+herr.Error()+")")
				return nil
			}
			ctx.Out.Detail("backend", h.Version+" ("+h.Status+")")
			return nil
		},
	}
}
