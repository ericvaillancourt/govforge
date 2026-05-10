// Package client provides a typed wrapper around the GovForge HTTP API.
//
// Every method maps to one route in backend/govforge/api/routers. Errors
// returned from the server are surfaced as *APIError so callers can react
// to specific HTTP statuses (404, 409, 422) without parsing the JSON body
// themselves.
package client

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-resty/resty/v2"
)

// Client is the typed wrapper around the local HTTP API.
type Client struct {
	r *resty.Client
}

// New builds a Client targeting baseURL (typically http://127.0.0.1:8787).
func New(baseURL string) *Client {
	r := resty.New().
		SetBaseURL(strings.TrimRight(baseURL, "/")).
		SetHeader("Accept", "application/json").
		SetHeader("User-Agent", "gf-cli").
		SetTimeout(15 * time.Second)
	return &Client{r: r}
}

// APIError is returned for any non-2xx response.
type APIError struct {
	Status int
	Detail string
	Body   string
}

func (e *APIError) Error() string {
	if e.Detail != "" {
		return fmt.Sprintf("api %d: %s", e.Status, e.Detail)
	}
	return fmt.Sprintf("api %d: %s", e.Status, e.Body)
}

// IsNotFound reports whether the error is an HTTP 404 from the API.
func IsNotFound(err error) bool {
	var ae *APIError
	if err == nil {
		return false
	}
	if !asError(err, &ae) {
		return false
	}
	return ae.Status == http.StatusNotFound
}

// asError is a tiny errors.As wrapper that avoids importing errors here.
func asError(err error, target **APIError) bool {
	for {
		if e, ok := err.(*APIError); ok {
			*target = e
			return true
		}
		type unwrapper interface{ Unwrap() error }
		u, ok := err.(unwrapper)
		if !ok {
			return false
		}
		err = u.Unwrap()
		if err == nil {
			return false
		}
	}
}

// errorFromResponse converts a non-2xx Resty response into an APIError.
func errorFromResponse(resp *resty.Response) error {
	if resp.IsSuccess() {
		return nil
	}
	body := resp.String()
	detail := ""
	var parsed struct {
		Detail any `json:"detail"`
	}
	if err := json.Unmarshal(resp.Body(), &parsed); err == nil {
		switch v := parsed.Detail.(type) {
		case string:
			detail = v
		case nil:
			// keep empty
		default:
			b, _ := json.Marshal(v)
			detail = string(b)
		}
	}
	return &APIError{Status: resp.StatusCode(), Detail: detail, Body: body}
}

// ----------------------------------------------------------------------------
// Health
// ----------------------------------------------------------------------------

// Health calls GET /health.
func (c *Client) Health() (*Health, error) {
	var out Health
	resp, err := c.r.R().SetResult(&out).Get("/health")
	if err != nil {
		return nil, err
	}
	if e := errorFromResponse(resp); e != nil {
		return nil, e
	}
	return &out, nil
}

// ----------------------------------------------------------------------------
// Projects
// ----------------------------------------------------------------------------

// CreateProjectInput is the body for POST /projects.
type CreateProjectInput struct {
	Name          string `json:"name"`
	RootPath      string `json:"root_path"`
	DefaultBranch string `json:"default_branch,omitempty"`
}

// CreateProject calls POST /projects.
func (c *Client) CreateProject(in CreateProjectInput) (*Project, error) {
	var out Project
	resp, err := c.r.R().SetBody(in).SetResult(&out).Post("/projects")
	if err != nil {
		return nil, err
	}
	if e := errorFromResponse(resp); e != nil {
		return nil, e
	}
	return &out, nil
}

// ListProjects calls GET /projects.
func (c *Client) ListProjects() ([]Project, error) {
	var out []Project
	resp, err := c.r.R().SetResult(&out).Get("/projects")
	if err != nil {
		return nil, err
	}
	if e := errorFromResponse(resp); e != nil {
		return nil, e
	}
	return out, nil
}

// ----------------------------------------------------------------------------
// Tasks
// ----------------------------------------------------------------------------

// CreateTaskInput is the body for POST /tasks.
type CreateTaskInput struct {
	ProjectPath string  `json:"project_path"`
	Title       string  `json:"title"`
	Description *string `json:"description,omitempty"`
	RiskLevel   string  `json:"risk_level,omitempty"`
	ActorAgent  *string `json:"actor_agent,omitempty"`
}

// CreateTask calls POST /tasks.
func (c *Client) CreateTask(in CreateTaskInput) (*Task, error) {
	var out Task
	resp, err := c.r.R().SetBody(in).SetResult(&out).Post("/tasks")
	if err != nil {
		return nil, err
	}
	if e := errorFromResponse(resp); e != nil {
		return nil, e
	}
	return &out, nil
}

// ListTasks calls GET /tasks?project_path=…[&status=…].
func (c *Client) ListTasks(projectPath, status string) ([]Task, error) {
	req := c.r.R().SetQueryParam("project_path", projectPath)
	if status != "" {
		req = req.SetQueryParam("status", status)
	}
	var out []Task
	resp, err := req.SetResult(&out).Get("/tasks")
	if err != nil {
		return nil, err
	}
	if e := errorFromResponse(resp); e != nil {
		return nil, e
	}
	return out, nil
}

// GetTask calls GET /tasks/{id} (display_id or UUID).
func (c *Client) GetTask(id string) (*Task, error) {
	var out Task
	resp, err := c.r.R().SetResult(&out).Get("/tasks/" + id)
	if err != nil {
		return nil, err
	}
	if e := errorFromResponse(resp); e != nil {
		return nil, e
	}
	return &out, nil
}

// ----------------------------------------------------------------------------
// Decisions
// ----------------------------------------------------------------------------

// CreateDecisionInput is the body for POST /decisions.
type CreateDecisionInput struct {
	TaskID                string  `json:"task_id"`
	AuthorAgent           string  `json:"author_agent"`
	Title                 string  `json:"title"`
	Summary               *string `json:"summary,omitempty"`
	Rationale             *string `json:"rationale,omitempty"`
	RiskLevel             string  `json:"risk_level,omitempty"`
	HumanApprovalRequired bool    `json:"human_approval_required,omitempty"`
}

// CreateDecision calls POST /decisions.
func (c *Client) CreateDecision(in CreateDecisionInput) (*Decision, error) {
	var out Decision
	resp, err := c.r.R().SetBody(in).SetResult(&out).Post("/decisions")
	if err != nil {
		return nil, err
	}
	if e := errorFromResponse(resp); e != nil {
		return nil, e
	}
	return &out, nil
}

// ListDecisions calls GET /decisions?project_path=…[&status=…].
func (c *Client) ListDecisions(projectPath, status string) ([]Decision, error) {
	req := c.r.R().SetQueryParam("project_path", projectPath)
	if status != "" {
		req = req.SetQueryParam("status", status)
	}
	var out []Decision
	resp, err := req.SetResult(&out).Get("/decisions")
	if err != nil {
		return nil, err
	}
	if e := errorFromResponse(resp); e != nil {
		return nil, e
	}
	return out, nil
}

// GetDecision calls GET /decisions/{id}.
func (c *Client) GetDecision(id string) (*Decision, error) {
	var out Decision
	resp, err := c.r.R().SetResult(&out).Get("/decisions/" + id)
	if err != nil {
		return nil, err
	}
	if e := errorFromResponse(resp); e != nil {
		return nil, e
	}
	return &out, nil
}

// GetDecisionTimeline calls GET /decisions/{id}/timeline.
func (c *Client) GetDecisionTimeline(id string) ([]Event, error) {
	var out []Event
	resp, err := c.r.R().SetResult(&out).Get("/decisions/" + id + "/timeline")
	if err != nil {
		return nil, err
	}
	if e := errorFromResponse(resp); e != nil {
		return nil, e
	}
	return out, nil
}

// AttachGitInput is the body for POST /decisions/{id}/attach-git.
type AttachGitInput struct {
	RepoPath   string  `json:"repo_path"`
	CommitHash string  `json:"commit_hash,omitempty"`
	ActorAgent *string `json:"actor_agent,omitempty"`
}

// AttachGit calls POST /decisions/{id}/attach-git.
func (c *Client) AttachGit(decisionID string, in AttachGitInput) (*GitChange, error) {
	var out GitChange
	resp, err := c.r.R().SetBody(in).SetResult(&out).Post("/decisions/" + decisionID + "/attach-git")
	if err != nil {
		return nil, err
	}
	if e := errorFromResponse(resp); e != nil {
		return nil, e
	}
	return &out, nil
}

// ApprovalInput is the body for POST /decisions/{id}/{approve,reject}.
type ApprovalInput struct {
	Approver string  `json:"approver"`
	Comment  *string `json:"comment,omitempty"`
}

// ApproveDecision calls POST /decisions/{id}/approve.
func (c *Client) ApproveDecision(id string, in ApprovalInput) (*Approval, error) {
	return c.postApproval(id, "approve", in)
}

// RejectDecision calls POST /decisions/{id}/reject.
func (c *Client) RejectDecision(id string, in ApprovalInput) (*Approval, error) {
	return c.postApproval(id, "reject", in)
}

func (c *Client) postApproval(id, action string, in ApprovalInput) (*Approval, error) {
	var out Approval
	resp, err := c.r.R().SetBody(in).SetResult(&out).Post("/decisions/" + id + "/" + action)
	if err != nil {
		return nil, err
	}
	if e := errorFromResponse(resp); e != nil {
		return nil, e
	}
	return &out, nil
}

// ----------------------------------------------------------------------------
// Reviews
// ----------------------------------------------------------------------------

// RequestReviewInput is the body for POST /reviews/request.
type RequestReviewInput struct {
	DecisionID    string   `json:"decision_id"`
	ReviewerAgent string   `json:"reviewer_agent"`
	Focus         []string `json:"focus,omitempty"`
	ActorAgent    *string  `json:"actor_agent,omitempty"`
}

// RequestReview calls POST /reviews/request.
func (c *Client) RequestReview(in RequestReviewInput) (*Decision, error) {
	var out Decision
	resp, err := c.r.R().SetBody(in).SetResult(&out).Post("/reviews/request")
	if err != nil {
		return nil, err
	}
	if e := errorFromResponse(resp); e != nil {
		return nil, e
	}
	return &out, nil
}

// SubmitReviewInput is the body for POST /reviews.
type SubmitReviewInput struct {
	DecisionID    string         `json:"decision_id"`
	ReviewerAgent string         `json:"reviewer_agent"`
	Status        string         `json:"status"`
	Summary       *string        `json:"summary,omitempty"`
	Findings      []FindingInput `json:"findings,omitempty"`
}

// SubmitReview calls POST /reviews.
func (c *Client) SubmitReview(in SubmitReviewInput) (*Review, error) {
	var out Review
	resp, err := c.r.R().SetBody(in).SetResult(&out).Post("/reviews")
	if err != nil {
		return nil, err
	}
	if e := errorFromResponse(resp); e != nil {
		return nil, e
	}
	return &out, nil
}

// ListReviews calls GET /reviews?project_path=…[&open_only=true].
func (c *Client) ListReviews(projectPath string, openOnly bool) ([]Review, error) {
	req := c.r.R().SetQueryParam("project_path", projectPath)
	if openOnly {
		req = req.SetQueryParam("open_only", "true")
	}
	var out []Review
	resp, err := req.SetResult(&out).Get("/reviews")
	if err != nil {
		return nil, err
	}
	if e := errorFromResponse(resp); e != nil {
		return nil, e
	}
	return out, nil
}

// GetReview calls GET /reviews/{id}.
func (c *Client) GetReview(id string) (*Review, error) {
	var out Review
	resp, err := c.r.R().SetResult(&out).Get("/reviews/" + id)
	if err != nil {
		return nil, err
	}
	if e := errorFromResponse(resp); e != nil {
		return nil, e
	}
	return &out, nil
}

// ----------------------------------------------------------------------------
// Policies
// ----------------------------------------------------------------------------

// ListPolicies calls GET /policies.
func (c *Client) ListPolicies() ([]Policy, error) {
	var out []Policy
	resp, err := c.r.R().SetResult(&out).Get("/policies")
	if err != nil {
		return nil, err
	}
	if e := errorFromResponse(resp); e != nil {
		return nil, e
	}
	return out, nil
}

// CheckPoliciesInput is the body for POST /policies/check.
type CheckPoliciesInput struct {
	DecisionID string  `json:"decision_id"`
	ConfigPath *string `json:"config_path,omitempty"`
	ActorAgent *string `json:"actor_agent,omitempty"`
}

// CheckPolicies calls POST /policies/check.
func (c *Client) CheckPolicies(in CheckPoliciesInput) ([]PolicyResult, error) {
	var out []PolicyResult
	resp, err := c.r.R().SetBody(in).SetResult(&out).Post("/policies/check")
	if err != nil {
		return nil, err
	}
	if e := errorFromResponse(resp); e != nil {
		return nil, e
	}
	return out, nil
}

// ----------------------------------------------------------------------------
// Events
// ----------------------------------------------------------------------------

// ListEventsByProject calls GET /events?project_path=…
func (c *Client) ListEventsByProject(projectPath string) ([]Event, error) {
	var out []Event
	resp, err := c.r.R().
		SetQueryParam("project_path", projectPath).
		SetResult(&out).
		Get("/events")
	if err != nil {
		return nil, err
	}
	if e := errorFromResponse(resp); e != nil {
		return nil, e
	}
	return out, nil
}

// ListEventsByEntity calls GET /events?entity_type=&entity_id=
func (c *Client) ListEventsByEntity(entityType, entityID string) ([]Event, error) {
	var out []Event
	resp, err := c.r.R().
		SetQueryParam("entity_type", entityType).
		SetQueryParam("entity_id", entityID).
		SetResult(&out).
		Get("/events")
	if err != nil {
		return nil, err
	}
	if e := errorFromResponse(resp); e != nil {
		return nil, e
	}
	return out, nil
}
