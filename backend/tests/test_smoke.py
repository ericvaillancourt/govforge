"""Smoke test: package imports and version is set."""

import govforge


def test_version_is_set() -> None:
    assert govforge.__version__
    assert govforge.__version__ == "0.1.0"


def test_subpackages_importable() -> None:
    import govforge.api
    import govforge.core
    import govforge.db
    import govforge.mcp

    assert govforge.api is not None
    assert govforge.core is not None
    assert govforge.db is not None
    assert govforge.mcp is not None
