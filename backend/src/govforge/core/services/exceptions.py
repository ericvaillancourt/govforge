"""Service-layer exceptions. Translated by API/MCP into 4xx responses or tool errors."""

from __future__ import annotations


class ServiceError(Exception):
    """Base for all service-layer errors."""


class NotFoundError(ServiceError):
    """Requested entity does not exist."""


class InvariantError(ServiceError):
    """A domain invariant would be violated by the requested operation."""
