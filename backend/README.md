# GovForge Backend

Python backend for GovForge: services + policy engine + FastMCP server + FastAPI HTTP API + SQLAlchemy models.

## Stack

- Python 3.12+
- [FastMCP](https://github.com/jlowin/fastmcp) 3.x — MCP server framework
- [FastAPI](https://fastapi.tiangolo.com/) — local HTTP API on `127.0.0.1:8787`
- SQLAlchemy 2 + Alembic — ORM + migrations
- Pydantic v2 — schemas
- GitPython — read-only Git extraction
- SQLite (Phase 1, local-only) → Postgres (Phase 3 SaaS)

## Layout

```
backend/
├── pyproject.toml
├── src/govforge/
│   ├── core/
│   │   ├── enums.py            # 9 StrEnums (RiskLevel, DecisionStatus, …)
│   │   ├── ids.py              # display-id helpers (TASK-001, DEC-001, …)
│   │   ├── models.py           # 12 SQLAlchemy 2 entities + relationships
│   │   ├── git.py              # read-only Git extractor (allowlisted verbs)
│   │   ├── policies/           # Policy ABC + 5 defaults + TOML loader + runner
│   │   └── services/           # 9 services orchestrating models + git + events
│   ├── mcp/                    # FastMCP server (11 tools / 5 resources / 3 prompts)
│   ├── api/                    # FastAPI app, deps, errors, routers/, schemas
│   └── db/                     # engine + session factory + SQLite pragmas
└── tests/
    ├── unit/                   # 88 unit tests across services / policies / API / MCP / git / security
    └── integration/            # full pipeline test (devis §21.2)
```

## Setup

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
pytest -q                       # 97 tests, ~3s
ruff format --check src tests
ruff check src tests
mypy src                        # strict mode
```

## Running components directly

The user-facing CLI is `gf` (Go binary, in `../cli/`). The backend is normally
spawned by `gf mcp serve` / `gf api serve`. For local development you can run
each component directly:

```bash
# MCP server (stdio transport — for Claude Code / Codex / Cursor / Cline)
python -m govforge.mcp.server

# HTTP API
python -m govforge.api.server                                  # 127.0.0.1:8787
# or with reload during dev:
uvicorn govforge.api.app:app --host 127.0.0.1 --port 8787 --reload
```

The DB defaults to `.govforge/govforge.db` in the current directory; override
with `GOVFORGE_DB=/path/to/file.db` (or a full SQLAlchemy URL like
`postgresql://…`).

## Architecture in one breath

```
agents (Claude / Codex / Cursor / …)
    │   stdio
    ▼
FastMCP server  ──┐
                  │
gf CLI ──HTTP─▶  FastAPI  ──▶  Services  ──▶  Models / SQLite
                  │              │  │
UI cockpit ───────┘              │  └──▶  Event store (audit log)
                                 │
                                 └─▶  Git extractor (read-only)
                                 │
                                 └─▶  Policy engine (5 defaults)
```

See [`../docs/architecture.md`](../docs/architecture.md) for the full picture
and [`../docs/data-model.md`](../docs/data-model.md) for the entity diagram.

## Tests

| Layer            | Coverage |
|------------------|----------|
| `core/`          | 84-100%  |
| `mcp/`           | 73-100%  |
| `api/`           | 76-100%  |
| **TOTAL**        | **90%**  |

```bash
pytest --cov=govforge --cov-report=term-missing
```

Security guarantees are pinned by source-grep tests in
[`tests/unit/test_security.py`](tests/unit/test_security.py). See
[`../docs/threat-model.md`](../docs/threat-model.md).

## License

Apache 2.0 — see [`../LICENSE`](../LICENSE).
