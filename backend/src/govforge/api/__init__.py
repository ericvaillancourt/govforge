"""GovForge HTTP API — FastAPI application served on 127.0.0.1:8787.

Public entry points:

- :func:`govforge.api.app.create_app` — factory used by tests and the runner.
- :func:`govforge.api.server.main` — `python -m govforge.api.server`.
"""

from govforge.api.app import create_app
from govforge.api.server import main

__all__ = ["create_app", "main"]
