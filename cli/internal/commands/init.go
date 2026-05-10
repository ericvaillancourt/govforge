// Init implements `gf init` — bootstrap a project's .govforge/ directory.
package commands

import (
	"database/sql"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"
	_ "modernc.org/sqlite" // pure-Go SQLite driver, registered as "sqlite".

	"github.com/ericvaillancourt/govforge/cli/internal/config"
	"github.com/ericvaillancourt/govforge/cli/internal/embed"
)

// NewInitCmd returns the cobra command for `gf init`.
func NewInitCmd() *cobra.Command {
	var (
		projectName string
		force       bool
	)
	cmd := &cobra.Command{
		Use:   "init [path]",
		Short: "Initialize a .govforge/ directory in the current (or given) project",
		Long: `Create the .govforge/ scaffold in the project root:

  - .govforge/config.toml      — project config (api_url, name, branch)
  - .govforge/policies.toml    — default policy set (5 policies enabled)
  - .govforge/govforge.db      — SQLite database with the full schema

Re-run with --force to overwrite an existing .govforge/ directory.`,
		Args: cobra.MaximumNArgs(1),
		RunE: func(_ *cobra.Command, args []string) error {
			root, err := resolveRoot(args)
			if err != nil {
				return err
			}
			return runInit(root, projectName, force)
		},
	}
	cmd.Flags().StringVar(&projectName, "name", "", "Project name (defaults to directory name)")
	cmd.Flags().BoolVar(&force, "force", false, "Overwrite an existing .govforge/ directory")
	return cmd
}

func resolveRoot(args []string) (string, error) {
	if len(args) == 1 {
		abs, err := filepath.Abs(args[0])
		if err != nil {
			return "", err
		}
		return abs, nil
	}
	return os.Getwd()
}

func runInit(root, projectName string, force bool) error {
	paths := config.PathsFor(root)

	if _, err := os.Stat(paths.Dir); err == nil && !force {
		return fmt.Errorf("%s already exists (use --force to overwrite)", paths.Dir)
	}
	if err := os.MkdirAll(paths.Dir, 0o755); err != nil {
		return fmt.Errorf("create %s: %w", paths.Dir, err)
	}

	if projectName == "" {
		projectName = filepath.Base(root)
	}
	branch := detectDefaultBranch(root)

	if err := os.WriteFile(paths.Config, []byte(embed.RenderConfig(projectName, branch)), 0o644); err != nil {
		return fmt.Errorf("write %s: %w", paths.Config, err)
	}
	if err := os.WriteFile(paths.Policies, []byte(embed.DefaultPolicies()), 0o644); err != nil {
		return fmt.Errorf("write %s: %w", paths.Policies, err)
	}

	if err := createDatabase(paths.Database); err != nil {
		return fmt.Errorf("create database: %w", err)
	}

	fmt.Printf("Initialized GovForge project at %s\n", paths.Dir)
	fmt.Printf("  config:   %s\n", paths.Config)
	fmt.Printf("  policies: %s\n", paths.Policies)
	fmt.Printf("  database: %s\n", paths.Database)
	fmt.Println()
	fmt.Println("Next: `gf api serve` to start the local HTTP API.")
	return nil
}

// detectDefaultBranch best-effort: ask Git, fall back to "main".
func detectDefaultBranch(root string) string {
	if _, err := os.Stat(filepath.Join(root, ".git")); err != nil {
		return "main"
	}
	cmd := exec.Command("git", "-C", root, "symbolic-ref", "--short", "HEAD")
	out, err := cmd.Output()
	if err != nil {
		return "main"
	}
	branch := strings.TrimSpace(string(out))
	if branch == "" {
		return "main"
	}
	return branch
}

// createDatabase opens (or creates) the SQLite file and applies the embedded schema.
func createDatabase(path string) error {
	if _, err := os.Stat(path); err == nil {
		// Existing DB: leave it alone.
		return nil
	} else if !errors.Is(err, os.ErrNotExist) {
		return err
	}
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return err
	}
	defer db.Close()

	if _, err := db.Exec("PRAGMA foreign_keys = ON;"); err != nil {
		return err
	}
	for _, stmt := range splitStatements(embed.SchemaSQL()) {
		if strings.TrimSpace(stmt) == "" {
			continue
		}
		if _, err := db.Exec(stmt); err != nil {
			return fmt.Errorf("exec %q: %w", firstLine(stmt), err)
		}
	}
	return nil
}

// splitStatements splits the embedded schema on `;\n` boundaries. The dump
// uses a single `;` per statement followed by a blank line.
func splitStatements(sql string) []string {
	parts := strings.Split(sql, ";")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p+";")
		}
	}
	return out
}

func firstLine(s string) string {
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		return s[:i]
	}
	return s
}
