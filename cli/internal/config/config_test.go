package config

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

// chdir changes cwd for the duration of t and restores it on cleanup.
func chdir(t *testing.T, dir string) {
	t.Helper()
	old, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(dir); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chdir(old) })
}

func TestFindProjectRootInRepo(t *testing.T) {
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, ".govforge"), 0o755); err != nil {
		t.Fatal(err)
	}
	chdir(t, root)
	got, err := FindProjectRoot()
	if err != nil {
		t.Fatalf("FindProjectRoot: %v", err)
	}
	if got == "" {
		t.Fatal("expected non-empty root")
	}
	// Compare resolved paths to side-step macOS' /private/var symlink.
	wantResolved, _ := filepath.EvalSymlinks(root)
	gotResolved, _ := filepath.EvalSymlinks(got)
	if wantResolved != gotResolved {
		t.Fatalf("got %q want %q", gotResolved, wantResolved)
	}
}

func TestFindProjectRootWalksUp(t *testing.T) {
	root := t.TempDir()
	deep := filepath.Join(root, "a", "b", "c")
	if err := os.MkdirAll(deep, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(root, ".govforge"), 0o755); err != nil {
		t.Fatal(err)
	}
	chdir(t, deep)
	got, err := FindProjectRoot()
	if err != nil {
		t.Fatal(err)
	}
	wantResolved, _ := filepath.EvalSymlinks(root)
	gotResolved, _ := filepath.EvalSymlinks(got)
	if wantResolved != gotResolved {
		t.Fatalf("walk-up: got %q want %q", gotResolved, wantResolved)
	}
}

func TestFindProjectRootNotInitialized(t *testing.T) {
	root := t.TempDir()
	chdir(t, root)
	_, err := FindProjectRoot()
	if !errors.Is(err, ErrNotInitialized) {
		t.Fatalf("expected ErrNotInitialized, got %v", err)
	}
}

func TestLoadDefaultsWhenNoProject(t *testing.T) {
	chdir(t, t.TempDir())
	cfg, err := Load(nil)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.APIURL != "http://127.0.0.1:8787" {
		t.Fatalf("unexpected default api_url: %q", cfg.APIURL)
	}
	if cfg.ProjectPath != "" {
		t.Fatalf("expected empty project_path, got %q", cfg.ProjectPath)
	}
}

func TestLoadReadsConfigFile(t *testing.T) {
	root := t.TempDir()
	dir := filepath.Join(root, ".govforge")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	body := `api_url = "http://10.0.0.1:9999"` + "\n"
	if err := os.WriteFile(filepath.Join(dir, "config.toml"), []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
	chdir(t, root)
	cfg, err := Load(nil)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.APIURL != "http://10.0.0.1:9999" {
		t.Fatalf("file ignored: %q", cfg.APIURL)
	}
	if cfg.ProjectPath == "" {
		t.Fatal("project_path should be set when .govforge/ exists")
	}
}

func TestLoadOverridesWinOverFile(t *testing.T) {
	root := t.TempDir()
	dir := filepath.Join(root, ".govforge")
	_ = os.MkdirAll(dir, 0o755)
	body := `api_url = "http://from-file"` + "\n"
	_ = os.WriteFile(filepath.Join(dir, "config.toml"), []byte(body), 0o644)
	chdir(t, root)
	cfg, err := Load(map[string]any{"api_url": "http://from-flag"})
	if err != nil {
		t.Fatal(err)
	}
	if cfg.APIURL != "http://from-flag" {
		t.Fatalf("override not applied: %q", cfg.APIURL)
	}
}

func TestLoadHonorsNoColorEnv(t *testing.T) {
	t.Setenv("NO_COLOR", "1")
	chdir(t, t.TempDir())
	cfg, err := Load(nil)
	if err != nil {
		t.Fatal(err)
	}
	if !cfg.NoColor {
		t.Fatal("NO_COLOR env should set NoColor=true")
	}
}

func TestLoadEnvAPIURLIsApplied(t *testing.T) {
	t.Setenv("GOVFORGE_API_URL", "http://env:1234")
	chdir(t, t.TempDir())
	cfg, err := Load(nil)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.APIURL != "http://env:1234" {
		t.Fatalf("env not applied: %q", cfg.APIURL)
	}
}

func TestPathsForLayout(t *testing.T) {
	p := PathsFor("/tmp/proj")
	if p.Dir != "/tmp/proj/.govforge" {
		t.Fatalf("Dir: %q", p.Dir)
	}
	if p.Config != "/tmp/proj/.govforge/config.toml" {
		t.Fatalf("Config: %q", p.Config)
	}
	if p.Database != "/tmp/proj/.govforge/govforge.db" {
		t.Fatalf("Database: %q", p.Database)
	}
	if p.Policies != "/tmp/proj/.govforge/policies.toml" {
		t.Fatalf("Policies: %q", p.Policies)
	}
}
