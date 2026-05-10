// Package embed bundles the static assets shipped inside the gf binary:
// the SQLite schema, the default policies file, and the config template.
package embed

import (
	_ "embed"
	"strings"
)

//go:embed assets/schema.sql
var schemaSQL string

//go:embed assets/policies.toml
var defaultPolicies string

//go:embed assets/config.toml
var configTemplate string

// SchemaSQL returns the SQLite DDL that creates every GovForge table + index.
//
// The bytes are dumped from SQLAlchemy's metadata in the backend. Drift is
// possible if the backend's models change without re-running the dump; CI
// runs a check that re-dumps and diffs against this file.
func SchemaSQL() string {
	return schemaSQL
}

// DefaultPolicies returns the default `.govforge/policies.toml` content.
func DefaultPolicies() string {
	return defaultPolicies
}

// RenderConfig fills the config.toml template with project-specific values.
func RenderConfig(projectName, defaultBranch string) string {
	out := configTemplate
	out = strings.ReplaceAll(out, "{{PROJECT_NAME}}", projectName)
	out = strings.ReplaceAll(out, "{{DEFAULT_BRANCH}}", defaultBranch)
	return out
}
