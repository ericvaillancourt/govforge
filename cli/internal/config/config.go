// Package config loads gf's runtime configuration.
//
// Resolution order (later wins):
//  1. Built-in defaults
//  2. .govforge/config.toml in the working tree (or any parent)
//  3. GOVFORGE_* environment variables
//  4. CLI flags (passed in by the cobra root command)
package config

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/viper"
)

// Config is the resolved set of runtime values used by every command.
type Config struct {
	// APIURL is the base URL of the local HTTP API (default 127.0.0.1:8787).
	APIURL string `mapstructure:"api_url"`
	// ProjectPath is the absolute path of the project root (where .govforge/ lives).
	ProjectPath string `mapstructure:"project_path"`
	// DBPath is the absolute path to the SQLite database file.
	DBPath string `mapstructure:"db_path"`
	// JSON forces machine-readable output. Set by the global --json flag.
	JSON bool `mapstructure:"json"`
	// NoColor disables ANSI styling. Honors NO_COLOR + --no-color.
	NoColor bool `mapstructure:"no_color"`
}

const (
	defaultAPIURL = "http://127.0.0.1:8787"
	configDir     = ".govforge"
	configFile    = "config.toml"
	dbFile        = "govforge.db"
	policiesFile  = "policies.toml"
)

// Defaults returns the built-in defaults (no project context).
func Defaults() *Config {
	return &Config{APIURL: defaultAPIURL}
}

// Load reads configuration from the project's .govforge/config.toml (if present),
// merges environment variables (GOVFORGE_*), and finally applies the explicit
// override values that the cobra root command parsed from --flags.
//
// `explicitOverrides` may contain any subset of {"api_url", "project_path",
// "json", "no_color"}; non-empty values win over both file and env.
func Load(explicitOverrides map[string]any) (*Config, error) {
	v := viper.New()
	v.SetDefault("api_url", defaultAPIURL)

	root, err := FindProjectRoot()
	if err != nil && !errors.Is(err, ErrNotInitialized) {
		return nil, err
	}
	if root != "" {
		v.SetConfigFile(filepath.Join(root, configDir, configFile))
		v.SetConfigType("toml")
		if err := v.ReadInConfig(); err != nil {
			// A missing file is OK; a malformed file is fatal.
			var notFound viper.ConfigFileNotFoundError
			if !errors.As(err, &notFound) && !os.IsNotExist(err) {
				return nil, fmt.Errorf("read %s: %w", v.ConfigFileUsed(), err)
			}
		}
		v.Set("project_path", root)
		v.Set("db_path", filepath.Join(root, configDir, dbFile))
	}

	v.SetEnvPrefix("GOVFORGE")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	for k, val := range explicitOverrides {
		if isMeaningful(val) {
			v.Set(k, val)
		}
	}

	if os.Getenv("NO_COLOR") != "" {
		v.Set("no_color", true)
	}

	cfg := &Config{}
	if err := v.Unmarshal(cfg); err != nil {
		return nil, fmt.Errorf("unmarshal config: %w", err)
	}
	if cfg.APIURL == "" {
		cfg.APIURL = defaultAPIURL
	}
	return cfg, nil
}

// isMeaningful filters out zero-values that would falsely override file/env.
func isMeaningful(val any) bool {
	switch v := val.(type) {
	case string:
		return v != ""
	case bool:
		return v
	default:
		return val != nil
	}
}

// ErrNotInitialized indicates that no .govforge/ directory could be found
// in the current working tree.
var ErrNotInitialized = errors.New("not a govforge project (no .govforge/ found)")

// FindProjectRoot walks up from the current working directory looking for
// the nearest .govforge/ directory. Returns ErrNotInitialized if none.
func FindProjectRoot() (string, error) {
	cwd, err := os.Getwd()
	if err != nil {
		return "", err
	}
	dir := cwd
	for {
		candidate := filepath.Join(dir, configDir)
		info, err := os.Stat(candidate)
		if err == nil && info.IsDir() {
			return dir, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", ErrNotInitialized
		}
		dir = parent
	}
}

// Paths returns the canonical sub-paths inside a project's .govforge/.
type Paths struct {
	Root     string
	Dir      string
	Config   string
	Database string
	Policies string
}

// PathsFor builds a Paths value from a project root.
func PathsFor(root string) Paths {
	d := filepath.Join(root, configDir)
	return Paths{
		Root:     root,
		Dir:      d,
		Config:   filepath.Join(d, configFile),
		Database: filepath.Join(d, dbFile),
		Policies: filepath.Join(d, policiesFile),
	}
}
