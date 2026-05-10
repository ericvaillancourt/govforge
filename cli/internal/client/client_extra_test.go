package client

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// requestRecorder captures the URL/method/body of every incoming request so
// table-driven tests can assert wire shape without re-implementing the
// fakeAPI server for each case.
type requestRecorder struct {
	URL    string
	Method string
	Body   []byte
}

func recordingServer(t *testing.T, handler func(*requestRecorder, http.ResponseWriter)) (*httptest.Server, *requestRecorder) {
	t.Helper()
	rec := &requestRecorder{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		rec.URL = r.URL.String()
		rec.Method = r.Method
		rec.Body = body
		handler(rec, w)
	}))
	t.Cleanup(srv.Close)
	return srv, rec
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

func TestListProjects(t *testing.T) {
	srv, rec := recordingServer(t, func(_ *requestRecorder, w http.ResponseWriter) {
		writeJSON(w, 200, []Project{{Name: "p", RootPath: "/tmp/p"}})
	})
	got, err := New(srv.URL).ListProjects()
	if err != nil {
		t.Fatalf("ListProjects: %v", err)
	}
	if len(got) != 1 || got[0].RootPath != "/tmp/p" {
		t.Fatalf("unexpected: %+v", got)
	}
	if rec.Method != "GET" || rec.URL != "/projects" {
		t.Fatalf("wire: %s %s", rec.Method, rec.URL)
	}
}

func TestCreateProject(t *testing.T) {
	srv, rec := recordingServer(t, func(_ *requestRecorder, w http.ResponseWriter) {
		writeJSON(w, 201, Project{Name: "p", RootPath: "/tmp/p"})
	})
	in := CreateProjectInput{Name: "p", RootPath: "/tmp/p", DefaultBranch: "main"}
	if _, err := New(srv.URL).CreateProject(in); err != nil {
		t.Fatalf("CreateProject: %v", err)
	}
	if rec.Method != "POST" || rec.URL != "/projects" {
		t.Fatalf("wire: %s %s", rec.Method, rec.URL)
	}
	if !strings.Contains(string(rec.Body), `"root_path":"/tmp/p"`) {
		t.Fatalf("body missing root_path: %s", rec.Body)
	}
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

func TestGetTaskHappy(t *testing.T) {
	srv, rec := recordingServer(t, func(_ *requestRecorder, w http.ResponseWriter) {
		writeJSON(w, 200, Task{DisplayID: "TASK-001"})
	})
	got, err := New(srv.URL).GetTask("TASK-001")
	if err != nil {
		t.Fatalf("GetTask: %v", err)
	}
	if got.DisplayID != "TASK-001" {
		t.Fatalf("unexpected: %+v", got)
	}
	if rec.URL != "/tasks/TASK-001" {
		t.Fatalf("wire URL: %s", rec.URL)
	}
}

func TestListTasksOmitsEmptyStatus(t *testing.T) {
	srv, rec := recordingServer(t, func(_ *requestRecorder, w http.ResponseWriter) {
		writeJSON(w, 200, []Task{})
	})
	if _, err := New(srv.URL).ListTasks("/tmp/x", ""); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(rec.URL, "status=") {
		t.Fatalf("expected no status param, got %s", rec.URL)
	}
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

func TestCreateDecision(t *testing.T) {
	srv, rec := recordingServer(t, func(_ *requestRecorder, w http.ResponseWriter) {
		writeJSON(w, 201, Decision{DisplayID: "DEC-001"})
	})
	out, err := New(srv.URL).CreateDecision(CreateDecisionInput{
		TaskID: "TASK-001", AuthorAgent: "claude", Title: "x", RiskLevel: "high",
	})
	if err != nil {
		t.Fatal(err)
	}
	if out.DisplayID != "DEC-001" {
		t.Fatalf("unexpected: %+v", out)
	}
	if rec.Method != "POST" || rec.URL != "/decisions" {
		t.Fatalf("wire: %s %s", rec.Method, rec.URL)
	}
	if !strings.Contains(string(rec.Body), `"task_id":"TASK-001"`) {
		t.Fatalf("body missing task_id: %s", rec.Body)
	}
}

func TestListDecisionsFilters(t *testing.T) {
	srv, rec := recordingServer(t, func(_ *requestRecorder, w http.ResponseWriter) {
		writeJSON(w, 200, []Decision{})
	})
	if _, err := New(srv.URL).ListDecisions("/tmp/p", "approved"); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(rec.URL, "project_path=%2Ftmp%2Fp") {
		t.Fatalf("missing project_path: %s", rec.URL)
	}
	if !strings.Contains(rec.URL, "status=approved") {
		t.Fatalf("missing status: %s", rec.URL)
	}
}

func TestGetDecision(t *testing.T) {
	srv, _ := recordingServer(t, func(_ *requestRecorder, w http.ResponseWriter) {
		writeJSON(w, 200, Decision{DisplayID: "DEC-001"})
	})
	out, err := New(srv.URL).GetDecision("DEC-001")
	if err != nil || out.DisplayID != "DEC-001" {
		t.Fatalf("GetDecision: %v %+v", err, out)
	}
}

func TestGetDecisionTimeline(t *testing.T) {
	srv, rec := recordingServer(t, func(_ *requestRecorder, w http.ResponseWriter) {
		writeJSON(w, 200, []Event{{EventType: "decision.created"}})
	})
	out, err := New(srv.URL).GetDecisionTimeline("DEC-001")
	if err != nil {
		t.Fatal(err)
	}
	if len(out) != 1 || out[0].EventType != "decision.created" {
		t.Fatalf("unexpected: %+v", out)
	}
	if rec.URL != "/decisions/DEC-001/timeline" {
		t.Fatalf("wire URL: %s", rec.URL)
	}
}

func TestAttachGit(t *testing.T) {
	srv, rec := recordingServer(t, func(_ *requestRecorder, w http.ResponseWriter) {
		writeJSON(w, 201, GitChange{CommitHash: "abc"})
	})
	if _, err := New(srv.URL).AttachGit("DEC-001", AttachGitInput{RepoPath: "/tmp/x"}); err != nil {
		t.Fatal(err)
	}
	if rec.URL != "/decisions/DEC-001/attach-git" {
		t.Fatalf("wire URL: %s", rec.URL)
	}
}

func TestRejectDecision(t *testing.T) {
	srv, rec := recordingServer(t, func(_ *requestRecorder, w http.ResponseWriter) {
		writeJSON(w, 201, Approval{Status: "rejected"})
	})
	if _, err := New(srv.URL).RejectDecision("DEC-001", ApprovalInput{Approver: "eric"}); err != nil {
		t.Fatal(err)
	}
	if rec.URL != "/decisions/DEC-001/reject" {
		t.Fatalf("wire URL: %s", rec.URL)
	}
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

func TestRequestReview(t *testing.T) {
	srv, rec := recordingServer(t, func(_ *requestRecorder, w http.ResponseWriter) {
		writeJSON(w, 200, Decision{DisplayID: "DEC-001", Status: "review_required"})
	})
	in := RequestReviewInput{DecisionID: "DEC-001", ReviewerAgent: "codex", Focus: []string{"security"}}
	out, err := New(srv.URL).RequestReview(in)
	if err != nil {
		t.Fatal(err)
	}
	if out.Status != "review_required" {
		t.Fatalf("unexpected: %+v", out)
	}
	if rec.URL != "/reviews/request" {
		t.Fatalf("wire URL: %s", rec.URL)
	}
	if !strings.Contains(string(rec.Body), `"focus":["security"]`) {
		t.Fatalf("focus missing: %s", rec.Body)
	}
}

func TestSubmitReview(t *testing.T) {
	srv, rec := recordingServer(t, func(_ *requestRecorder, w http.ResponseWriter) {
		writeJSON(w, 201, Review{DisplayID: "REV-001"})
	})
	in := SubmitReviewInput{
		DecisionID: "DEC-001", ReviewerAgent: "codex", Status: "changes_requested",
		Findings: []FindingInput{{Severity: "high", Category: "security", Message: "m"}},
	}
	if _, err := New(srv.URL).SubmitReview(in); err != nil {
		t.Fatal(err)
	}
	if rec.URL != "/reviews" || rec.Method != "POST" {
		t.Fatalf("wire: %s %s", rec.Method, rec.URL)
	}
	if !strings.Contains(string(rec.Body), `"severity":"high"`) {
		t.Fatalf("finding missing: %s", rec.Body)
	}
}

func TestListReviewsOpenOnly(t *testing.T) {
	srv, rec := recordingServer(t, func(_ *requestRecorder, w http.ResponseWriter) {
		writeJSON(w, 200, []Review{})
	})
	if _, err := New(srv.URL).ListReviews("/tmp/p", true); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(rec.URL, "open_only=true") {
		t.Fatalf("open_only missing: %s", rec.URL)
	}
}

func TestGetReview(t *testing.T) {
	srv, rec := recordingServer(t, func(_ *requestRecorder, w http.ResponseWriter) {
		writeJSON(w, 200, Review{DisplayID: "REV-001"})
	})
	if _, err := New(srv.URL).GetReview("REV-001"); err != nil {
		t.Fatal(err)
	}
	if rec.URL != "/reviews/REV-001" {
		t.Fatalf("wire URL: %s", rec.URL)
	}
}

// ---------------------------------------------------------------------------
// Policies
// ---------------------------------------------------------------------------

func TestListPolicies(t *testing.T) {
	srv, _ := recordingServer(t, func(_ *requestRecorder, w http.ResponseWriter) {
		writeJSON(w, 200, []Policy{{Name: "auth_change_requires_review", Severity: "high"}})
	})
	got, err := New(srv.URL).ListPolicies()
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].Name != "auth_change_requires_review" {
		t.Fatalf("unexpected: %+v", got)
	}
}

func TestCheckPolicies(t *testing.T) {
	srv, rec := recordingServer(t, func(_ *requestRecorder, w http.ResponseWriter) {
		writeJSON(w, 201, []PolicyResult{{Status: "blocked"}})
	})
	out, err := New(srv.URL).CheckPolicies(CheckPoliciesInput{DecisionID: "DEC-001"})
	if err != nil {
		t.Fatal(err)
	}
	if len(out) != 1 || out[0].Status != "blocked" {
		t.Fatalf("unexpected: %+v", out)
	}
	if rec.URL != "/policies/check" {
		t.Fatalf("wire URL: %s", rec.URL)
	}
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

func TestListEventsByProject(t *testing.T) {
	srv, rec := recordingServer(t, func(_ *requestRecorder, w http.ResponseWriter) {
		writeJSON(w, 200, []Event{{EventType: "decision.created"}})
	})
	if _, err := New(srv.URL).ListEventsByProject("/tmp/p"); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(rec.URL, "project_path=%2Ftmp%2Fp") {
		t.Fatalf("project_path missing: %s", rec.URL)
	}
}

func TestListEventsByEntity(t *testing.T) {
	srv, rec := recordingServer(t, func(_ *requestRecorder, w http.ResponseWriter) {
		writeJSON(w, 200, []Event{})
	})
	if _, err := New(srv.URL).ListEventsByEntity("decision", "DEC-001"); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(rec.URL, "entity_type=decision") || !strings.Contains(rec.URL, "entity_id=DEC-001") {
		t.Fatalf("query missing: %s", rec.URL)
	}
}

// ---------------------------------------------------------------------------
// Time wrapper
// ---------------------------------------------------------------------------

func TestTimeAcceptsNaiveISO(t *testing.T) {
	var ts struct {
		At Time `json:"at"`
	}
	if err := json.Unmarshal([]byte(`{"at":"2026-05-10T11:35:24.637121"}`), &ts); err != nil {
		t.Fatalf("unmarshal naive: %v", err)
	}
	if ts.At.Year() != 2026 {
		t.Fatalf("year not parsed: %v", ts.At)
	}
}

func TestTimeAcceptsRFC3339(t *testing.T) {
	var ts struct {
		At Time `json:"at"`
	}
	if err := json.Unmarshal([]byte(`{"at":"2026-05-10T11:35:24Z"}`), &ts); err != nil {
		t.Fatalf("unmarshal rfc3339: %v", err)
	}
}

func TestTimeRejectsGarbage(t *testing.T) {
	var ts struct {
		At Time `json:"at"`
	}
	if err := json.Unmarshal([]byte(`{"at":"not-a-date"}`), &ts); err == nil {
		t.Fatal("expected error on invalid date")
	}
}

func TestAPIErrorString(t *testing.T) {
	e := &APIError{Status: 404, Detail: "not found", Body: "{}"}
	if !strings.Contains(e.Error(), "404") || !strings.Contains(e.Error(), "not found") {
		t.Fatalf("Error(): %s", e.Error())
	}
	e2 := &APIError{Status: 500, Body: "boom"}
	if !strings.Contains(e2.Error(), "boom") {
		t.Fatalf("Error(): %s", e2.Error())
	}
}

func TestIsNotFoundOnNonAPIError(t *testing.T) {
	if IsNotFound(nil) {
		t.Fatal("IsNotFound(nil) should be false")
	}
	if IsNotFound(io.EOF) {
		t.Fatal("IsNotFound(io.EOF) should be false")
	}
}
