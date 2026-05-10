package commands

import (
	"fmt"

	"github.com/spf13/cobra"
)

// NewProjectCmd returns `gf project` with subcommands status + config.
func NewProjectCmd(flags *RootFlags) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "project",
		Short: "Project status + configuration",
	}
	cmd.AddCommand(newProjectStatusCmd(flags), newProjectConfigCmd(flags))
	return cmd
}

func newProjectStatusCmd(flags *RootFlags) *cobra.Command {
	return &cobra.Command{
		Use:   "status",
		Short: "Show project status (path, db, API health)",
		RunE: func(_ *cobra.Command, _ []string) error {
			ctx, err := Resolve(flags, true)
			if err != nil {
				return err
			}
			out := ctx.Out
			if out.JSON {
				h, err := ctx.Client.Health()
				return out.JSON1(map[string]any{
					"project_path": ctx.Cfg.ProjectPath,
					"db_path":      ctx.Cfg.DBPath,
					"api_url":      ctx.Cfg.APIURL,
					"api":          h,
					"api_error":    errString(err),
				})
			}
			out.Heading("Project")
			out.Detail("path", ctx.Cfg.ProjectPath)
			out.Detail("database", ctx.Cfg.DBPath)
			out.Detail("api url", ctx.Cfg.APIURL)
			h, err := ctx.Client.Health()
			if err != nil {
				out.Detail("api", out.Status("unreachable")+" ("+err.Error()+")")
				return nil
			}
			out.Detail("api", out.Status(h.Status)+" — backend "+h.Version)
			return nil
		},
	}
}

func newProjectConfigCmd(flags *RootFlags) *cobra.Command {
	return &cobra.Command{
		Use:   "config",
		Short: "Print resolved configuration",
		RunE: func(_ *cobra.Command, _ []string) error {
			ctx, err := Resolve(flags, false)
			if err != nil {
				return err
			}
			out := ctx.Out
			if out.JSON {
				return out.JSON1(ctx.Cfg)
			}
			out.Heading("Configuration")
			out.Detail("project_path", ctx.Cfg.ProjectPath)
			out.Detail("db_path", ctx.Cfg.DBPath)
			out.Detail("api_url", ctx.Cfg.APIURL)
			out.Detail("json", fmt.Sprintf("%t", ctx.Cfg.JSON))
			out.Detail("no_color", fmt.Sprintf("%t", ctx.Cfg.NoColor))
			return nil
		},
	}
}

func errString(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}
