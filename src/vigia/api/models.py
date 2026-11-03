"""SQLAlchemy metadata models (SQLite now, PostgreSQL later)."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Declarative base shared by every metadata table."""


class Upload(Base):
    """One ingested surveillance file and its quality outcome."""

    __tablename__ = "uploads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    file_hash: Mapped[str] = mapped_column(String, unique=True, index=True)
    filename: Mapped[str] = mapped_column(String)
    source: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String)
    rows_in: Mapped[int] = mapped_column(Integer)
    rows_valid: Mapped[int] = mapped_column(Integer)
    rows_dropped: Mapped[int] = mapped_column(Integer)
    duplicates_collapsed: Mapped[int] = mapped_column(Integer)
    normalized_path: Mapped[str] = mapped_column(String)
    quality_path: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
