"""FastAPI application: API routes plus the built React SPA."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from vigia.api.config import DISCLAIMER, Settings
from vigia.api.db import build_engine, build_sessionmaker
from vigia.api.models import Base
from vigia.api.routes import router as api_router

WEB_DIST = Path(__file__).resolve().parents[3] / "web" / "dist"


def create_app() -> FastAPI:
    settings = Settings.from_env()
    engine = build_engine(settings.database_url)
    SessionLocal = build_sessionmaker(engine)
    Base.metadata.create_all(engine)

    app = FastAPI(title="vigia", version="0.1.0")
    app.state.settings = settings
    app.state.engine = engine
    app.state.SessionLocal = SessionLocal

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health")
    def health() -> dict:
        return {"status": "ok", "disclaimer": DISCLAIMER}

    app.include_router(api_router, prefix="/api")

    if (WEB_DIST / "index.html").exists():
        app.mount("/", StaticFiles(directory=WEB_DIST, html=True), name="web")

    return app


app = create_app()
