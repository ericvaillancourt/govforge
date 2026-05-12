package commands

import (
	"os"
	"path/filepath"
	"testing"
)

func TestParseFindingSpec_minimumRequired(t *testing.T) {
	f, err := parseFindingSpec("severity=medium;category=docs;message=missing example")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if f.Severity != "medium" || f.Category != "docs" || f.Message != "missing example" {
		t.Fatalf("parsed wrong: %+v", f)
	}
	if f.FilePath != nil || f.LineStart != nil || f.LineEnd != nil || f.Recommendation != nil {
		t.Fatalf("optional fields should be nil, got %+v", f)
	}
}

func TestParseFindingSpec_allFields(t *testing.T) {
	spec := "severity=high;category=security;message=SQLi risk;file=db.py;line_start=12;line_end=18;recommendation=use prepared statements"
	f, err := parseFindingSpec(spec)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if f.Severity != "high" || f.Category != "security" || f.Message != "SQLi risk" {
		t.Fatalf("scalars wrong: %+v", f)
	}
	if f.FilePath == nil || *f.FilePath != "db.py" {
		t.Fatalf("file_path = %v", f.FilePath)
	}
	if f.LineStart == nil || *f.LineStart != 12 {
		t.Fatalf("line_start = %v", f.LineStart)
	}
	if f.LineEnd == nil || *f.LineEnd != 18 {
		t.Fatalf("line_end = %v", f.LineEnd)
	}
	if f.Recommendation == nil || *f.Recommendation != "use prepared statements" {
		t.Fatalf("recommendation = %v", f.Recommendation)
	}
}

func TestParseFindingSpec_allowsCommasInMessage(t *testing.T) {
	// Real-world: messages contain commas. Semicolon as separator means we
	// can put them in without quoting.
	f, err := parseFindingSpec("severity=low;category=tests;message=missing edge case, retry on 5xx")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if f.Message != "missing edge case, retry on 5xx" {
		t.Fatalf("message comma lost: %q", f.Message)
	}
}

func TestParseFindingSpec_filePathAlias(t *testing.T) {
	f, err := parseFindingSpec("severity=info;category=docs;message=x;file_path=README.md")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if f.FilePath == nil || *f.FilePath != "README.md" {
		t.Fatalf("file_path = %v", f.FilePath)
	}
}

func TestParseFindingSpec_trailingSemicolon(t *testing.T) {
	if _, err := parseFindingSpec("severity=low;category=tests;message=x;"); err != nil {
		t.Fatalf("trailing ';' should be tolerated, got %v", err)
	}
}

func TestParseFindingSpec_missingRequired(t *testing.T) {
	cases := map[string]string{
		"no severity":             "category=docs;message=x",
		"no category":              "severity=low;message=x",
		"no message":               "severity=low;category=docs",
		"unknown key":              "severity=low;category=docs;message=x;banana=yes",
		"bad pair (no equals)":     "severity=low;category=docs;just-a-word",
		"bad line_start (not int)": "severity=low;category=docs;message=x;line_start=oops",
	}
	for name, spec := range cases {
		if _, err := parseFindingSpec(spec); err == nil {
			t.Errorf("%s: expected error, got nil for %q", name, spec)
		}
	}
}

func TestCollectFindings_combinesFlagsAndFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "findings.json")
	if err := os.WriteFile(path, []byte(`[
		{"severity": "high", "category": "security", "message": "from json"}
	]`), 0o600); err != nil {
		t.Fatal(err)
	}
	got, err := collectFindings(
		[]string{"severity=low;category=docs;message=from flag"},
		path,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("want 2 findings, got %d", len(got))
	}
	if got[0].Message != "from flag" || got[1].Message != "from json" {
		t.Fatalf("merge order wrong: %+v", got)
	}
}

func TestCollectFindings_fileWithMissingFields(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "findings.json")
	if err := os.WriteFile(path, []byte(`[
		{"severity": "high", "category": "security"}
	]`), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := collectFindings(nil, path); err == nil {
		t.Fatal("expected validation error for missing message")
	}
}
