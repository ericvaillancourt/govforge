"""Read-only Git extraction for GovForge.

GovForge never writes to a Git repository. This module is the only path
through which the rest of the codebase reads Git state — `extract_commit`,
`list_changed_files`, `count_changes`, `compute_diff_hash`. Anything that
mutates Git is explicitly out of scope.

Security
--------

- All paths are resolved and clamped to live inside the repo root. Symlinks
  pointing outside the repo are rejected.
- We never `git push`, `git rebase`, `git reset`, `git checkout` or any
  command that mutates the working tree or the object store.
- Refs ("HEAD", "main", short SHAs, branch names) are passed through to
  GitPython's `repo.commit(rev)` which is read-only.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from pathlib import Path

from git import Commit, InvalidGitRepositoryError, NoSuchPathError, Repo
from git.exc import BadName, GitCommandError


class GitExtractError(Exception):
    """Raised for any GovForge-level Git extraction failure."""


class RepoNotFoundError(GitExtractError):
    """The path is not a valid Git repository."""


class CommitNotFoundError(GitExtractError):
    """The requested rev does not resolve to a commit."""


class PathOutsideRepoError(GitExtractError):
    """A given path resolves outside the repo root — refused."""


@dataclass(frozen=True)
class GitChangeData:
    """Output of `extract_commit`. Frozen so callers can't accidentally mutate."""

    repo_path: str
    branch_name: str | None
    commit_hash: str
    parent_commit_hash: str | None
    diff_hash: str
    files_changed: list[str] = field(default_factory=list)
    insertions: int = 0
    deletions: int = 0

    def to_dict(self) -> dict[str, object]:
        return {
            "repo_path": self.repo_path,
            "branch_name": self.branch_name,
            "commit_hash": self.commit_hash,
            "parent_commit_hash": self.parent_commit_hash,
            "diff_hash": self.diff_hash,
            "files_changed": list(self.files_changed),
            "insertions": self.insertions,
            "deletions": self.deletions,
        }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def open_repo(repo_path: str | Path) -> Repo:
    """Open a Git repo. Raises RepoNotFoundError if `repo_path` isn't one."""
    try:
        return Repo(str(repo_path), search_parent_directories=False)
    except (InvalidGitRepositoryError, NoSuchPathError) as e:
        raise RepoNotFoundError(f"not a git repository: {repo_path}") from e


def resolve_commit(repo: Repo, rev: str) -> Commit:
    """Resolve a rev (HEAD, branch, SHA) to a commit object."""
    try:
        return repo.commit(rev)
    except (BadName, ValueError, GitCommandError) as e:
        raise CommitNotFoundError(f"unknown rev: {rev}") from e


def assert_path_in_repo(repo: Repo, candidate: str | Path) -> Path:
    """Refuse paths that escape the repo root (after symlink resolution)."""
    repo_root = Path(repo.working_dir).resolve()
    target = Path(candidate).resolve()
    try:
        target.relative_to(repo_root)
    except ValueError as e:
        raise PathOutsideRepoError(f"path outside repo: {target} not under {repo_root}") from e
    return target


def compute_diff_hash(diff_text: str) -> str:
    """SHA-256 of the diff text. Stored alongside GitChange for tamper detection."""
    digest = hashlib.sha256(diff_text.encode("utf-8")).hexdigest()
    return f"sha256:{digest}"


def list_changed_files(repo: Repo, rev: str) -> list[str]:
    """Return the file paths touched by `rev` (vs its first parent, or initial commit)."""
    commit = resolve_commit(repo, rev)
    files: set[str] = set()
    if commit.parents:
        for d in commit.parents[0].diff(commit):
            if d.a_path:
                files.add(d.a_path)
            if d.b_path:
                files.add(d.b_path)
        return sorted(files)
    # Initial commit: every blob in the tree was "added"
    for item in commit.tree.traverse():
        # `traverse` yields Tree | Blob | Submodule (and friends); only blobs are files
        if getattr(item, "type", None) == "blob":
            path = getattr(item, "path", None)
            if path is not None:
                files.add(str(path))
    return sorted(files)


def count_changes(repo: Repo, rev: str) -> tuple[int, int]:
    """Return (insertions, deletions) for `rev` vs its first parent."""
    commit = resolve_commit(repo, rev)
    stats = commit.stats.total
    return int(stats.get("insertions", 0)), int(stats.get("deletions", 0))


def get_diff_text(repo: Repo, rev: str) -> str:
    """Full unified diff text for `rev` vs its first parent (or empty for initial commit)."""
    commit = resolve_commit(repo, rev)
    if not commit.parents:
        # Initial commit: synthetic empty parent baseline
        return str(repo.git.show(commit.hexsha, format="", patch=True))
    return str(
        repo.git.diff(
            commit.parents[0].hexsha,
            commit.hexsha,
            no_color=True,
        )
    )


def current_branch_name(repo: Repo) -> str | None:
    """Best-effort branch name. Returns None on detached HEAD."""
    try:
        return repo.active_branch.name
    except (TypeError, AttributeError):
        return None


def extract_commit(repo_path: str | Path, rev: str = "HEAD") -> GitChangeData:
    """Extract a `GitChangeData` for `rev` in the repo at `repo_path`.

    The returned object is what gets persisted as a `GitChange` row.

    Notes
    -----
    - For an initial commit (no parent), `parent_commit_hash` is None and
      file listing comes from the empty-tree comparison.
    - The `branch_name` is resolved from the repo's current HEAD, NOT from
      the commit. A historic commit attached after a branch switch will
      report the *current* branch — that's a deliberate trade-off that
      matches "what branch is this commit being attached from."
    """
    repo = open_repo(repo_path)
    commit = resolve_commit(repo, rev)
    files = list_changed_files(repo, rev)
    insertions, deletions = count_changes(repo, rev)
    diff_text = get_diff_text(repo, rev)
    diff_hash = compute_diff_hash(diff_text)
    parent_hash = commit.parents[0].hexsha if commit.parents else None

    return GitChangeData(
        repo_path=str(Path(repo.working_dir).resolve()),
        branch_name=current_branch_name(repo),
        commit_hash=commit.hexsha,
        parent_commit_hash=parent_hash,
        diff_hash=diff_hash,
        files_changed=files,
        insertions=insertions,
        deletions=deletions,
    )


__all__ = [
    "CommitNotFoundError",
    "GitChangeData",
    "GitExtractError",
    "PathOutsideRepoError",
    "RepoNotFoundError",
    "assert_path_in_repo",
    "compute_diff_hash",
    "count_changes",
    "current_branch_name",
    "extract_commit",
    "get_diff_text",
    "list_changed_files",
    "open_repo",
    "resolve_commit",
]
