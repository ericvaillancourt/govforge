"""Tests for the read-only Git extractor."""

from __future__ import annotations

import subprocess
from collections.abc import Generator
from pathlib import Path

import pytest

from govforge.core.git import (
    CommitNotFoundError,
    GitChangeData,
    PathOutsideRepoError,
    RepoNotFoundError,
    assert_path_in_repo,
    compute_diff_hash,
    count_changes,
    extract_commit,
    get_diff_text,
    list_changed_files,
    open_repo,
    resolve_commit,
)


def _run(cwd: Path, *args: str) -> None:
    """Run a git command, capturing output and raising on failure."""
    subprocess.run(
        ["git", *args],
        cwd=cwd,
        check=True,
        capture_output=True,
        text=True,
    )


@pytest.fixture()
def empty_repo(tmp_path: Path) -> Generator[Path]:
    """Initialized but empty Git repo."""
    repo_dir = tmp_path / "empty"
    repo_dir.mkdir()
    _run(repo_dir, "init", "-q", "-b", "main")
    _run(repo_dir, "config", "user.email", "test@example.com")
    _run(repo_dir, "config", "user.name", "Test User")
    yield repo_dir


@pytest.fixture()
def repo_with_commits(empty_repo: Path) -> Path:
    """Repo with two commits and a multi-file change in the second."""
    (empty_repo / "README.md").write_text("# hello\n")
    _run(empty_repo, "add", "README.md")
    _run(empty_repo, "commit", "-q", "-m", "initial")

    (empty_repo / "auth.py").write_text("def login():\n    pass\n")
    (empty_repo / "middleware").mkdir()
    (empty_repo / "middleware" / "session.py").write_text("# session\n")
    (empty_repo / "README.md").write_text("# hello\nupdated\n")
    _run(empty_repo, "add", ".")
    _run(empty_repo, "commit", "-q", "-m", "second")
    return empty_repo


def test_open_repo_rejects_non_repo(tmp_path: Path) -> None:
    plain = tmp_path / "not-a-repo"
    plain.mkdir()
    with pytest.raises(RepoNotFoundError):
        open_repo(plain)


def test_open_repo_accepts_valid_repo(empty_repo: Path) -> None:
    repo = open_repo(empty_repo)
    assert Path(repo.working_dir).resolve() == empty_repo.resolve()


def test_resolve_commit_unknown_rev_raises(empty_repo: Path) -> None:
    repo = open_repo(empty_repo)
    with pytest.raises(CommitNotFoundError):
        resolve_commit(repo, "deadbeef0000")


def test_resolve_commit_head(repo_with_commits: Path) -> None:
    repo = open_repo(repo_with_commits)
    head = resolve_commit(repo, "HEAD")
    assert head.message.strip() == "second"


def test_list_changed_files_initial_commit(empty_repo: Path) -> None:
    (empty_repo / "x.txt").write_text("x\n")
    _run(empty_repo, "add", ".")
    _run(empty_repo, "commit", "-q", "-m", "init")

    repo = open_repo(empty_repo)
    files = list_changed_files(repo, "HEAD")
    assert files == ["x.txt"]


def test_list_changed_files_second_commit(repo_with_commits: Path) -> None:
    repo = open_repo(repo_with_commits)
    files = list_changed_files(repo, "HEAD")
    assert "auth.py" in files
    assert "middleware/session.py" in files
    assert "README.md" in files


def test_count_changes(repo_with_commits: Path) -> None:
    repo = open_repo(repo_with_commits)
    insertions, deletions = count_changes(repo, "HEAD")
    assert insertions > 0
    assert deletions >= 0


def test_get_diff_text_non_empty(repo_with_commits: Path) -> None:
    repo = open_repo(repo_with_commits)
    diff = get_diff_text(repo, "HEAD")
    assert "auth.py" in diff
    assert "middleware/session.py" in diff


def test_diff_hash_deterministic() -> None:
    a = compute_diff_hash("hello")
    b = compute_diff_hash("hello")
    c = compute_diff_hash("world")
    assert a == b
    assert a != c
    assert a.startswith("sha256:")
    assert len(a) == len("sha256:") + 64


def test_extract_commit_full(repo_with_commits: Path) -> None:
    data = extract_commit(repo_with_commits, "HEAD")
    assert isinstance(data, GitChangeData)
    assert data.commit_hash and len(data.commit_hash) == 40
    assert data.parent_commit_hash and len(data.parent_commit_hash) == 40
    assert data.parent_commit_hash != data.commit_hash
    assert data.diff_hash.startswith("sha256:")
    assert data.branch_name == "main"
    assert "auth.py" in data.files_changed
    assert "middleware/session.py" in data.files_changed
    assert data.insertions > 0
    assert data.repo_path == str(repo_with_commits.resolve())


def test_extract_commit_initial(empty_repo: Path) -> None:
    (empty_repo / "only.txt").write_text("only\n")
    _run(empty_repo, "add", ".")
    _run(empty_repo, "commit", "-q", "-m", "alone")

    data = extract_commit(empty_repo, "HEAD")
    assert data.parent_commit_hash is None
    assert data.files_changed == ["only.txt"]


def test_extract_commit_to_dict(repo_with_commits: Path) -> None:
    data = extract_commit(repo_with_commits, "HEAD")
    d = data.to_dict()
    assert set(d.keys()) == {
        "repo_path",
        "branch_name",
        "commit_hash",
        "parent_commit_hash",
        "diff_hash",
        "files_changed",
        "insertions",
        "deletions",
    }
    assert isinstance(d["files_changed"], list)


def test_assert_path_in_repo_accepts_inside(repo_with_commits: Path) -> None:
    repo = open_repo(repo_with_commits)
    inside = repo_with_commits / "auth.py"
    resolved = assert_path_in_repo(repo, inside)
    assert resolved == inside.resolve()


def test_assert_path_in_repo_rejects_outside(repo_with_commits: Path, tmp_path: Path) -> None:
    repo = open_repo(repo_with_commits)
    outside = tmp_path / "other-file.txt"
    outside.write_text("nope")
    with pytest.raises(PathOutsideRepoError):
        assert_path_in_repo(repo, outside)


def test_extract_commit_invalid_path(tmp_path: Path) -> None:
    plain = tmp_path / "not-git"
    plain.mkdir()
    with pytest.raises(RepoNotFoundError):
        extract_commit(plain, "HEAD")


def test_extract_commit_invalid_rev(repo_with_commits: Path) -> None:
    with pytest.raises(CommitNotFoundError):
        extract_commit(repo_with_commits, "deadbeef0000")
