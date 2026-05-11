// Package render is gf's output layer: tables for humans, JSON for machines.
//
// Every command should funnel its result through one of:
//
//   - render.JSONOrTable(...) for list/table output
//   - render.JSON(...) when the data isn't tabular
//   - render.Heading / render.Detail for free-form formatting
//
// JSON output is always written exactly as encoded (no styling) so it is
// trivially pipeable.
package render

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/jedib0t/go-pretty/v6/table"
	"github.com/jedib0t/go-pretty/v6/text"
)

// Output captures the side-effecting bits of a render call so tests can
// pin everything to a buffer instead of os.Stdout.
type Output struct {
	W       io.Writer
	JSON    bool
	NoColor bool
}

// Default returns an Output bound to stdout.
func Default(jsonOut, noColor bool) Output {
	return Output{W: os.Stdout, JSON: jsonOut, NoColor: noColor}
}

// Row represents a single table row; values are stringified before printing.
type Row []any

// JSONOrTable prints `data` either as JSON (when --json) or as a styled table.
//
// `data` must be the actual payload (slice / struct / map) — JSON mode encodes
// it verbatim, while the table mode walks the supplied `headers` + `rows`.
func (o Output) JSONOrTable(data any, headers []string, rows []Row) error {
	if o.JSON {
		return o.JSON1(data)
	}
	return o.Table(headers, rows)
}

// JSON1 encodes `data` as indented JSON. Named with a trailing 1 to avoid
// clashing with the encoding/json import in callers.
func (o Output) JSON1(data any) error {
	enc := json.NewEncoder(o.W)
	enc.SetIndent("", "  ")
	return enc.Encode(data)
}

// Table renders a styled go-pretty table.
func (o Output) Table(headers []string, rows []Row) error {
	t := table.NewWriter()
	t.SetOutputMirror(o.W)
	t.SetStyle(table.StyleRounded)
	if !o.NoColor {
		t.Style().Color.Header = text.Colors{text.FgHiCyan, text.Bold}
	}

	hdrs := make(table.Row, len(headers))
	for i, h := range headers {
		hdrs[i] = h
	}
	t.AppendHeader(hdrs)

	for _, r := range rows {
		t.AppendRow(table.Row(r))
	}
	t.Render()
	return nil
}

// Heading prints a styled section heading (no-op styling when NoColor is true).
func (o Output) Heading(title string) {
	if o.JSON {
		return
	}
	if o.NoColor {
		_, _ = fmt.Fprintln(o.W, title)
		return
	}
	style := lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("12"))
	_, _ = fmt.Fprintln(o.W, style.Render(title))
}

// Detail prints a key: value line.
func (o Output) Detail(key, value string) {
	if o.JSON {
		return
	}
	if o.NoColor {
		_, _ = fmt.Fprintf(o.W, "%s: %s\n", key, value)
		return
	}
	keyStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("8"))
	_, _ = fmt.Fprintf(o.W, "%s %s\n", keyStyle.Render(key+":"), value)
}

// Status returns a styled status string (e.g. "approved", "blocked").
func (o Output) Status(s string) string {
	if o.JSON || o.NoColor {
		return s
	}
	switch strings.ToLower(s) {
	case "approved", "passed", "ok":
		return lipgloss.NewStyle().Foreground(lipgloss.Color("10")).Render(s)
	case "rejected", "blocked":
		return lipgloss.NewStyle().Foreground(lipgloss.Color("9")).Render(s)
	case "warning", "review_required", "changes_requested":
		return lipgloss.NewStyle().Foreground(lipgloss.Color("11")).Render(s)
	default:
		return s
	}
}

// Strp returns "" for nil, *p otherwise.
func Strp(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

// Truncate returns s if it fits in n runes, else a "…"-ellipsis.
func Truncate(s string, n int) string {
	if len([]rune(s)) <= n {
		return s
	}
	r := []rune(s)
	return string(r[:n-1]) + "…"
}
