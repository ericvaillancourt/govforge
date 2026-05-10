"""Project endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from govforge.api.deps import get_session
from govforge.api.schemas import ProjectIn, ProjectOut
from govforge.core.services import ProjectService

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectOut])
def list_projects(session: Session = Depends(get_session)) -> list[ProjectOut]:
    rows = ProjectService(session).list()
    return [ProjectOut.model_validate(r) for r in rows]


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(
    payload: ProjectIn,
    session: Session = Depends(get_session),
) -> ProjectOut:
    project = ProjectService(session).get_or_create(
        name=payload.name,
        root_path=payload.root_path,
        default_branch=payload.default_branch,
    )
    return ProjectOut.model_validate(project)
