CREATE TABLE agents (
	id CHAR(32) NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	type VARCHAR(6) NOT NULL, 
	metadata_json JSON, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (name)
);

CREATE TABLE policies (
	id CHAR(32) NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	description TEXT, 
	enabled BOOLEAN NOT NULL, 
	severity VARCHAR(8) NOT NULL, 
	config_json JSON, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (name)
);

CREATE TABLE projects (
	id CHAR(32) NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	root_path VARCHAR(1024) NOT NULL, 
	default_branch VARCHAR(255) NOT NULL, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (root_path)
);

CREATE TABLE events (
	id CHAR(32) NOT NULL, 
	project_id CHAR(32) NOT NULL, 
	entity_type VARCHAR(64) NOT NULL, 
	entity_id CHAR(32) NOT NULL, 
	event_type VARCHAR(128) NOT NULL, 
	actor_agent_id CHAR(32), 
	payload_json JSON, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE, 
	FOREIGN KEY(actor_agent_id) REFERENCES agents (id)
);

CREATE TABLE tasks (
	id CHAR(32) NOT NULL, 
	display_id VARCHAR(32) NOT NULL, 
	project_id CHAR(32) NOT NULL, 
	title VARCHAR(512) NOT NULL, 
	description TEXT, 
	risk_level VARCHAR(8) NOT NULL, 
	status VARCHAR(15) NOT NULL, 
	created_by_agent_id CHAR(32), 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_tasks_project_display UNIQUE (project_id, display_id), 
	FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE, 
	FOREIGN KEY(created_by_agent_id) REFERENCES agents (id)
);

CREATE TABLE decisions (
	id CHAR(32) NOT NULL, 
	display_id VARCHAR(32) NOT NULL, 
	project_id CHAR(32) NOT NULL, 
	task_id CHAR(32), 
	author_agent_id CHAR(32) NOT NULL, 
	title VARCHAR(512) NOT NULL, 
	summary TEXT, 
	rationale TEXT, 
	status VARCHAR(17) NOT NULL, 
	risk_level VARCHAR(8) NOT NULL, 
	human_approval_required BOOLEAN NOT NULL, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_decisions_project_display UNIQUE (project_id, display_id), 
	FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE, 
	FOREIGN KEY(task_id) REFERENCES tasks (id) ON DELETE SET NULL, 
	FOREIGN KEY(author_agent_id) REFERENCES agents (id)
);

CREATE TABLE approvals (
	id CHAR(32) NOT NULL, 
	decision_id CHAR(32) NOT NULL, 
	approver_agent_id CHAR(32) NOT NULL, 
	status VARCHAR(13) NOT NULL, 
	comment TEXT, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(decision_id) REFERENCES decisions (id) ON DELETE CASCADE, 
	FOREIGN KEY(approver_agent_id) REFERENCES agents (id)
);

CREATE TABLE disagreements (
	id CHAR(32) NOT NULL, 
	decision_id CHAR(32) NOT NULL, 
	topic VARCHAR(512) NOT NULL, 
	author_position TEXT, 
	reviewer_position TEXT, 
	risk_summary TEXT, 
	requires_human_decision BOOLEAN NOT NULL, 
	resolution TEXT, 
	resolved_by_agent_id CHAR(32), 
	resolved_at DATETIME, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(decision_id) REFERENCES decisions (id) ON DELETE CASCADE, 
	FOREIGN KEY(resolved_by_agent_id) REFERENCES agents (id)
);

CREATE TABLE git_changes (
	id CHAR(32) NOT NULL, 
	decision_id CHAR(32) NOT NULL, 
	repo_path VARCHAR(1024) NOT NULL, 
	branch_name VARCHAR(255), 
	commit_hash VARCHAR(64) NOT NULL, 
	parent_commit_hash VARCHAR(64), 
	diff_hash VARCHAR(72), 
	files_changed_json JSON NOT NULL, 
	insertions INTEGER NOT NULL, 
	deletions INTEGER NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(decision_id) REFERENCES decisions (id) ON DELETE CASCADE
);

CREATE TABLE policy_results (
	id CHAR(32) NOT NULL, 
	decision_id CHAR(32) NOT NULL, 
	policy_id CHAR(32) NOT NULL, 
	status VARCHAR(7) NOT NULL, 
	message TEXT, 
	evidence_json JSON, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(decision_id) REFERENCES decisions (id) ON DELETE CASCADE, 
	FOREIGN KEY(policy_id) REFERENCES policies (id)
);

CREATE TABLE reviews (
	id CHAR(32) NOT NULL, 
	display_id VARCHAR(32) NOT NULL, 
	decision_id CHAR(32) NOT NULL, 
	reviewer_agent_id CHAR(32) NOT NULL, 
	status VARCHAR(17) NOT NULL, 
	summary TEXT, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(decision_id) REFERENCES decisions (id) ON DELETE CASCADE, 
	FOREIGN KEY(reviewer_agent_id) REFERENCES agents (id)
);

CREATE TABLE findings (
	id CHAR(32) NOT NULL, 
	review_id CHAR(32) NOT NULL, 
	severity VARCHAR(8) NOT NULL, 
	category VARCHAR(15) NOT NULL, 
	file_path VARCHAR(1024), 
	line_start INTEGER, 
	line_end INTEGER, 
	message TEXT NOT NULL, 
	recommendation TEXT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(review_id) REFERENCES reviews (id) ON DELETE CASCADE
);

CREATE INDEX ix_events_entity ON events (entity_type, entity_id);

CREATE INDEX ix_events_project_created ON events (project_id, created_at);

CREATE INDEX ix_tasks_project_status ON tasks (project_id, status);

CREATE INDEX ix_decisions_project_status ON decisions (project_id, status);

CREATE INDEX ix_approvals_decision ON approvals (decision_id);

CREATE INDEX ix_disagreements_decision ON disagreements (decision_id);

CREATE INDEX ix_git_changes_commit ON git_changes (commit_hash);

CREATE INDEX ix_git_changes_decision ON git_changes (decision_id);

CREATE INDEX ix_policy_results_decision ON policy_results (decision_id);

CREATE INDEX ix_reviews_decision ON reviews (decision_id);
