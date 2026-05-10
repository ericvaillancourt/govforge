"""Project — root aggregate. One per Git repo (typically)."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from govforge.core.models import Project


class ProjectService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def create(
        self,
        *,
        name: str,
        root_path: str,
        default_branch: str = "main",
    ) -> Project:
        project = Project(
            name=name,
            root_path=root_path,
            default_branch=default_branch,
        )
        self.session.add(project)
        self.session.flush()
        return project

    def get(self, project_id: UUID) -> Project | None:
        return self.session.get(Project, project_id)

    def get_by_path(self, root_path: str) -> Project | None:
        return self.session.query(Project).filter(Project.root_path == root_path).first()

    def get_or_create(
        self,
        *,
        name: str,
        root_path: str,
        default_branch: str = "main",
    ) -> Project:
        existing = self.get_by_path(root_path)
        if existing is not None:
            return existing
        return self.create(name=name, root_path=root_path, default_branch=default_branch)

    def list(self) -> list[Project]:
        return self.session.query(Project).order_by(Project.created_at.asc()).all()
