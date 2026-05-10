package embed

import (
	"strings"
	"testing"
)

func TestSchemaSQLContainsCoreTables(t *testing.T) {
	sql := SchemaSQL()
	if len(sql) < 500 {
		t.Fatalf("schema seems too short: %d bytes", len(sql))
	}
	for _, table := range []string{
		"agents", "projects", "tasks", "decisions", "git_changes",
		"reviews", "findings", "policies", "policy_results",
		"disagreements", "approvals", "events",
	} {
		if !strings.Contains(sql, "CREATE TABLE "+table) {
			t.Errorf("schema missing table %q", table)
		}
	}
}

func TestDefaultPoliciesListsAllFive(t *testing.T) {
	p := DefaultPolicies()
	for _, name := range []string{
		"auth_change_requires_review",
		"secret_pattern_detection",
		"test_required_for_high_risk",
		"migration_requires_review",
		"large_diff_requires_human_approval",
	} {
		if !strings.Contains(p, "["+name+"]") {
			t.Errorf("default policies missing section %q", name)
		}
	}
}

func TestRenderConfigSubstitutes(t *testing.T) {
	out := RenderConfig("my-proj", "develop")
	if !strings.Contains(out, `name = "my-proj"`) {
		t.Errorf("project name not substituted: %s", out)
	}
	if !strings.Contains(out, `default_branch = "develop"`) {
		t.Errorf("default_branch not substituted: %s", out)
	}
	if strings.Contains(out, "{{PROJECT_NAME}}") || strings.Contains(out, "{{DEFAULT_BRANCH}}") {
		t.Error("template placeholder not replaced")
	}
}
