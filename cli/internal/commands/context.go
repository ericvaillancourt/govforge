// Package commands implements every cobra subcommand of `gf`.
//
// The package follows a simple pattern:
//
//   - `NewRoot()` builds the cobra tree and parses global flags into `RootFlags`.
//   - Each command's RunE calls `Resolve(rootFlags)` to obtain a CmdContext
//     (config + HTTP client + render output).
//   - Commands then call client methods and hand the results to render.
//
// This keeps the side-effect boundary in one place (Resolve) and makes the
// per-command code easy to read end-to-end.
package commands

import (
	"errors"
	"fmt"
	"path/filepath"

	"github.com/ericvaillancourt/govforge/cli/internal/auth"
	"github.com/ericvaillancourt/govforge/cli/internal/client"
	"github.com/ericvaillancourt/govforge/cli/internal/config"
	"github.com/ericvaillancourt/govforge/cli/internal/render"
)

// RootFlags carries the values set by global flags on the root cobra command.
type RootFlags struct {
	APIURL  string
	Config  string
	JSON    bool
	NoColor bool
}

// CmdContext is the shared context passed to every subcommand.
type CmdContext struct {
	Cfg    *config.Config
	Client *client.Client
	Out    render.Output
}

// Resolve loads the config (file + env + flags) and builds the HTTP client.
//
// `requireProject` reports whether the command needs to be run inside an
// initialized GovForge project. Commands like `gf init` or `gf version`
// pass false.
func Resolve(flags *RootFlags, requireProject bool) (*CmdContext, error) {
	overrides := map[string]any{
		"api_url":  flags.APIURL,
		"json":     flags.JSON,
		"no_color": flags.NoColor,
	}
	cfg, err := config.Load(overrides)
	if err != nil {
		if errors.Is(err, config.ErrNotInitialized) && requireProject {
			return nil, fmt.Errorf("%w — run `gf init` first", err)
		}
		if !errors.Is(err, config.ErrNotInitialized) {
			return nil, err
		}
	}
	if requireProject && cfg.ProjectPath == "" {
		return nil, fmt.Errorf("%w — run `gf init` first", config.ErrNotInitialized)
	}
	out := render.Default(cfg.JSON, cfg.NoColor)
	var projectAuthDir string
	if cfg.ProjectPath != "" {
		projectAuthDir = filepath.Join(cfg.ProjectPath, ".govforge")
	}
	token, _ := auth.Token(projectAuthDir)
	return &CmdContext{
		Cfg:    cfg,
		Client: client.NewWithToken(cfg.APIURL, token),
		Out:    out,
	}, nil
}
