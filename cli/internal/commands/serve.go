package commands

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/spf13/cobra"
)

// NewMCPCmd returns `gf mcp serve` — spawns `python -m govforge.mcp.server`.
func NewMCPCmd(flags *RootFlags) *cobra.Command {
	cmd := &cobra.Command{Use: "mcp", Short: "MCP server controls"}
	cmd.AddCommand(newMCPServeCmd(flags))
	return cmd
}

func newMCPServeCmd(flags *RootFlags) *cobra.Command {
	return &cobra.Command{
		Use:   "serve",
		Short: "Start the FastMCP server (stdio transport)",
		RunE: func(_ *cobra.Command, _ []string) error {
			ctx, err := Resolve(flags, false)
			if err != nil {
				return err
			}
			return runPython(ctx.Cfg.DBPath, "-m", "govforge.mcp.server")
		},
	}
}

// NewAPICmd returns `gf api serve` — spawns the FastAPI uvicorn entrypoint.
func NewAPICmd(flags *RootFlags) *cobra.Command {
	cmd := &cobra.Command{Use: "api", Short: "Local HTTP API controls"}
	cmd.AddCommand(newAPIServeCmd(flags))
	return cmd
}

func newAPIServeCmd(flags *RootFlags) *cobra.Command {
	var (
		host string
		port int
	)
	cmd := &cobra.Command{
		Use:   "serve",
		Short: "Start the local HTTP API on 127.0.0.1:8787",
		RunE: func(_ *cobra.Command, _ []string) error {
			ctx, err := Resolve(flags, false)
			if err != nil {
				return err
			}
			env := []string{
				"GOVFORGE_API_HOST=" + host,
				fmt.Sprintf("GOVFORGE_API_PORT=%d", port),
			}
			return runPythonWithEnv(ctx.Cfg.DBPath, env, "-m", "govforge.api.server")
		},
	}
	cmd.Flags().StringVar(&host, "host", "127.0.0.1", "Bind host")
	cmd.Flags().IntVar(&port, "port", 8787, "Bind port")
	return cmd
}

// NewUICmd returns `gf ui serve` — runs the cockpit UI build.
//
// Phase 1 keeps this lightweight: it shells out to `next start` in the
// `ui/` directory at the project root if it exists. Phase 3 will replace
// this with a packaged static binary.
func NewUICmd(flags *RootFlags) *cobra.Command {
	cmd := &cobra.Command{Use: "ui", Short: "Local UI controls"}
	cmd.AddCommand(newUIServeCmd(flags))
	return cmd
}

func newUIServeCmd(flags *RootFlags) *cobra.Command {
	return &cobra.Command{
		Use:   "serve",
		Short: "Start the cockpit UI (next start)",
		RunE: func(_ *cobra.Command, _ []string) error {
			ctx, err := Resolve(flags, true)
			if err != nil {
				return err
			}
			uiDir := filepath.Join(ctx.Cfg.ProjectPath, "ui")
			if _, err := os.Stat(uiDir); err != nil {
				return fmt.Errorf("no ui/ directory at %s — Phase 1 UI not yet bundled with the CLI", uiDir)
			}
			c := exec.Command("npx", "next", "start")
			c.Dir = uiDir
			c.Stdout, c.Stderr, c.Stdin = os.Stdout, os.Stderr, os.Stdin
			return c.Run()
		},
	}
}

// runPython spawns the `python` interpreter with the given module/args
// and inherits stdio so the user sees the server's logs directly.
func runPython(dbPath string, args ...string) error {
	return runPythonWithEnv(dbPath, nil, args...)
}

func runPythonWithEnv(dbPath string, extraEnv []string, args ...string) error {
	c := exec.Command("python", args...)
	c.Stdout, c.Stderr, c.Stdin = os.Stdout, os.Stderr, os.Stdin
	c.Env = append(os.Environ(), "GOVFORGE_DB="+dbPath)
	c.Env = append(c.Env, extraEnv...)
	return c.Run()
}
