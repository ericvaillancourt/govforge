package commands

import (
	"errors"
	"path/filepath"

	"github.com/ericvaillancourt/govforge/cli/internal/render"
)

// flagsRender mirrors what Resolve() builds, but for commands that don't need
// to talk to the API at all (login/logout, before the token exists).
func flagsRender(flags *RootFlags) render.Output {
	return render.Default(flags.JSON, flags.NoColor)
}

// errorsAs is a thin wrapper around errors.As that returns false on nil.
func errorsAs(err error, target any) bool {
	if err == nil {
		return false
	}
	return errors.As(err, target)
}

// JoinAuthDir computes the .govforge/ directory used for per-project auth.toml.
// Empty input → empty output (no project context).
type joinAuthDirNs struct{}

// JoinAuthDir is a namespaced helper to keep filepath.Join out of the auth_cmd.go.
func (joinAuthDirNs) JoinAuthDir(projectPath string) string {
	if projectPath == "" {
		return ""
	}
	return filepath.Join(projectPath, ".govforge")
}

// filepath is shadowed by a local namespace so the auth_cmd.go can call
// filepath.JoinAuthDir(...). This is a deliberate cosmetic indirection so
// the calling site stays readable.
var filepathNs = joinAuthDirNs{}

// expose under the name "filepath" via a local alias. Go doesn't let us
// rename a package locally, so we expose the helper via the namespace
// value `_filepath` below and the call sites in auth_cmd.go use
// `_filepath.JoinAuthDir`.
//
// (The bare name `filepath` is reserved for the stdlib path package in this
// file, so we cannot reuse it.)
var _filepath = filepathNs
