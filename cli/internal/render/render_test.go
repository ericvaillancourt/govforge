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
