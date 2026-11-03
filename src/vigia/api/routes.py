"""Authenticated API routes for uploads, analysis, forecast, explanation, export."""

from __future__ import annotations

import hashlib
import io
import json
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from vigia.analysis import (
    anomalies as make_anomalies,
    heatmap as make_heatmap,
    interannual_comparison,
    weekly_series,
)
from vigia.analysis.engine import geography_columns
from vigia.explain import explain as run_explain
from vigia.forecast import forecast as run_forecast
from vigia.ingest import ingest_file
from vigia.ingest.errors import IngestError

from vigia.api.auth import require_token
from vigia.api.config import Settings
from vigia.api.demo import demo_csv_text
from vigia.api.deps import get_session, get_settings, tenant_parquet_paths
from vigia.api.models import Upload
from vigia.api.serialize import to_jsonable

router = APIRouter(dependencies=[Depends(require_token)])


def _upload_payload(record: Upload) -> dict:
    return {
        "id": record.id,
        "file_hash": record.file_hash,
        "filename": record.filename,
        "source": record.source,
        "status": record.status,
        "rows_in": record.rows_in,
        "rows_valid": record.rows_valid,
        "rows_dropped": record.rows_dropped,
        "duplicates_collapsed": record.duplicates_collapsed,
        "created_at": record.created_at.isoformat() if record.created_at else None,
    }


def _store_ingest(
    session: Session, settings: Settings, raw_path: Path, source: str, filename: str
) -> dict:
    result = ingest_file(raw_path, out_dir=settings.uploads_dir, source=source)
    existing = session.query(Upload).filter_by(file_hash=result.file_hash).first()
    if existing is not None:
        return _upload_payload(existing)

    record = Upload(
        file_hash=result.file_hash,
        filename=filename,
        source=source,
        status=result.status,
        rows_in=result.rows_in,
        rows_valid=result.rows_valid,
        rows_dropped=result.rows_dropped,
        duplicates_collapsed=result.duplicates_collapsed,
        normalized_path=str(result.normalized_path),
        quality_path=str(result.quality_path),
    )
    session.add(record)
    session.commit()
    session.refresh(record)
    return _upload_payload(record)


def _parquet_paths(session: Session) -> list[Path]:
    paths = tenant_parquet_paths(session)
    if not paths:
        raise HTTPException(
            status_code=404,
            detail="no data yet: upload a file or load the demo dataset",
        )
    return paths


@router.post("/upload")
def upload(
    file: UploadFile = File(...),
    source: str = Query("minsa_dengue"),
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> dict:
    data = file.file.read()
    digest = hashlib.sha256(data).hexdigest()
    suffix = Path(file.filename or "upload.csv").suffix or ".csv"
    raw_path = settings.raw_dir / f"{digest}{suffix}"
    raw_path.write_bytes(data)

    try:
        return _store_ingest(session, settings, raw_path, source, file.filename or raw_path.name)
    except IngestError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/demo/load")
def load_demo(
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> dict:
    raw_path = settings.raw_dir / "demo.csv"
    raw_path.write_text(demo_csv_text(), encoding="utf-8")
    return _store_ingest(session, settings, raw_path, "minsa_dengue", "demo.csv")


@router.get("/uploads")
def list_uploads(session: Session = Depends(get_session)) -> list[dict]:
    records = session.query(Upload).order_by(Upload.id.desc()).all()
    return [_upload_payload(record) for record in records]


@router.get("/uploads/{upload_id}/quality")
def upload_quality(upload_id: int, session: Session = Depends(get_session)) -> dict:
    record = session.get(Upload, upload_id)
    if record is None:
        raise HTTPException(status_code=404, detail="upload not found")
    return json.loads(Path(record.quality_path).read_text(encoding="utf-8"))


@router.get("/analysis/series")
def series(
    level: str = Query("department"),
    session: Session = Depends(get_session),
):
    frame = weekly_series(_parquet_paths(session), level=level)
    return to_jsonable(frame)


@router.get("/analysis/interannual")
def interannual(
    level: str = Query("department"),
    geography: str | None = Query(None),
    session: Session = Depends(get_session),
):
    frame = interannual_comparison(
        _parquet_paths(session), level=level, geography=geography
    )
    return to_jsonable(frame.reset_index())


@router.get("/analysis/heatmap")
def heatmap(
    year: int = Query(...),
    level: str = Query("department"),
    session: Session = Depends(get_session),
) -> dict:
    frame = make_heatmap(_parquet_paths(session), year=year, level=level)
    return {
        "geographies": [str(value) for value in frame.index],
        "weeks": [int(value) for value in frame.columns],
        "values": frame.values.tolist(),
    }


@router.get("/analysis/ranking")
def ranking(
    level: str = Query("department"),
    year: int | None = Query(None),
    session: Session = Depends(get_session),
):
    frame = weekly_series(_parquet_paths(session), level=level)
    if year is not None:
        frame = frame[frame["year"] == year]
    geo = geography_columns(level)
    ranked = (
        frame.groupby(geo, sort=False)["cases"]
        .sum()
        .reset_index()
        .sort_values("cases", ascending=False)
    )
    ranked.insert(0, "rank", range(1, len(ranked) + 1))
    return to_jsonable(ranked)


@router.get("/analysis/anomalies")
def anomalies(
    level: str = Query("department"),
    session: Session = Depends(get_session),
):
    return to_jsonable(make_anomalies(_parquet_paths(session), level=level))


@router.get("/forecast")
def forecast(
    level: str = Query("department"),
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> dict:
    result = run_forecast(_parquet_paths(session), level=level, out_dir=settings.registry_dir)
    return {
        "model_id": result.model_id,
        "scorecard": to_jsonable(result.scorecard),
        "forecasts": to_jsonable(result.forecasts),
    }


@router.get("/explain")
def explain(
    level: str = Query("department"),
    session: Session = Depends(get_session),
) -> dict:
    result = run_explain(_parquet_paths(session), level=level)
    return {
        "drivers": to_jsonable(result.drivers),
        "narratives": [
            {"source": item.source, "text": item.text} for item in result.narratives
        ],
    }


@router.get("/export")
def export_data(
    format: str = Query("csv"),
    session: Session = Depends(get_session),
):
    frames = [pd.read_parquet(path) for path in _parquet_paths(session)]
    combined = pd.concat(frames, ignore_index=True)

    if format == "parquet":
        buffer = io.BytesIO()
        combined.to_parquet(buffer, index=False)
        return StreamingResponse(
            io.BytesIO(buffer.getvalue()),
            media_type="application/octet-stream",
            headers={"Content-Disposition": "attachment; filename=vigia.parquet"},
        )

    buffer = io.StringIO()
    combined.to_csv(buffer, index=False)
    return StreamingResponse(
        io.StringIO(buffer.getvalue()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=vigia.csv"},
    )
