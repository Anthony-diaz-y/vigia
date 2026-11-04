"""Database engine tests: SQLite vs PostgreSQL (M7)."""

from __future__ import annotations

import os

import pytest

TOKEN = "test-token"


def _auth() -> dict[str, str]:
    return {"X-Access-Token": TOKEN}


def test_build_engine_uses_correct_backend() -> None:
    from vigia.api.db import build_engine

    sqlite = build_engine("sqlite:///tmp/example.db")
    assert sqlite.url.get_backend_name() == "sqlite"

    postgres = build_engine("postgresql+psycopg://u:p@localhost:5432/db")
    assert postgres.url.get_backend_name() == "postgresql"


PG_URL = os.environ.get(
    "VIGIA_TEST_DATABASE_URL",
    "postgresql+psycopg://vigia:vigia@localhost:55432/vigia",
)


def _postgres_available() -> bool:
    from sqlalchemy import create_engine

    try:
        engine = create_engine(PG_URL, connect_args={"connect_timeout": 2})
        with engine.connect():
            return True
    except Exception:
        return False


@pytest.mark.skipif(not _postgres_available(), reason="PostgreSQL no disponible")
def test_postgres_smoke_demo_load(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("VIGIA_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("VIGIA_ACCESS_TOKEN", TOKEN)
    monkeypatch.setenv("VIGIA_DATABASE_URL", PG_URL)

    from fastapi.testclient import TestClient

    from vigia.api.main import create_app

    with TestClient(create_app()) as client:
        response = client.post("/api/demo/load", headers=_auth())
        assert response.status_code == 200
        assert response.json()["rows_valid"] == 624

        uploads = client.get("/api/uploads", headers=_auth()).json()
        assert len(uploads) >= 1
