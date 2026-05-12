package commands

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/spf13/cobra"

	"github.com/ericvaillancourt/govforge/cli/internal/client"
	"github.com/ericvaillancourt/govforge/cli/internal/render"
)

// NewReviewCmd returns `gf review` with subcommands request / submit / list / show.
//
// `submit` was added in Stage C item C to give a non-agent path for recording
// reviews — CI pipelines, demos, devs without a connected MCP client. Agents
// still get the richer MCP `submit_review` tool, which shares the backend
// implementation.
func NewReviewCmd(flags *RootFlags) *cobra.Command {
	cmd := &cobra.Command{Use: "review", Short: "Request, submit and inspect reviews"}
	cmd.AddCommand(
		newReviewRequestCmd(flags),
		newReviewSubmitCmd(flags),
		newReviewListCmd(flags),
		newReviewShowCmd(flags),
	)
	return cmd
}

func newReviewRequestCmd(flags *RootFlags) *cobra.Command {
	var (
		decisionID string
		reviewer   string
		focusList  []string
	)
	cmd := &cobra.Command{
		Use:   "request",
		Short: "Request a review on a decision",
		RunE: func(_ *cobra.Command, _ []string) error {
			ctx, err := Resolve(flags, true)
			if err != nil {
				return err
			}
			updated, err := ctx.Client.RequestReview(client.RequestReviewInput{
				DecisionID:    decisionID,
				ReviewerAgent: reviewer,
				Focus:         focusList,
			})
			if err != nil {
				return err
			}
			if ctx.Out.JSON {
				return ctx.Out.JSON1(updated)
			}
			ctx.Out.Heading("Review requested")
			ctx.Out.Detail("decision", updated.DisplayID)
			ctx.Out.Detail("status", ctx.Out.Status(updated.Status))
			ctx.Out.Detail("reviewer", reviewer)
			return nil
		},
	}
	cmd.Flags().StringVar(&decisionID, "decision", "", "Decision display ID (required)")
	cmd.Flags().StringVar(&reviewer, "reviewer", "", "Reviewer agent name (required)")
	cmd.Flags().StringSliceVar(&focusList, "focus", nil, "Focus areas (e.g. security,tests)")
	_ = cmd.MarkFlagRequired("decision")
	_ = cmd.MarkFlagRequired("reviewer")
	return cmd
}

func newReviewSubmitCmd(flags *RootFlags) *cobra.Command {
	var (
		reviewer     string
		status       string
		summary      string
		findingArgs  []string
		findingsFile string
	)
	cmd := &cobra.Command{
		Use:   "submit DEC-NNN",
		Short: "Submit a review with structured findings",
		Long: `Submit a structured Review on a decision.

Findings can be provided two ways:

  --finding 'severity=medium;category=docs;message=...;recommendation=...'
      Repeatable. Inside a single --finding the separator is ';' (not ',') so
      you can include commas in the message without quoting hell. Supported
      keys: severity (required), category (required), message (required),
      file_path, line_start, line_end, recommendation.

  --findings-file findings.json
      Path to a JSON array of finding objects. Use this when you have many
      findings or messages with mixed punctuation.

Valid severity: info, low, medium, high, critical.
Valid category: security, performance, architecture, bug, maintainability,
                tests, docs, accessibility.
Valid status:   approved, changes_requested, commented, rejected.`,
		Args: cobra.ExactArgs(1),
		RunE: func(_ *cobra.Command, args []string) error {
			ctx, err := Resolve(flags, true)
			if err != nil {
				return err
			}
			findings, err := collectFindings(findingArgs, findingsFile)
			if err != nil {
				return err
			}
			in := client.SubmitReviewInput{
				DecisionID:    args[0],
				ReviewerAgent: reviewer,
				Status:        status,
				Findings:      findings,
			}
			if summary != "" {
				in.Summary = &summary
			}
			r, err := ctx.Client.SubmitReview(in)
			if err != nil {
				return err
			}
			if ctx.Out.JSON {
				return ctx.Out.JSON1(r)
			}
			ctx.Out.Heading("Review submitted")
			ctx.Out.Detail("review", r.DisplayID)
			ctx.Out.Detail("decision", r.DecisionID)
			ctx.Out.Detail("status", ctx.Out.Status(r.Status))
			ctx.Out.Detail("findings", itoa(len(r.Findings)))
			return nil
		},
	}
	cmd.Flags().StringVar(&reviewer, "reviewer", "", "Reviewer agent name (required)")
	cmd.Flags().StringVar(&status, "status", "", "approved | changes_requested | commented | rejected (required)")
	cmd.Flags().StringVar(&summary, "summary", "", "One-line summary of the review")
	cmd.Flags().StringArrayVar(&findingArgs, "finding", nil,
		"Finding spec, ';'-separated key=value pairs. Repeatable. See --help.")
	cmd.Flags().StringVar(&findingsFile, "findings-file", "", "Path to a JSON array of findings")
	_ = cmd.MarkFlagRequired("reviewer")
	_ = cmd.MarkFlagRequired("status")
	return cmd
}

// collectFindings merges --finding flags and --findings-file into one slice.
// Either source can be empty; both can be combined. The function validates
// each finding has the three required keys (severity, category, message)
// before returning.
func collectFindings(specs []string, jsonPath string) ([]client.FindingInput, error) {
	out := make([]client.FindingInput, 0, len(specs))
	for i, s := range specs {
		f, err := parseFindingSpec(s)
		if err != nil {
			return nil, fmt.Errorf("--finding[%d]: %w", i, err)
		}
		out = append(out, f)
	}
	if jsonPath != "" {
		b, err := os.ReadFile(jsonPath)
		if err != nil {
			return nil, fmt.Errorf("--findings-file: %w", err)
		}
		var loaded []client.FindingInput
		if err := json.Unmarshal(b, &loaded); err != nil {
			return nil, fmt.Errorf("--findings-file: not a JSON array of findings: %w", err)
		}
		for i, f := range loaded {
			if err := validateFinding(f); err != nil {
				return nil, fmt.Errorf("--findings-file[%d]: %w", i, err)
			}
		}
		out = append(out, loaded...)
	}
	return out, nil
}

// parseFindingSpec turns "severity=medium;category=docs;message=..." into a
// FindingInput. Empty entries between separators are skipped so trailing ';'
// is tolerated.
func parseFindingSpec(spec string) (client.FindingInput, error) {
	var f client.FindingInput
	for _, part := range strings.Split(spec, ";") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		key, val, ok := strings.Cut(part, "=")
		if !ok {
			return f, fmt.Errorf("bad pair %q (expected key=value)", part)
		}
		key = strings.TrimSpace(key)
		val = strings.TrimSpace(val)
		switch key {
		case "severity":
			f.Severity = val
		case "category":
			f.Category = val
		case "message":
			f.Message = val
		case "file", "file_path":
			f.FilePath = strPtr(val)
		case "line_start":
			n, err := strconv.Atoi(val)
			if err != nil {
				return f, fmt.Errorf("line_start must be an integer, got %q", val)
			}
			f.LineStart = &n
		case "line_end":
			n, err := strconv.Atoi(val)
			if err != nil {
				return f, fmt.Errorf("line_end must be an integer, got %q", val)
			}
			f.LineEnd = &n
		case "recommendation":
			f.Recommendation = strPtr(val)
		default:
			return f, fmt.Errorf("unknown key %q (allowed: severity, category, message, file, line_start, line_end, recommendation)", key)
		}
	}
	if err := validateFinding(f); err != nil {
		return f, err
	}
	return f, nil
}

func validateFinding(f client.FindingInput) error {
	if f.Severity == "" {
		return fmt.Errorf("severity is required")
	}
	if f.Category == "" {
		return fmt.Errorf("category is required")
	}
	if f.Message == "" {
		return fmt.Errorf("message is required")
	}
	return nil
}

func strPtr(s string) *string { return &s }

func newReviewListCmd(flags *RootFlags) *cobra.Command {
	var openOnly bool
	cmd := &cobra.Command{
		Use:   "list",
		Short: "List reviews",
		RunE: func(_ *cobra.Command, _ []string) error {
			ctx, err := Resolve(flags, true)
			if err != nil {
				return err
			}
			reviews, err := ctx.Client.ListReviews(ctx.Cfg.ProjectPath, openOnly)
			if err != nil {
				return err
			}
			rows := make([]render.Row, len(reviews))
			for i, r := range reviews {
				rows[i] = render.Row{
					r.DisplayID,
					ctx.Out.Status(r.Status),
					itoa(len(r.Findings)),
					render.Truncate(render.Strp(r.Summary), 60),
				}
			}
			return ctx.Out.JSONOrTable(reviews, []string{"ID", "Status", "Findings", "Summary"}, rows)
		},
	}
	cmd.Flags().BoolVar(&openOnly, "open", false, "Only reviews on decisions still in REVIEW_REQUIRED")
	return cmd
}

func newReviewShowCmd(flags *RootFlags) *cobra.Command {
	return &cobra.Command{
		Use:   "show REV-NNN",
		Short: "Show one review with its findings",
		Args:  cobra.ExactArgs(1),
		RunE: func(_ *cobra.Command, args []string) error {
			ctx, err := Resolve(flags, true)
			if err != nil {
				return err
			}
			r, err := ctx.Client.GetReview(args[0])
			if err != nil {
				return err
			}
			if ctx.Out.JSON {
				return ctx.Out.JSON1(r)
			}
			ctx.Out.Heading("Review " + r.DisplayID)
			ctx.Out.Detail("decision", r.DecisionID)
			ctx.Out.Detail("status", ctx.Out.Status(r.Status))
			ctx.Out.Detail("summary", render.Strp(r.Summary))
			if len(r.Findings) > 0 {
				rows := make([]render.Row, len(r.Findings))
				for i, f := range r.Findings {
					rows[i] = render.Row{ctx.Out.Status(f.Severity), f.Category, render.Strp(f.FilePath), f.Message}
				}
				_ = ctx.Out.Table([]string{"Severity", "Category", "File", "Message"}, rows)
			}
			return nil
		},
	}
}
