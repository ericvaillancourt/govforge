"""Alembic migration tests.

Two guarantees we want to keep tight:

1. The model layer (`Base.metadata`) and the migration head agree —
   i.e. someone can't add a column to a model and forget the migration.
2. The helper `python -m govforge.scripts.migrate` works end-to-end on a
   fresh SQLite DB (upgrade head → all tables present + alembic_version row).
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect

from govforge.core.models import Base


@pytest.fixture()
def fresh_sqlite_url(tmp_path: Path) -> str:
    """SQLite URL pointing at a per-test file."""
    db = tmp_path / "alembic.db"
    return f"sqlite:///{db}"


def _run_migrate(*args: str, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    """Invoke `python -m govforge.scripts.migrate <args>` and return result."""
    import os

    cmd = [sys.executable, "-m", "govforge.scripts.migrate", *args]
    full_env = {**os.environ, **(env or {})}
    return subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        env=full_env,
        timeout=30,
        check=False,
    )


def test_upgrade_head_creates_all_tables(fresh_sqlite_url: str) -> None:
    """`migrate upgrade head` on an empty DB applies the baseline."""
    res = _run_migrate("upgrade", "head", env={"GOVFORGE_DATABASE_URL": fresh_sqlite_url})
    assert res.returncode == 0, f"stderr: {res.stderr}\nstdout: {res.stdout}"

    eng = create_engine(fresh_sqlite_url)
    tables = set(inspect(eng).get_table_names())
    # alembic_version is the migration bookkeeping table.
    assert "alembic_version" in tables
    # Every model table should be present.
    expected = set(Base.metadata.tables.keys())
    missing = expected - tables
    assert not missing, f"missing tables after upgrade: {sorted(missing)}"


def test_current_after_upgrade_is_head(fresh_sqlite_url: str) -> None:
    """After upgrade the version table reflects the migration head."""
    _run_migrate("upgrade", "head", env={"GOVFORGE_DATABASE_URL": fresh_sqlite_url})
    res = _run_migrate("current", env={"GOVFORGE_DATABASE_URL": fresh_sqlite_url})
    assert res.returncode == 0
    # `current` prints "<revision> (head)" when the DB is at the latest migration.
    # Check for the "(head)" marker rather than a specific revision so this test
    # doesn't break every time a new migration is added.
    assert "(head)" in (res.stdout + res.stderr)


def test_stamp_marks_pre_existing_schema(fresh_sqlite_url: str) -> None:
    """`migrate stamp head` on a create_all'd DB sets the version without DDL."""
    eng = create_engine(fresh_sqlite_url)
    Base.metadata.create_all(eng)
    # Before stamp: alembic_version table doesn't exist.
    pre_tables = set(inspect(eng).get_table_names())
    assert "alembic_version" not in pre_tables

    res = _run_migrate("stamp", "head", env={"GOVFORGE_DATABASE_URL": fresh_sqlite_url})
    assert res.returncode == 0, f"stderr: {res.stderr}\nstdout: {res.stdout}"

    eng2 = create_engine(fresh_sqlite_url)
    post = set(inspect(eng2).get_table_names())
    assert "alembic_version" in post
    eng2.dispose()


def test_check_clean_after_upgrade(fresh_sqlite_url: str) -> None:
    """After upgrade head, `migrate check` reports no pending changes.

    This is the safety net against model drift: if a developer mutates a
    SQLAlchemy model without writing a migration, this test fails.
    """
    _run_migrate("upgrade", "head", env={"GOVFORGE_DATABASE_URL": fresh_sqlite_url})
    res = _run_migrate("check", env={"GOVFORGE_DATABASE_URL": fresh_sqlite_url})
    # Alembic exits 0 + prints "No new upgrade operations detected." when clean.
    assert res.returncode == 0, (
        "Model drift detected — there are unmigrated model changes. "
        f"Run `alembic revision --autogenerate -m '...'` from backend/.\n"
        f"stderr: {res.stderr}\nstdout: {res.stdout}"
    )
