"""SQLAlchemy engine and session construction."""

from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker


def build_engine(url: str) -> Engine:
    # check_same_thread is required for SQLite under a threaded ASGI server.
    return create_engine(url, connect_args={"check_same_thread": False})


def build_sessionmaker(engine: Engine):
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)
