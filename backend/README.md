# GovForge Backend

Python backend for GovForge: FastMCP server, FastAPI HTTP API, services, SQLAlchemy models.

## Stack

- Python 3.12+
- [FastMCP](https://github.com/jlowin/fastmcp) — MCP server framework
- [FastAPI](https://fastapi.tiangolo.com/) — local HTTP API
- SQLAlchemy 2 + Alembic — ORM + migrations
- Pydantic v2 — schemas
- SQLite (Phase 1, local-only) → Postgres (Phase 3 SaaS)

## Layout

```
backend/
├── pyproject.toml
├── src/govforge/
│   ├── core/      # models, services, events, git, policies
│   ├── mcp/       # FastMCP server, tools, resources, prompts
│   ├── api/       # FastAPI app, routes
│   └── db/        # session, schema.sql, migrations/
└── tests/
    ├── unit/
    └── integration/
```

## Setup (dev)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
pytest
ruff check .
mypy src
```

## Running

The user-facing CLI is `gf` (Go binary, in `../cli/`). The backend is meant to be spawned by `gf mcp serve` / `gf api serve` / `gf ui serve`. For local development, you can run components directly:

```bash
# MCP server (stdio)
python -m govforge.mcp.server

# HTTP API
uvicorn govforge.api.app:app --host 127.0.0.1 --port 8787 --reload
```

## License

Apache 2.0 — see [`../LICENSE`](../LICENSE).
