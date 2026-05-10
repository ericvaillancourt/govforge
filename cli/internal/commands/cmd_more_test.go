package commands

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/ericvaillancourt/govforge/cli/internal/client"
)

func TestDecisionCreateCommand(t *testing.T) {
	chdirIntoProject(t)
	srv := httptest.NewServer(router(map[string]http.HandlerFunc{
		"/decisions": func(w http.ResponseWriter, _ *http.Request) {
			writeJSON(w, 201, client.Decision{
				DisplayID: "DEC-001", Title: "Migrate", RiskLevel: "high", Status: "draft",
			})
		},
	}))
	t.Cleanup(srv.Close)
	out, err := runRoot(t, srv.URL, "--no-color", "decision", "create",
		"--task", "TASK-001", "--author", "claude", "--title", "Migrate",
		"--summary", "swap session lookup", "--rationale", "perf",
		"--risk", "high", "--human-approval")
	if err != nil {
		t.Fatalf("execute: %v\n%s", err, out)
	}
	if !strings.Contains(out, "DEC-001") {
		t.Fatalf("missing decision id: %s", out)
	}
}

func TestDecisionShowCommand(t *testing.T) {
	chdirIntoProject(t)
	summary := "summary text"
	rationale := "why"
	srv := httptest.NewServer(router(map[string]http.HandlerFunc{
		"/decisions/DEC-001": func(w http.ResponseWriter, _ *http.Request) {
			writeJSON(w, 200, client.Decision{
				DisplayID: "DEC-001", Title: "Migrate", RiskLevel: "high",
				Status: "approved", Summary: &summary, Rationale: &rationale,
			})
		},
	}))
	t.Cleanup(srv.Close)
	out, err := runRoot(t, srv.URL, "--no-color", "decision", "show", "DEC-001")
	if err != nil {
		t.Fatalf("execute: %v\n%s", err, out)
	}
	for _, want := range []string{"DEC-001", "summary text", "why"} {
		if !strings.Contains(out, want) {
			t.Fatalf("missing %q in: %s", want, out)
		}
	}
}

func TestGitAttachCommand(t *testing.T) {
	chdirIntoProject(t)
	srv := httptest.NewServer(router(map[string]http.HandlerFunc{
		"/decisions/DEC-001/attach-git": func(w http.ResponseWriter, _ *http.Request) {
			writeJSON(w, 201, client.GitChange{
				CommitHash: "abc123", FilesChanged: []string{"auth.py"},
				Insertions: 10, Deletions: 2,
			})
		},
	}))
	t.Cleanup(srv.Close)
	out, err := runRoot(t, srv.URL, "--no-color", "git", "attach",
		"--decision", "DEC-001", "--commit", "HEAD", "--actor", "claude")
	if err != nil {
		t.Fatalf("execute: %v\n%s", err, out)
	}
	for _, want := range []string{"abc123", "auth.py", "10", "2"} {
		if !strings.Contains(out, want) {
			t.Fatalf("missing %q in: %s", want, out)
		}
	}
}

func TestGitDiffCommand(t *testing.T) {
	chdirIntoProject(t)
	srv := httptest.NewServer(router(map[string]http.HandlerFunc{
		"/decisions/DEC-001": func(w http.ResponseWriter, _ *http.Request) {
			writeJSON(w, 200, client.Decision{
				DisplayID: "DEC-001", Title: "x", RiskLevel: "medium", Status: "draft",
			})
		},
	}))
	t.Cleanup(srv.Close)
	out, err := runRoot(t, srv.URL, "--no-color", "git", "diff", "--decision", "DEC-001")
	if err != nil {
		t.Fatalf("execute: %v\n%s", err, out)
	}
	if !strings.Contains(out, "DEC-001") {
		t.Fatalf("missing decision id: %s", out)
	}
}

func TestPolicyCheckCommand(t *testing.T) {
	chdirIntoProject(t)
	srv := httptest.NewServer(router(map[string]http.HandlerFunc{
		"/policies/check": func(w http.ResponseWriter, _ *http.Request) {
			msg := "auth-adjacent"
			writeJSON(w, 201, []client.PolicyResult{
				{PolicyID: "policy-1", Status: "blocked", Message: &msg},
			})
		},
		"/policies": func(w http.ResponseWriter, _ *http.Request) {
			writeJSON(w, 200, []client.Policy{
				{ID: "policy-1", Name: "auth_change_requires_review"},
			})
		},
	}))
	t.Cleanup(srv.Close)
	out, err := runRoot(t, srv.URL, "--no-color", "policy", "check", "--decision", "DEC-001")
	if err != nil {
		t.Fatalf("execute: %v\n%s", err, out)
	}
	for _, want := range []string{"auth_change_requires_review", "blocked", "auth-adjacent"} {
		if !strings.Contains(out, want) {
			t.Fatalf("missing %q in: %s", want, out)
		}
	}
}

func TestReviewShowCommand(t *testing.T) {
	chdirIntoProject(t)
	summary := "session fixation risk"
	srv := httptest.NewServer(router(map[string]http.HandlerFunc{
		"/reviews/REV-001": func(w http.ResponseWriter, _ *http.Request) {
			fp := "auth.py"
			writeJSON(w, 200, client.Review{
				DisplayID: "REV-001", Status: "changes_requested",
				Summary: &summary,
				Findings: []client.Finding{
					{Severity: "high", Category: "security", FilePath: &fp,
						Message: "Token not rotated"},
				},
			})
		},
	}))
	t.Cleanup(srv.Close)
	out, err := runRoot(t, srv.URL, "--no-color", "review", "show", "REV-001")
	if err != nil {
		t.Fatalf("execute: %v\n%s", err, out)
	}
	for _, want := range []string{"REV-001", "session fixation", "Token not rotated"} {
		if !strings.Contains(out, want) {
			t.Fatalf("missing %q in: %s", want, out)
		}
	}
}
