"""GovForge MCP server — FastMCP tools, resources, and prompts.

Public entry points:

- :func:`govforge.mcp.server.build_server` — factory used by tests and the
  stdio runner.
- :func:`govforge.mcp.server.main` — `python -m govforge.mcp.server`.

Tools, resources, and prompts each live in their own module:

- :mod:`govforge.mcp.tools`     — 11 phase-1 tools.
- :mod:`govforge.mcp.resources` — 5 read-only resources.
- :mod:`govforge.mcp.prompts`   — 3 prompt templates.
- :mod:`govforge.mcp.context`   — session + entity resolution.
- :mod:`govforge.mcp.schemas`   — Pydantic input/output models.
"""

from govforge.mcp.server import build_server, main

__all__ = ["build_server", "main"]
