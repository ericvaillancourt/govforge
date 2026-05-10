package commands

import (
	"github.com/spf13/cobra"

	"github.com/ericvaillancourt/govforge/cli/internal/client"
	"github.com/ericvaillancourt/govforge/cli/internal/render"
)

// NewTaskCmd returns `gf task` with subcommands create / list / show.
func NewTaskCmd(flags *RootFlags) *cobra.Command {
	cmd := &cobra.Command{Use: "task", Short: "Manage tasks"}
	cmd.AddCommand(newTaskCreateCmd(flags), newTaskListCmd(flags), newTaskShowCmd(flags))
	return cmd
}

func newTaskCreateCmd(flags *RootFlags) *cobra.Command {
	var (
		title       string
		description string
		risk        string
		actor       string
	)
	cmd := &cobra.Command{
		Use:   "create",
		Short: "Create a task",
		RunE: func(_ *cobra.Command, _ []string) error {
			ctx, err := Resolve(flags, true)
			if err != nil {
				return err
			}
			in := client.CreateTaskInput{
				ProjectPath: ctx.Cfg.ProjectPath,
				Title:       title,
				RiskLevel:   risk,
			}
			if description != "" {
				in.Description = &description
			}
			if actor != "" {
				in.ActorAgent = &actor
			}
			task, err := ctx.Client.CreateTask(in)
			if err != nil {
				return err
			}
			if ctx.Out.JSON {
				return ctx.Out.JSON1(task)
			}
			ctx.Out.Heading("Task created")
			ctx.Out.Detail("id", task.DisplayID)
			ctx.Out.Detail("title", task.Title)
			ctx.Out.Detail("risk", task.RiskLevel)
			ctx.Out.Detail("status", ctx.Out.Status(task.Status))
			return nil
		},
	}
	cmd.Flags().StringVar(&title, "title", "", "Task title (required)")
	cmd.Flags().StringVar(&description, "description", "", "Task description")
	cmd.Flags().StringVar(&risk, "risk", "medium", "Risk level: low|medium|high|critical")
	cmd.Flags().StringVar(&actor, "actor", "", "Agent creating the task (e.g. claude, codex, eric)")
	_ = cmd.MarkFlagRequired("title")
	return cmd
}

func newTaskListCmd(flags *RootFlags) *cobra.Command {
	var status string
	cmd := &cobra.Command{
		Use:   "list",
		Short: "List tasks",
		RunE: func(_ *cobra.Command, _ []string) error {
			ctx, err := Resolve(flags, true)
			if err != nil {
				return err
			}
			tasks, err := ctx.Client.ListTasks(ctx.Cfg.ProjectPath, status)
			if err != nil {
				return err
			}
			rows := make([]render.Row, len(tasks))
			for i, t := range tasks {
				rows[i] = render.Row{t.DisplayID, t.Title, t.RiskLevel, ctx.Out.Status(t.Status)}
			}
			return ctx.Out.JSONOrTable(tasks, []string{"ID", "Title", "Risk", "Status"}, rows)
		},
	}
	cmd.Flags().StringVar(&status, "status", "", "Filter by status (open, in_progress, …)")
	return cmd
}

func newTaskShowCmd(flags *RootFlags) *cobra.Command {
	return &cobra.Command{
		Use:   "show TASK-NNN",
		Short: "Show one task by display ID",
		Args:  cobra.ExactArgs(1),
		RunE: func(_ *cobra.Command, args []string) error {
			ctx, err := Resolve(flags, true)
			if err != nil {
				return err
			}
			task, err := ctx.Client.GetTask(args[0])
			if err != nil {
				return err
			}
			if ctx.Out.JSON {
				return ctx.Out.JSON1(task)
			}
			ctx.Out.Heading("Task " + task.DisplayID)
			ctx.Out.Detail("title", task.Title)
			ctx.Out.Detail("risk", task.RiskLevel)
			ctx.Out.Detail("status", ctx.Out.Status(task.Status))
			ctx.Out.Detail("description", render.Strp(task.Description))
			return nil
		},
	}
}
