"""Alembic environment.

Resolves the database URL from env vars (GOVFORGE_DATABASE_URL or its alias
GOVFORGE_DB) so migrations apply unchanged to local SQLite and prod Postgres.
"""

from __future__ import annotations

import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from govforge.core.models import Base
from govforge.db.session import default_database_url

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Resolve the DB URL the same way the runtime API does so migrations always
# target the same database as the running app.
def _resolve_db_url() -> str:
    env = os.environ.get("GOVFORGE_DATABASE_URL") or os.environ.get("GOVFORGE_DB")
    if env:
        # GOVFORGE_DB may be a bare path (SQLite) — normalise.
        return env if "://" in env else f"sqlite:///{env}"
    return default_database_url()


config.set_main_option("sqlalchemy.url", _resolve_db_url())

# target_metadata: the models registry Alembic compares to the live DB.
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Emit SQL to stdout for review without touching the DB.

    Run via: alembic upgrade head --sql > out.sql
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
        compare_server_default=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Apply migrations against a live engine."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        is_sqlite = connection.dialect.name == "sqlite"
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            # ALTER TABLE on SQLite needs batch mode (table-rebuild) — opt in
            # so future migrations work locally even when adding/dropping
            # columns or constraints.
            render_as_batch=is_sqlite,
            compare_type=True,
            compare_server_default=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
