package commands

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/ericvaillancourt/govforge/cli/internal/client"
	"github.com/ericvaillancourt/govforge/cli/internal/config"
)

// chdirIntoProject creates a fake .govforge/ in a fresh tmp dir, points
// the cwd there, and returns the project path. Used by command tests
// that hit `Resolve(flags, true)`.
func chdirIntoProject(t *testing.T) string {
	t.Helper()
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, ".govforge"), 0o755); err != nil {
		t.Fatal(err)
	}
	old, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(root); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chdir(old) })
	return root
}

// runRoot runs the cobra root with `args`, capturing stdout. The fake API
// server URL is injected via --api-url so commands hit our test handler.
func runRoot(t *testing.T, apiURL string, args ...string) (string, error) {
	t.Helper()
	full := append([]string{"--api-url", apiURL}, args...)
	root := NewRoot("test")
	root.SetArgs(full)
	var buf bytes.Buffer
	root.SetOut(&buf)
	root.SetErr(&buf)
	// Cobra writes most output to stdout via fmt.Print; capture via os.Stdout.
	r, w, _ := os.Pipe()
	stdout := os.Stdout
	os.Stdout = w
	t.Cleanup(func() { os.Stdout = stdout })

	err := root.Execute()
	_ = w.Close()
	piped, _ := os.ReadFile("/dev/stdin")
	_ = piped // satisfy unused, real read below
	out := bytes.Buffer{}
	_, _ = out.ReadFrom(r)
	return out.String() + buf.String(), err
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// ---------------------------------------------------------------------------
// Command-level tests
// ---------------------------------------------------------------------------

func TestProjectStatusJSON(t *testing.T) {
	chdirIntoProject(t)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, 200, client.Health{Status: "ok", Version: "0.1.0"})
	}))
	t.Cleanup(srv.Close)

	out, err := runRoot(t, srv.URL, "--json", "project", "status")
	if err != nil {
		t.Fatalf("execute: %v\n%s", err, out)
	}
	if !strings.Contains(out, `"api_url"`) || !strings.Contains(out, `"status": "ok"`) {
		t.Fatalf("expected JSON status payload, got: %s", out)
	}
}

func TestTaskListEmptyTable(t *testing.T) {
	chdirIntoProject(t)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, 200, []client.Task{})
	}))
	t.Cleanup(srv.Close)

	out, err := runRoot(t, srv.URL, "--no-color", "task", "list")
	if err != nil {
		t.Fatalf("execute: %v\n%s", err, out)
	}
	// The table header should print even on an empty list.
	if !strings.Contains(out, "ID") || !strings.Contains(out, "TITLE") {
		t.Fatalf("expected table headers, got: %s", out)
	}
}

func TestTaskListJSON(t *testing.T) {
	chdirIntoProject(t)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, 200, []client.Task{{DisplayID: "TASK-001", Title: "x", RiskLevel: "high", Status: "open"}})
	}))
	t.Cleanup(srv.Close)

	out, err := runRoot(t, srv.URL, "--json", "task", "list")
	if err != nil {
		t.Fatalf("execute: %v\n%s", err, out)
	}
	if !strings.Contains(out, `"display_id": "TASK-001"`) {
		t.Fatalf("expected JSON task list, got: %s", out)
	}
}

func TestVersionWithUnreachableBackend(t *testing.T) {
	chdirIntoProject(t)
	// Point at a port that isn't listening.
	out, err := runRoot(t, "http://127.0.0.1:1", "--no-color", "version")
	if err != nil {
		t.Fatalf("execute: %v\n%s", err, out)
	}
	if !strings.Contains(out, "cli") || !strings.Contains(out, "test") {
		t.Fatalf("missing CLI version line: %s", out)
	}
	if !strings.Contains(out, "unreachable") {
		t.Fatalf("expected backend unreachable hint: %s", out)
	}
}

func TestNoProjectErrorOnRequiredCommand(t *testing.T) {
	// chdir to a temp dir with NO .govforge/
	old, _ := os.Getwd()
	tmp := t.TempDir()
	_ = os.Chdir(tmp)
	t.Cleanup(func() { _ = os.Chdir(old) })

	root := NewRoot("test")
	root.SetArgs([]string{"task", "list"})
	root.SetOut(&bytes.Buffer{})
	root.SetErr(&bytes.Buffer{})
	err := root.Execute()
	if err == nil {
		t.Fatal("expected error when no .govforge/ present")
	}
	if !errors.Is(err, config.ErrNotInitialized) && !strings.Contains(err.Error(), "not a govforge project") {
		t.Fatalf("expected ErrNotInitialized, got %v", err)
	}
}

func TestExitCodeMappingNetworkError(t *testing.T) {
	if got := classifyError(errors.New("dial tcp 127.0.0.1:9: connection refused")); got != ExitNetwork {
		t.Fatalf("network error: got code %d, want %d", got, ExitNetwork)
	}
}

func TestExitCodeMappingAPIError(t *testing.T) {
	apiErr := &client.APIError{Status: 404, Detail: "not found"}
	if got := classifyError(apiErr); got != ExitBackend {
		t.Fatalf("api error: got code %d, want %d", got, ExitBackend)
	}
}

func TestExitCodeMappingNoConfig(t *testing.T) {
	if got := classifyError(config.ErrNotInitialized); got != ExitUserError {
		t.Fatalf("not-initialized: got code %d, want %d", got, ExitUserError)
	}
}

func TestExitCodeMappingNilIsOK(t *testing.T) {
	if got := classifyError(nil); got != ExitOK {
		t.Fatalf("nil error: got code %d, want %d", got, ExitOK)
	}
}
