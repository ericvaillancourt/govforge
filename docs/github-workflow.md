# GitHub Workflow — Branch, PR, Review, Merge

> A complete walkthrough of the standard GitHub Flow for a developer
> working on any project. Pair this with
> [`workflow-example.md`](workflow-example.md) once you're comfortable
> with the basics — that one shows how GovForge layers governance on top
> of this same flow.

**TL;DR — yes, create a new branch every time you work on a feature, a
fix, or any change.** The `main` branch must always stay stable and
deployable.

## Step 1 — Sync your local `main`

Before starting any new task, make sure you have the latest version:

```bash
git checkout main
git pull origin main
```

## Step 2 — Create a dedicated branch

One branch per task, feature, or bug fix. The typical naming convention:

```bash
# Format: type/short-description
git checkout -b feature/add-oauth-authentication
git checkout -b fix/pdf-vectorization-bug
git checkout -b refactor/optimize-rag-pipeline
git checkout -b docs/update-readme
```

Common prefixes: `feature/`, `fix/`, `hotfix/`, `refactor/`, `docs/`,
`test/`, `chore/`.

## Step 3 — Develop and commit regularly

Make small, atomic commits (one idea per commit) with clear messages.
The [Conventional Commits](https://www.conventionalcommits.org/)
specification is widely adopted:

```bash
git add modified_file.py
git commit -m "feat: add /api/vectorize endpoint for async processing"
git commit -m "fix: correct timeout on documents > 100 pages"
git commit -m "refactor: extract embedding logic into dedicated module"
```

Common types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`,
`chore`, `perf`.

## Step 4 — Push your branch to GitHub

```bash
# First push (creates the remote branch)
git push -u origin feature/add-oauth-authentication

# Subsequent pushes
git push
```

## Step 5 — Open a Pull Request (PR)

On GitHub, click **Compare & pull request**. A good PR contains:

- **Clear title** — e.g. `feat: add OAuth authentication via Azure Entra ID`
- **Structured description**:
  - *Context* — why this change is being made
  - *Changes* — what was modified
  - *Tests performed* — how you validated it
  - *Screenshots / logs* — if relevant
  - *Linked issues* — e.g. `Closes #42`
- **Assigned reviewers** — the people who should validate the change
- **Labels** — `bug`, `enhancement`, `needs-review`, etc.

## Step 6 — Code review (the critical step)

This is where your team (or yourself, on personal projects) examines the
code. The reviewer will:

- Read the changes in the **Files changed** tab
- Leave inline comments on specific lines
- Suggest modifications directly using GitHub's `suggestion` syntax
- Choose an action:
  - **Approve** ✅ — ready to merge
  - **Request changes** ❌ — modifications required
  - **Comment** 💬 — feedback without blocking

## Step 7 — Iterate on the feedback

Respond to comments, update the code, then:

```bash
# On your feature branch
git add .
git commit -m "fix: apply review suggestions (input validation)"
git push
```

The PR updates automatically. Mark each thread as **Resolved** as you
address it.

## Step 8 — Keep your branch up to date with `main`

If `main` has moved forward during the review, sync your branch:

```bash
# Option 1 — Merge (preserves full history, but "noisy")
git checkout feature/my-branch
git merge main

# Option 2 — Rebase (clean history, recommended)
git checkout feature/my-branch
git rebase main
git push --force-with-lease  # --force-with-lease is safer than --force
```

`--force-with-lease` refuses the push if someone else has pushed to your
branch in the meantime — a safety net against accidentally overwriting
teammates' work.

## Step 9 — Merge the PR

Once the PR is approved and CI/tests are green, merge it on GitHub.
There are three merge strategies:

| Strategy | When to use it |
|---|---|
| **Merge commit** | Preserves the full branch history (useful for complex features). |
| **Squash and merge** | Combines every branch commit into a single one (recommended for PRs with many small commits). |
| **Rebase and merge** | Linear history with no merge commit (for teams that demand a pristine `git log`). |

For most teams, **Squash and merge** is the most practical default.

## Step 10 — Clean up

```bash
git checkout main
git pull origin main
git branch -d feature/my-branch   # delete the local branch
# GitHub shows a "Delete branch" button to remove the remote branch
```

## Variants depending on context

**Solo on personal projects.** You can simplify — creating a branch is
still useful to isolate experimental work, but you can self-approve your
own PRs. It's also a great way to keep a clean history and easily roll
back later.

**Team setting with clients.** The full flow applies: required
reviewers, branch protection rules on `main` (no direct push), mandatory
CI/CD before merge, and possibly a more structured workflow like
**Git Flow** (with `develop`, `release/`, and `hotfix/` branches) when
you ship versioned releases.

## Going further

1. **Branch protection rules** — enable them on `main` in
   *Settings → Branches*: require PRs, require reviews, and require
   green CI checks before merging.
2. **PR templates** — add a `.github/PULL_REQUEST_TEMPLATE.md` file to
   standardize PR descriptions across the team.
3. **GitHub Actions** — automate tests, linting (e.g. `ruff`, `black`
   for Python), and security checks on every PR.
4. **`gh` CLI** — install it (`brew install gh` or equivalent) to manage
   PRs straight from the terminal: `gh pr create`, `gh pr review`,
   `gh pr merge`.
5. **`CODEOWNERS`** — assign reviewers automatically based on which
   files are modified. Particularly useful for Django/Python projects
   with clear module ownership.

## Where GovForge fits in

This workflow is the foundation. GovForge sits on top of it: when you
commit, push, and open a PR, GovForge records the decision, attaches the
diff, runs policy checks, and tracks reviews and disagreements in an
append-only audit trail.

Once you're comfortable with the GitHub flow above, read
[`workflow-example.md`](workflow-example.md) for the CLI version of the
governed flow, or
[`workflow-example-agents.md`](workflow-example-agents.md) for the
agent-driven version where Claude Code and Codex do most of the work.
