package client

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// fakeAPI spins up an httptest.Server with hand-rolled handlers so we can
// assert the URL/method/body the client sends and pin the response.
func fakeAPI(t *testing.T, handler http.Handler) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	return srv
}

func TestHealthHappyPath(t *testing.T) {
	srv := fakeAPI(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/health" || r.Method != http.MethodGet {
			t.Fatalf("unexpected %s %s", r.Method, r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(Health{Status: "ok", Version: "0.1.0"})
	}))
	c := New(srv.URL)
	h, err := c.Health()
	if err != nil {
		t.Fatalf("Health(): %v", err)
	}
	if h.Status != "ok" || h.Version != "0.1.0" {
		t.Fatalf("unexpected: %+v", h)
	}
}

func TestNotFoundReturnsAPIError(t *testing.T) {
	srv := fakeAPI(t, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(map[string]string{"detail": "task not found: TASK-999"})
	}))
	c := New(srv.URL)
	_, err := c.GetTask("TASK-999")
	if err == nil {
		t.Fatal("expected error")
	}
	if !IsNotFound(err) {
		t.Fatalf("expected IsNotFound true, got %v", err)
	}
	if !strings.Contains(err.Error(), "TASK-999") {
		t.Fatalf("expected detail in error, got %v", err)
	}
}

func TestCreateTaskPostsExpectedBody(t *testing.T) {
	var captured CreateTaskInput
	srv := fakeAPI(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/tasks" {
			t.Fatalf("unexpected %s %s", r.Method, r.URL.Path)
		}
		if err := json.NewDecoder(r.Body).Decode(&captured); err != nil {
			t.Fatalf("decode: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(Task{DisplayID: "TASK-001", Title: captured.Title, RiskLevel: captured.RiskLevel, Status: "open"})
	}))
	c := New(srv.URL)
	got, err := c.CreateTask(CreateTaskInput{
		ProjectPath: "/tmp/x",
		Title:       "Refactor auth",
		RiskLevel:   "high",
	})
	if err != nil {
		t.Fatalf("CreateTask(): %v", err)
	}
	if captured.ProjectPath != "/tmp/x" || captured.RiskLevel != "high" {
		t.Fatalf("body not propagated: %+v", captured)
	}
	if got.DisplayID != "TASK-001" {
		t.Fatalf("response not parsed: %+v", got)
	}
}

func TestListTasksEncodesQueryParams(t *testing.T) {
	srv := fakeAPI(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("project_path") != "/tmp/x" {
			t.Fatalf("project_path missing: %s", r.URL.RawQuery)
		}
		if r.URL.Query().Get("status") != "open" {
			t.Fatalf("status missing: %s", r.URL.RawQuery)
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode([]Task{{DisplayID: "TASK-001"}})
	}))
	c := New(srv.URL)
	tasks, err := c.ListTasks("/tmp/x", "open")
	if err != nil {
		t.Fatalf("ListTasks(): %v", err)
	}
	if len(tasks) != 1 || tasks[0].DisplayID != "TASK-001" {
		t.Fatalf("unexpected: %+v", tasks)
	}
}

func TestApproveDecisionPostsToCorrectPath(t *testing.T) {
	srv := fakeAPI(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/decisions/DEC-001/approve" || r.Method != http.MethodPost {
			t.Fatalf("unexpected %s %s", r.Method, r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(Approval{Status: "approved"})
	}))
	c := New(srv.URL)
	a, err := c.ApproveDecision("DEC-001", ApprovalInput{Approver: "eric"})
	if err != nil {
		t.Fatalf("ApproveDecision(): %v", err)
	}
	if a.Status != "approved" {
		t.Fatalf("unexpected: %+v", a)
	}
}
