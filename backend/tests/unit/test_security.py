"""Security attestation tests (devis.md §10.1, §21.5).

These tests pin three security guarantees the project makes publicly:

1. **No shell-out from MCP tools.** Phase 1 MCP tools must never execute
   arbitrary shell commands. We assert this by source-grepping the
   `govforge.mcp` package for forbidden imports and call patterns.

2. **No destructive Git operations.** The Git extractor is read-only.
   We assert by source-grepping `govforge.core.git` for any reference
   to write-side Git verbs (`push`, `reset`, `rebase`, `checkout`,
   `commit`, `gc`, `prune`, `clean`).

3. **Path traversal refused.** `assert_path_in_repo` rejects paths that
   escape the repo root (already tested in test_git.py — we add a
   targeted symlink test here so the contract is documented in one
   security-focused module).

These tests are intentionally simple. A future regression that adds a
shell-out or a destructive Git call to an MCP tool will fail this
attestation immediately, without requiring an integration suite.
"""

from __future__ import annotations

import os
import re
from pathlib import Path

import pytest

from govforge.core import git as core_git

# ---------------------------------------------------------------------------
# Source-grep helpers
# ---------------------------------------------------------------------------


def _module_files(package_root: Path) -> list[Path]:
    """Return every .py file under `package_root` (recursively)."""
    return [p for p in package_root.rglob("*.py") if "__pycache__" not in p.parts]


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def mcp_package_root() -> Path:
    import govforge.mcp as mcp_pkg

    return Path(mcp_pkg.__file__).parent


@pytest.fixture(scope="module")
def core_git_path() -> Path:
    return Path(core_git.__file__)


# ---------------------------------------------------------------------------
# 1. MCP tools never shell-out
# ---------------------------------------------------------------------------


# Patterns that indicate a shell-out / process spawn. We tolerate the strings
# inside docstrings or comments by matching only at statement start (start of
# line OR after `\t` / spaces, followed by the keyword).
_SHELLOUT_RE = re.compile(
    r"(?m)^\s*(?:"
    r"import\s+subprocess|from\s+subprocess\s+import|"
    r"import\s+os\.system|os\.system\(|os\.popen\(|os\.exec[lv][ep]?\(|"
    r"shutil\.spawn[lv][ep]?\(|"
    r"asyncio\.create_subprocess|asyncio\.subprocess"
    r")"
)


def test_mcp_package_does_not_import_subprocess(mcp_package_root: Path) -> None:
    offenders: list[str] = []
    for p in _module_files(mcp_package_root):
        body = _read(p)
        for m in _SHELLOUT_RE.finditer(body):
            offenders.append(f"{p.relative_to(mcp_package_root.parent.parent)}: {m.group(0)!r}")
    assert not offenders, (
        "MCP tools must not invoke subprocess/os.system. Offenders:\n  " + "\n  ".join(offenders)
    )


def test_mcp_tools_do_not_eval_or_exec(mcp_package_root: Path) -> None:
    """`eval()` and `exec()` in tool handlers would be a sandbox escape."""
    bad = re.compile(r"(?<![A-Za-z_])(?:eval|exec)\(")
    offenders: list[str] = []
    for p in _module_files(mcp_package_root):
        body = _read(p)
        # Skip pydoc-style references in comments and docstrings.
        for line_no, line in enumerate(body.splitlines(), start=1):
            stripped = line.lstrip()
            if stripped.startswith("#"):
                continue
            if bad.search(line):
                offenders.append(
                    f"{p.relative_to(mcp_package_root.parent.parent)}:{line_no}: {stripped[:80]}"
                )
    assert not offenders, "eval()/exec() should not appear in MCP code:\n  " + "\n  ".join(
        offenders
    )


# ---------------------------------------------------------------------------
# 2. Git extractor is read-only
# ---------------------------------------------------------------------------


# Any of these substrings in a Git command path is a write operation.
_DESTRUCTIVE_GIT_VERBS = (
    "git.push",
    "git.reset",
    "git.rebase",
    "git.checkout",
    "git.commit",
    "git.merge",
    "git.gc",
    "git.prune",
    "git.clean",
    "git.add",
    "git.rm",
    "git.mv",
    "git.tag",
    "git.branch",
    "git.fetch",
    "git.pull",
)


def test_core_git_has_no_destructive_calls(core_git_path: Path) -> None:
    """`govforge.core.git` must only call read-side Git operations.

    The module talks to GitPython (`Repo.git.<verb>`). Anything matching
    one of the destructive verbs above is a contract violation.
    """
    body = _read(core_git_path)
    offenders: list[str] = []
    for verb in _DESTRUCTIVE_GIT_VERBS:
        if verb in body:
            offenders.append(verb)
    assert not offenders, (
        f"{core_git_path} mentions destructive Git verbs: {offenders}. "
        "The extractor must remain read-only."
    )


def test_core_git_uses_read_only_verbs_only(core_git_path: Path) -> None:
    """Whitelist check: every `repo.git.<x>` and `commit.diff` call must be read-only.

    We extract the names of every `git.X` attribute reference in the file
    and assert the set is a subset of the read-only allowlist.
    """
    body = _read(core_git_path)
    references = set(re.findall(r"\.git\.([a-z_]+)\b", body))
    allowed = {"diff", "show", "log", "rev_parse", "ls_tree", "rev_list", "cat_file"}
    extras = references - allowed
    assert not extras, (
        f"{core_git_path} uses git.* verbs outside the read-only allowlist: {sorted(extras)}. "
        "Either add them to the allowlist (and justify) or replace with a read-only call."
    )


# ---------------------------------------------------------------------------
# 3. Path traversal is refused
# ---------------------------------------------------------------------------


def test_assert_path_in_repo_rejects_symlink_escape(tmp_path: Path) -> None:
    """A symlink that points outside the repo root must be rejected."""
    repo_dir = tmp_path / "repo"
    repo_dir.mkdir()
    # Initialise a real Git repo so open_repo() succeeds.
    import subprocess

    subprocess.run(
        ["git", "init", "-q", "-b", "main"],
        cwd=repo_dir,
        check=True,
        capture_output=True,
    )

    outside = tmp_path / "outside.txt"
    outside.write_text("secret\n")

    link = repo_dir / "evil"
    os.symlink(outside, link)

    repo = core_git.open_repo(repo_dir)
    with pytest.raises(core_git.PathOutsideRepoError):
        core_git.assert_path_in_repo(repo, link)


def test_assert_path_in_repo_accepts_inside_path(tmp_path: Path) -> None:
    repo_dir = tmp_path / "repo"
    repo_dir.mkdir()
    import subprocess

    subprocess.run(
        ["git", "init", "-q", "-b", "main"],
        cwd=repo_dir,
        check=True,
        capture_output=True,
    )

    inside = repo_dir / "subdir" / "f.txt"
    inside.parent.mkdir()
    inside.write_text("ok")

    repo = core_git.open_repo(repo_dir)
    resolved = core_git.assert_path_in_repo(repo, inside)
    assert resolved == inside.resolve()


# ---------------------------------------------------------------------------
# 4. MCP tool registry doesn't expose a shell-style tool
# ---------------------------------------------------------------------------


def test_no_mcp_tool_named_like_shell() -> None:
    """A regression that names a tool `run_shell` / `exec` / `system` etc.
    is almost certainly wrong. We grep for forbidden tool *names* in the
    registration calls.
    """
    from govforge.mcp.tools import register_tools

    forbidden = {"run_shell", "shell", "exec", "system", "spawn"}
    seen: set[str] = set()

    class _Probe:
        def tool(self, *, name: str):  # type: ignore[no-untyped-def]
            seen.add(name)

            def deco(fn):  # type: ignore[no-untyped-def]
                return fn

            return deco

        def resource(self, *_args, **_kwargs):  # type: ignore[no-untyped-def]
            def deco(fn):  # type: ignore[no-untyped-def]
                return fn

            return deco

        def prompt(self, *_args, **_kwargs):  # type: ignore[no-untyped-def]
            def deco(fn):  # type: ignore[no-untyped-def]
                return fn

            return deco

    # Build a placeholder context — register_tools doesn't call into it
    # at registration time.
    from govforge.mcp.context import ServerContext

    ctx = ServerContext(session_factory=lambda: None)  # type: ignore[arg-type]
    register_tools(_Probe(), ctx)  # type: ignore[arg-type]

    leaked = forbidden & seen
    assert not leaked, f"Forbidden tool names registered: {sorted(leaked)}"
    # Sanity: at least the canonical tools we expect are present.
    assert {
        "create_task",
        "record_decision",
        "approve_decision",
    }.issubset(seen)
