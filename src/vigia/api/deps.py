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


def tenant_uploads(session: Session, upload_id: int | None = None) -> list[Upload]:
    """Registered uploads whose normalized artifact still exists.

    The metadata row is the unit the API scopes every read to, so callers also
    need the stable ``file_hash`` (for example the forecast registry data cut),
    not just the Parquet path.
    """
    reconcile(session)
    query = session.query(Upload)
    if upload_id is not None:
        query = query.filter(Upload.id == upload_id)
    records: list[Upload] = []
    for record in query.all():
        if record.normalized_path and Path(record.normalized_path).exists():
            records.append(record)
    return records


def tenant_parquet_paths(session: Session, upload_id: int | None = None) -> list[Path]:
    """Registered Parquet files that still exist, optionally for one upload."""
    return [Path(record.normalized_path) for record in tenant_uploads(session, upload_id)]
