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


def tenant_parquet_paths(session: Session) -> list[Path]:
    """Every normalized Parquet currently registered in the metadata store."""
    rows = session.query(Upload.normalized_path).all()
    return [Path(path) for (path,) in rows if path]
