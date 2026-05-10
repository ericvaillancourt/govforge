package commands

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/ericvaillancourt/govforge/cli/internal/client"
)

// router is a tiny mux that returns canned responses based on path prefix.
// Cuts the boilerplate of writing a fresh httptest.Server per test.
func router(handlers map[string]http.HandlerFunc) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		for prefix, h := range handlers {
			if strings.HasPrefix(r.URL.Path, prefix) {
				h(w, r)
				return
			}
		}
		http.NotFound(w, r)
	})
}

// ---------------------------------------------------------------------------
// task create / show
// ---------------------------------------------------------------------------

func TestTaskCreateCommand(t *testing.T) {
	chdirIntoProject(t)
	srv := httptest.NewServer(router(map[string]http.HandlerFunc{
		"/tasks": func(w http.ResponseWriter, r *http.Request) {
			if r.Method != "POST" {
				http.NotFound(w, r)
				return
			}
			var in client.CreateTaskInput
			_ = json.NewDecoder(r.Body).Decode(&in)
			writeJSON(w, 201, client.Task{
				DisplayID: "TASK-001", Title: in.Title, RiskLevel: in.RiskLevel, Status: "open",
			})
		},
	}))
	t.Cleanup(srv.Close)

	out, err := runRoot(t, srv.URL, "--no-color", "task", "create",
		"--title", "Refactor auth", "--risk", "high", "--actor", "claude")
	if err != nil {
		t.Fatalf("execute: %v\n%s", err, out)
	}
	if !strings.Contains(out, "TASK-001") || !strings.Contains(out, "Refactor auth") {
		t.Fatalf("unexpected output: %s", out)
	}
}

func TestTaskShowCommand(t *testing.T) {
	chdirIntoProject(t)
	srv := httptest.NewServer(router(map[string]http.HandlerFunc{
		"/tasks/TASK-001": func(w http.ResponseWriter, _ *http.Request) {
			writeJSON(w, 200, client.Task{DisplayID: "TASK-001", Title: "x"})
		},
	}))
	t.Cleanup(srv.Close)
	out, err := runRoot(t, srv.URL, "--no-color", "task", "show", "TASK-001")
	if err != nil {
		t.Fatalf("execute: %v\n%s", err, out)
	}
	if !strings.Contains(out, "TASK-001") {
		t.Fatalf("missing display id: %s", out)
	}
}

// ---------------------------------------------------------------------------
// decision list / show / timeline
// ---------------------------------------------------------------------------

func TestDecisionListCommand(t *testing.T) {
	chdirIntoProject(t)
	srv := httptest.NewServer(router(map[string]http.HandlerFunc{
		"/decisions": func(w http.ResponseWriter, _ *http.Request) {
			writeJSON(w, 200, []client.Decision{{DisplayID: "DEC-001", Title: "x", RiskLevel: "high", Status: "draft"}})
		},
	}))
	t.Cleanup(srv.Close)
	out, err := runRoot(t, srv.URL, "--no-color", "decision", "list")
	if err != nil {
		t.Fatalf("execute: %v\n%s", err, out)
	}
	if !strings.Contains(out, "DEC-001") {
		t.Fatalf("missing decision: %s", out)
	}
}

func TestDecisionTimelineCommand(t *testing.T) {
	chdirIntoProject(t)
	srv := httptest.NewServer(router(map[string]http.HandlerFunc{
		"/decisions/DEC-001/timeline": func(w http.ResponseWriter, _ *http.Request) {
			writeJSON(w, 200, []client.Event{
				{EventType: "decision.created", EntityType: "decision"},
				{EventType: "decision.approved", EntityType: "decision"},
			})
		},
	}))
	t.Cleanup(srv.Close)
	out, err := runRoot(t, srv.URL, "--no-color", "decision", "timeline", "DEC-001")
	if err != nil {
		t.Fatalf("execute: %v\n%s", err, out)
	}
	for _, want := range []string{"decision.created", "decision.approved"} {
		if !strings.Contains(out, want) {
			t.Fatalf("missing event %q in: %s", want, out)
		}
	}
}

// ---------------------------------------------------------------------------
// policy list
// ---------------------------------------------------------------------------

func TestPolicyListCommand(t *testing.T) {
	chdirIntoProject(t)
	srv := httptest.NewServer(router(map[string]http.HandlerFunc{
		"/policies": func(w http.ResponseWriter, _ *http.Request) {
			writeJSON(w, 200, []client.Policy{
				{Name: "auth_change_requires_review", Enabled: true, Severity: "high"},
				{Name: "secret_pattern_detection", Enabled: true, Severity: "critical"},
			})
		},
	}))
	t.Cleanup(srv.Close)
	out, err := runRoot(t, srv.URL, "--no-color", "policy", "list")
	if err != nil {
		t.Fatalf("execute: %v\n%s", err, out)
	}
	if !strings.Contains(out, "auth_change_requires_review") {
		t.Fatalf("missing policy in output: %s", out)
	}
}

// ---------------------------------------------------------------------------
// review request / list / show
// ---------------------------------------------------------------------------

func TestReviewRequestCommand(t *testing.T) {
	chdirIntoProject(t)
	srv := httptest.NewServer(router(map[string]http.HandlerFunc{
		"/reviews/request": func(w http.ResponseWriter, _ *http.Request) {
			writeJSON(w, 200, client.Decision{DisplayID: "DEC-001", Status: "review_required"})
		},
	}))
	t.Cleanup(srv.Close)
	out, err := runRoot(t, srv.URL, "--no-color",
		"review", "request", "--decision", "DEC-001", "--reviewer", "codex")
	if err != nil {
		t.Fatalf("execute: %v\n%s", err, out)
	}
	if !strings.Contains(out, "review_required") {
		t.Fatalf("missing status: %s", out)
	}
}

func TestReviewListCommand(t *testing.T) {
	chdirIntoProject(t)
	srv := httptest.NewServer(router(map[string]http.HandlerFunc{
		"/reviews": func(w http.ResponseWriter, _ *http.Request) {
			writeJSON(w, 200, []client.Review{{DisplayID: "REV-001", Status: "changes_requested"}})
		},
	}))
	t.Cleanup(srv.Close)
	out, err := runRoot(t, srv.URL, "--no-color", "review", "list")
	if err != nil {
		t.Fatalf("execute: %v\n%s", err, out)
	}
	if !strings.Contains(out, "REV-001") {
		t.Fatalf("missing review: %s", out)
	}
}

// ---------------------------------------------------------------------------
// approve / reject
// ---------------------------------------------------------------------------

func TestApproveCommand(t *testing.T) {
	chdirIntoProject(t)
	srv := httptest.NewServer(router(map[string]http.HandlerFunc{
		"/decisions/DEC-001/approve": func(w http.ResponseWriter, _ *http.Request) {
			writeJSON(w, 201, client.Approval{Status: "approved"})
		},
		"/decisions/DEC-001": func(w http.ResponseWriter, _ *http.Request) {
			writeJSON(w, 200, client.Decision{DisplayID: "DEC-001", Status: "approved"})
		},
	}))
	t.Cleanup(srv.Close)
	out, err := runRoot(t, srv.URL, "--no-color", "approve", "DEC-001",
		"--approver", "eric", "--comment", "OK")
	if err != nil {
		t.Fatalf("execute: %v\n%s", err, out)
	}
	if !strings.Contains(out, "approved") {
		t.Fatalf("missing approved status: %s", out)
	}
}

func TestRejectCommandJSON(t *testing.T) {
	chdirIntoProject(t)
	srv := httptest.NewServer(router(map[string]http.HandlerFunc{
		"/decisions/DEC-001/reject": func(w http.ResponseWriter, _ *http.Request) {
			writeJSON(w, 201, client.Approval{Status: "rejected"})
		},
	}))
	t.Cleanup(srv.Close)
	out, err := runRoot(t, srv.URL, "--json", "reject", "DEC-001", "--approver", "eric")
	if err != nil {
		t.Fatalf("execute: %v\n%s", err, out)
	}
	if !strings.Contains(out, `"status": "rejected"`) {
		t.Fatalf("missing rejected JSON: %s", out)
	}
}

// ---------------------------------------------------------------------------
// project config
// ---------------------------------------------------------------------------

func TestProjectConfigCommand(t *testing.T) {
	chdirIntoProject(t)
	out, err := runRoot(t, "http://127.0.0.1:1", "--no-color", "project", "config")
	if err != nil {
		t.Fatalf("execute: %v\n%s", err, out)
	}
	for _, want := range []string{"api_url", "project_path", "db_path"} {
		if !strings.Contains(out, want) {
			t.Fatalf("missing %q: %s", want, out)
		}
	}
}

// ---------------------------------------------------------------------------
// version JSON
// ---------------------------------------------------------------------------

func TestVersionJSON(t *testing.T) {
	chdirIntoProject(t)
	srv := httptest.NewServer(router(map[string]http.HandlerFunc{
		"/health": func(w http.ResponseWriter, _ *http.Request) {
			writeJSON(w, 200, client.Health{Status: "ok", Version: "0.1.0"})
		},
	}))
	t.Cleanup(srv.Close)
	out, err := runRoot(t, srv.URL, "--json", "version")
	if err != nil {
		t.Fatalf("execute: %v\n%s", err, out)
	}
	if !strings.Contains(out, `"cli": "test"`) || !strings.Contains(out, `"version": "0.1.0"`) {
		t.Fatalf("missing fields: %s", out)
	}
}

// ---------------------------------------------------------------------------
// API error → exit code 2 (Backend)
// ---------------------------------------------------------------------------

func TestBackendErrorExitCode(t *testing.T) {
	chdirIntoProject(t)
	srv := httptest.NewServer(router(map[string]http.HandlerFunc{
		"/tasks": func(w http.ResponseWriter, _ *http.Request) {
			writeJSON(w, 500, map[string]string{"detail": "boom"})
		},
	}))
	t.Cleanup(srv.Close)

	root := NewRoot("test")
	root.SetArgs([]string{"--api-url", srv.URL, "task", "list"})
	err := root.Execute()
	if err == nil {
		t.Fatal("expected error from 500")
	}
	if got := classifyError(err); got != ExitBackend {
		t.Fatalf("expected ExitBackend (%d), got %d", ExitBackend, got)
	}
}
