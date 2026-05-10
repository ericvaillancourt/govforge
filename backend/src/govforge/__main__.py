"""Entry point for `python -m govforge`. Mostly a stub — the user-facing CLI is `gf` (Go)."""

import sys

from govforge import __version__


def main() -> int:
    if len(sys.argv) >= 2 and sys.argv[1] in {"-V", "--version"}:
        print(f"govforge backend {__version__}")
        return 0
    print("govforge backend — use `gf` (Go CLI) or run components directly:")
    print("  python -m govforge.mcp.server")
    print("  uvicorn govforge.api.app:app --port 8787")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
