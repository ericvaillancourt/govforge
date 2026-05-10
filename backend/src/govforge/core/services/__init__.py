"""Services orchestrate the domain models, the Git extractor and the event store.

Layered design
--------------

- API layer / MCP layer validate inputs (Pydantic) and call services.
- Services do the actual work: ORM mutations, Git extraction, event emission.
- Services emit `Event` rows for every significant action (audit trail).
- Services raise `NotFoundError` / `InvariantError` for callers to translate.

Each service takes a `Session` (and optionally a shared `EventService`) so
that a request handler can wire several services to the same DB session and
keep the whole flow in one transaction.
"""

from govforge.core.services.approval_service import ApprovalService
from govforge.core.services.decision_service import DecisionService
from govforge.core.services.disagreement_service import DisagreementService
from govforge.core.services.event_service import EventService
from govforge.core.services.exceptions import (
    InvariantError,
    NotFoundError,
    ServiceError,
)
from govforge.core.services.inputs import FindingInput
from govforge.core.services.policy_service import PolicyService
from govforge.core.services.project_service import ProjectService
from govforge.core.services.review_service import ReviewService
from govforge.core.services.task_service import TaskService
from govforge.core.services.timeline_service import TimelineService

__all__ = [
    "ApprovalService",
    "DecisionService",
    "DisagreementService",
    "EventService",
    "FindingInput",
    "InvariantError",
    "NotFoundError",
    "PolicyService",
    "ProjectService",
    "ReviewService",
    "ServiceError",
    "TaskService",
    "TimelineService",
]
