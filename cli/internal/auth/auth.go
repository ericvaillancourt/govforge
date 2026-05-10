// Package auth handles local storage of the user's API token for the CLI.
//
// Resolution order (later wins):
//  1. GOVFORGE_API_TOKEN environment variable
//  2. <project>/.govforge/auth.toml in the working tree (if found)
//  3. ~/.config/govforge/auth.toml (user-wide default)
//
// File format (TOML):
//
//	token = "gfp_..."
//
// Permissions: writes are always chmod 0600.
package auth

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const (
	EnvTokenVar  = "GOVFORGE_API_TOKEN"
	AuthFileName = "auth.toml"
)

// Token returns the resolved token + the source it came from. Empty token =
// the user is not signed in.
func Token(projectAuthDir string) (string, string) {
	if v := strings.TrimSpace(os.Getenv(EnvTokenVar)); v != "" {
		return v, "env:" + EnvTokenVar
	}
	if projectAuthDir != "" {
		p := filepath.Join(projectAuthDir, AuthFileName)
		if t, ok := readAuthFile(p); ok {
			return t, p
		}
	}
	if p := userConfigAuthPath(); p != "" {
		if t, ok := readAuthFile(p); ok {
			return t, p
		}
	}
	return "", ""
}

// Save writes `token` to the user-wide auth file (~/.config/govforge/auth.toml)
// and returns its absolute path. The file is chmod 0600.
func Save(token string) (string, error) {
	p := userConfigAuthPath()
	if p == "" {
		return "", fmt.Errorf("cannot resolve user config dir")
	}
	if err := os.MkdirAll(filepath.Dir(p), 0o700); err != nil {
		return "", err
	}
	content := fmt.Sprintf("token = %q\n", token)
	if err := os.WriteFile(p, []byte(content), 0o600); err != nil {
		return "", err
	}
	return p, nil
}

// Delete removes the user-wide auth file. Idempotent.
func Delete() (string, error) {
	p := userConfigAuthPath()
	if p == "" {
		return "", fmt.Errorf("cannot resolve user config dir")
	}
	err := os.Remove(p)
	if err != nil && !os.IsNotExist(err) {
		return p, err
	}
	return p, nil
}

func userConfigAuthPath() string {
	d, err := os.UserConfigDir()
	if err != nil || d == "" {
		return ""
	}
	return filepath.Join(d, "govforge", AuthFileName)
}

func readAuthFile(path string) (string, bool) {
	b, err := os.ReadFile(path)
	if err != nil {
		return "", false
	}
	for _, raw := range strings.Split(string(b), "\n") {
		line := strings.TrimSpace(raw)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, val, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		if strings.TrimSpace(key) != "token" {
			continue
		}
		// strip surrounding quotes
		t := strings.TrimSpace(val)
		t = strings.Trim(t, `"'`)
		if t == "" {
			return "", false
		}
		return t, true
	}
	return "", false
}
