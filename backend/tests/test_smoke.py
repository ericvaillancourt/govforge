"""Smoke test: package imports and version is set."""

import govforge


def test_version_is_set() -> None:
    assert govforge.__version__
    assert govforge.__version__ == "0.1.0"


def test_subpackages_importable() -> None:
    import govforge.api  # noqa: F401
    import govforge.core  # noqa: F401
    import govforge.db  # noqa: F401
    import govforge.mcp  # noqa: F401
