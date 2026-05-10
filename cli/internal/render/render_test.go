package render

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"
)

func TestJSONOutputIsExactlyTheData(t *testing.T) {
	var buf bytes.Buffer
	out := Output{W: &buf, JSON: true, NoColor: true}
	data := map[string]any{"task_id": "TASK-001", "status": "open"}
	if err := out.JSON1(data); err != nil {
		t.Fatalf("JSON1: %v", err)
	}
	var roundtrip map[string]any
	if err := json.Unmarshal(buf.Bytes(), &roundtrip); err != nil {
		t.Fatalf("not valid JSON: %v\n%s", err, buf.String())
	}
	if roundtrip["task_id"] != "TASK-001" || roundtrip["status"] != "open" {
		t.Fatalf("payload changed: %+v", roundtrip)
	}
}

func TestTableContainsAllColumns(t *testing.T) {
	var buf bytes.Buffer
	out := Output{W: &buf, NoColor: true}
	rows := []Row{{"TASK-001", "Refactor auth", "high", "open"}}
	if err := out.Table([]string{"ID", "Title", "Risk", "Status"}, rows); err != nil {
		t.Fatalf("Table: %v", err)
	}
	got := buf.String()
	// go-pretty uppercases headers by default. We assert the table is structurally
	// complete, not exact casing of the header row.
	for _, want := range []string{"TASK-001", "Refactor auth", "high", "open", "TITLE"} {
		if !strings.Contains(got, want) {
			t.Fatalf("table missing %q in:\n%s", want, got)
		}
	}
}

func TestStatusNoColorIsIdentity(t *testing.T) {
	out := Output{NoColor: true}
	if got := out.Status("approved"); got != "approved" {
		t.Fatalf("expected identity, got %q", got)
	}
}

func TestTruncate(t *testing.T) {
	if got := Truncate("hello world", 5); got != "hell…" {
		t.Fatalf("got %q", got)
	}
	if got := Truncate("ok", 5); got != "ok" {
		t.Fatalf("got %q", got)
	}
}

func TestStrpHandlesNil(t *testing.T) {
	if got := Strp(nil); got != "" {
		t.Fatalf("Strp(nil) should be empty, got %q", got)
	}
	v := "hello"
	if got := Strp(&v); got != "hello" {
		t.Fatalf("Strp(&v): %q", got)
	}
}

func TestHeadingNoColor(t *testing.T) {
	var buf bytes.Buffer
	Output{W: &buf, NoColor: true}.Heading("Project")
	if !strings.Contains(buf.String(), "Project") {
		t.Fatalf("missing heading text: %s", buf.String())
	}
}

func TestHeadingSuppressedInJSON(t *testing.T) {
	var buf bytes.Buffer
	Output{W: &buf, JSON: true}.Heading("Project")
	if buf.Len() != 0 {
		t.Fatalf("JSON mode should suppress heading, got %q", buf.String())
	}
}

func TestDetailNoColor(t *testing.T) {
	var buf bytes.Buffer
	Output{W: &buf, NoColor: true}.Detail("path", "/tmp/x")
	got := buf.String()
	if !strings.Contains(got, "path") || !strings.Contains(got, "/tmp/x") {
		t.Fatalf("missing detail content: %s", got)
	}
}

func TestDetailSuppressedInJSON(t *testing.T) {
	var buf bytes.Buffer
	Output{W: &buf, JSON: true}.Detail("path", "/tmp/x")
	if buf.Len() != 0 {
		t.Fatalf("JSON mode should suppress detail, got %q", buf.String())
	}
}

func TestStatusKnownValues(t *testing.T) {
	out := Output{} // colour enabled
	for _, s := range []string{"approved", "passed", "rejected", "blocked", "warning", "review_required", "anything"} {
		got := out.Status(s)
		if !strings.Contains(got, s) {
			t.Fatalf("Status(%q) should embed input, got %q", s, got)
		}
	}
}

func TestJSONOrTablePicksJSON(t *testing.T) {
	var buf bytes.Buffer
	out := Output{W: &buf, JSON: true}
	if err := out.JSONOrTable(map[string]string{"a": "b"}, []string{"H"}, []Row{{"v"}}); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(buf.String(), `"a": "b"`) {
		t.Fatalf("JSON branch not taken: %s", buf.String())
	}
}

func TestJSONOrTablePicksTable(t *testing.T) {
	var buf bytes.Buffer
	out := Output{W: &buf, JSON: false, NoColor: true}
	if err := out.JSONOrTable(nil, []string{"Header"}, []Row{{"value"}}); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(buf.String(), "value") {
		t.Fatalf("table branch missing value: %s", buf.String())
	}
}
