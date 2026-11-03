"""Shared FastAPI dependencies."""

from __future__ import annotations

from pathlib import Path

from fastapi import Request
from sqlalchemy.orm import Session

from vigia.api.config import Settings
from vigia.api.models import Upload


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_session(request: Request):
    session = request.app.state.SessionLocal()
    try:
        yield session
    finally:
        session.close()


def reconcile(session: Session) -> None:
    """Drop metadata rows whose normalized Parquet no longer exists on disk.

    The metadata store and the filesystem can drift apart when files are
    removed out of band (for example a partial manual delete that skips the
    locked SQLite database). Prune dangling references so reads never crash on
    a missing file.
    """
    for record in session.query(Upload).all():
        if not Path(record.normalized_path).exists():
            session.delete(record)
    session.commit()


def tenant_parquet_paths(session: Session) -> list[Path]:
    """Every registered Parquet file that still exists on disk."""
    reconcile(session)
    rows = session.query(Upload.normalized_path).all()
    paths: list[Path] = []
    for (path,) in rows:
        if path:
            candidate = Path(path)
            if candidate.exists():
                paths.append(candidate)
    return paths
