// Package client provides a typed wrapper around the GovForge HTTP API.
package client


// Project mirrors backend ProjectOut.
type Project struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	RootPath      string    `json:"root_path"`
	DefaultBranch string    `json:"default_branch"`
	CreatedAt     Time `json:"created_at"`
}

// Task mirrors backend TaskOut.
type Task struct {
	ID          string    `json:"id"`
	DisplayID   string    `json:"display_id"`
	ProjectID   string    `json:"project_id"`
	Title       string    `json:"title"`
	Description *string   `json:"description"`
	RiskLevel   string    `json:"risk_level"`
	Status      string    `json:"status"`
	CreatedAt   Time `json:"created_at"`
}

// Decision mirrors backend DecisionOut.
type Decision struct {
	ID                    string    `json:"id"`
	DisplayID             string    `json:"display_id"`
	ProjectID             string    `json:"project_id"`
	TaskID                *string   `json:"task_id"`
	Title                 string    `json:"title"`
	Summary               *string   `json:"summary"`
	Rationale             *string   `json:"rationale"`
	Status                string    `json:"status"`
	RiskLevel             string    `json:"risk_level"`
	HumanApprovalRequired bool      `json:"human_approval_required"`
	CreatedAt             Time `json:"created_at"`
}

// GitChange mirrors backend GitChangeOut.
type GitChange struct {
	ID               string   `json:"id"`
	DecisionID       string   `json:"decision_id"`
	RepoPath         string   `json:"repo_path"`
	BranchName       *string  `json:"branch_name"`
	CommitHash       string   `json:"commit_hash"`
	ParentCommitHash *string  `json:"parent_commit_hash"`
	DiffHash         string   `json:"diff_hash"`
	FilesChanged     []string `json:"files_changed_json"`
	Insertions       int      `json:"insertions"`
	Deletions        int      `json:"deletions"`
}

// Approval mirrors backend ApprovalOut.
type Approval struct {
	ID         string    `json:"id"`
	DecisionID string    `json:"decision_id"`
	Status     string    `json:"status"`
	Comment    *string   `json:"comment"`
	CreatedAt  Time `json:"created_at"`
}

// Finding mirrors backend FindingOut.
type Finding struct {
	ID             string  `json:"id"`
	Severity       string  `json:"severity"`
	Category       string  `json:"category"`
	FilePath       *string `json:"file_path"`
	LineStart      *int    `json:"line_start"`
	LineEnd        *int    `json:"line_end"`
	Message        string  `json:"message"`
	Recommendation *string `json:"recommendation"`
}

// Review mirrors backend ReviewOut.
type Review struct {
	ID         string    `json:"id"`
	DisplayID  string    `json:"display_id"`
	DecisionID string    `json:"decision_id"`
	ReviewerID string    `json:"reviewer_agent_id"`
	Status     string    `json:"status"`
	Summary    *string   `json:"summary"`
	CreatedAt  Time `json:"created_at"`
	Findings   []Finding `json:"findings"`
}

// Policy mirrors backend PolicyOut.
type Policy struct {
	ID          string         `json:"id"`
	Name        string         `json:"name"`
	Description *string        `json:"description"`
	Enabled     bool           `json:"enabled"`
	Severity    string         `json:"severity"`
	Config      map[string]any `json:"config_json"`
}

// PolicyResult mirrors backend PolicyResultOut.
type PolicyResult struct {
	ID         string         `json:"id"`
	DecisionID string         `json:"decision_id"`
	PolicyID   string         `json:"policy_id"`
	Status     string         `json:"status"`
	Message    *string        `json:"message"`
	Evidence   map[string]any `json:"evidence_json"`
	CreatedAt  Time      `json:"created_at"`
}

// Event mirrors backend EventOut.
type Event struct {
	ID           string         `json:"id"`
	ProjectID    string         `json:"project_id"`
	EntityType   string         `json:"entity_type"`
	EntityID     string         `json:"entity_id"`
	EventType    string         `json:"event_type"`
	ActorAgentID *string        `json:"actor_agent_id"`
	Payload      map[string]any `json:"payload_json"`
	CreatedAt    Time      `json:"created_at"`
}

// Health mirrors backend HealthOut.
type Health struct {
	Status  string `json:"status"`
	Version string `json:"version"`
}

// FindingInput is the request shape for a single finding inside SubmitReview.
type FindingInput struct {
	Severity       string  `json:"severity"`
	Category       string  `json:"category"`
	FilePath       *string `json:"file_path,omitempty"`
	LineStart      *int    `json:"line_start,omitempty"`
	LineEnd        *int    `json:"line_end,omitempty"`
	Message        string  `json:"message"`
	Recommendation *string `json:"recommendation,omitempty"`
}

// Disagreement mirrors backend DisagreementOut.
type Disagreement struct {
	ID                    string  `json:"id"`
	DecisionID            string  `json:"decision_id"`
	Topic                 string  `json:"topic"`
	AuthorPosition        *string `json:"author_position"`
	ReviewerPosition      *string `json:"reviewer_position"`
	RiskSummary           *string `json:"risk_summary"`
	RequiresHumanDecision bool    `json:"requires_human_decision"`
	Resolution            *string `json:"resolution"`
	ResolvedByAgentID     *string `json:"resolved_by_agent_id"`
	ResolvedAt            *Time   `json:"resolved_at"`
	CreatedAt             Time    `json:"created_at"`
}
