"""Authenticated API routes for uploads, analysis, forecast, explanation, export."""

from __future__ import annotations

import hashlib
import io
import json
import logging
import shutil
import tempfile
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
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
from vigia.ingest.contract import CANONICAL_COLUMNS
from vigia.ingest.errors import IngestError
from vigia.ingest.mapping import find_pii, load_source_config, resolve_mapping
from vigia.ingest.readers import read_table

from vigia.api.auth import require_token
from vigia.api.config import Settings
from vigia.api.deps import get_session, get_settings, reconcile, tenant_parquet_paths
from vigia.api.models import Upload
from vigia.api.serialize import to_jsonable

logger = logging.getLogger("vigia.api")

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
    session: Session,
    settings: Settings,
    raw_path: Path,
    source: str,
    filename: str,
    mapping: dict[str, str] | None = None,
) -> dict:
    result = ingest_file(
        raw_path,
        out_dir=settings.uploads_dir,
        source=source,
        mapping_override=mapping,
    )
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


def _parquet_paths(session: Session, upload_id: int | None = None) -> list[Path]:
    paths = tenant_parquet_paths(session, upload_id)
    if not paths:
        if upload_id is not None:
            raise HTTPException(status_code=404, detail="carga no encontrada")
        raise HTTPException(
            status_code=404,
            detail="sin datos: subí un archivo de vigilancia",
        )
    return paths


@router.post("/upload")
def upload(
    file: UploadFile = File(...),
    source: str = Query("minsa_dengue"),
    mapping: str | None = Form(None),
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> dict:
    data = file.file.read()
    digest = hashlib.sha256(data).hexdigest()
    suffix = Path(file.filename or "upload.csv").suffix or ".csv"
    raw_path = settings.raw_dir / f"{digest}{suffix}"
    raw_path.write_bytes(data)

    mapping_override = json.loads(mapping) if mapping else None
    try:
        return _store_ingest(
            session,
            settings,
            raw_path,
            source,
            file.filename or raw_path.name,
            mapping_override,
        )
    except IngestError as exc:
        logger.warning("upload rejected (%s): %s", file.filename, exc)
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/upload/preview")
def preview_upload(
    file: UploadFile = File(...),
    source: str = Query("minsa_dengue"),
) -> dict:
    """Preview the column mapping for a file without ingesting it."""
    data = file.file.read()
    suffix = Path(file.filename or "upload.csv").suffix or ".csv"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as handle:
        handle.write(data)
        tmp_path = Path(handle.name)
    try:
        config = load_source_config(source)
        table = read_table(tmp_path)
        columns = [str(name) for name in table.frame.columns]
        resolved = resolve_mapping(columns, config)
        return {
            "source": source,
            "columns": columns,
            "mapping": resolved.mapping,
            "unmapped_columns": resolved.unmapped_columns,
            "missing_required": resolved.missing_required,
            "pii_detected": find_pii(columns, config),
            "canonical_columns": list(CANONICAL_COLUMNS),
            "required": list(config.required),
        }
    except IngestError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    finally:
        tmp_path.unlink(missing_ok=True)


@router.get("/uploads")
def list_uploads(session: Session = Depends(get_session)) -> list[dict]:
    reconcile(session)
    records = session.query(Upload).order_by(Upload.id.desc()).all()
    return [_upload_payload(record) for record in records]


@router.get("/uploads/{upload_id}/quality")
def upload_quality(upload_id: int, session: Session = Depends(get_session)) -> dict:
    record = session.get(Upload, upload_id)
    if record is None:
        raise HTTPException(status_code=404, detail="carga no encontrada")
    return json.loads(Path(record.quality_path).read_text(encoding="utf-8"))


@router.delete("/uploads")
def clear_uploads(
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> dict:
    """Clear every ingested file and its artifacts (the metadata database stays)."""
    session.query(Upload).delete()
    session.commit()
    for directory in (settings.uploads_dir, settings.raw_dir, settings.registry_dir):
        shutil.rmtree(directory, ignore_errors=True)
        directory.mkdir(parents=True, exist_ok=True)
    return {"cleared": True}


@router.get("/analysis/series")
def series(
    level: str = Query("department"),
    upload_id: int | None = Query(None),
    session: Session = Depends(get_session),
):
    frame = weekly_series(_parquet_paths(session, upload_id), level=level)
    return to_jsonable(frame)


@router.get("/analysis/interannual")
def interannual(
    level: str = Query("department"),
    geography: str | None = Query(None),
    upload_id: int | None = Query(None),
    session: Session = Depends(get_session),
):
    frame = interannual_comparison(
        _parquet_paths(session, upload_id), level=level, geography=geography
    )
    return to_jsonable(frame.reset_index())


@router.get("/analysis/heatmap")
def heatmap(
    year: int = Query(...),
    level: str = Query("department"),
    upload_id: int | None = Query(None),
    session: Session = Depends(get_session),
) -> dict:
    frame = make_heatmap(_parquet_paths(session, upload_id), year=year, level=level)
    return {
        "geographies": [str(value) for value in frame.index],
        "weeks": [int(value) for value in frame.columns],
        "values": frame.values.tolist(),
    }


@router.get("/analysis/ranking")
def ranking(
    level: str = Query("department"),
    year: int | None = Query(None),
    upload_id: int | None = Query(None),
    session: Session = Depends(get_session),
):
    frame = weekly_series(_parquet_paths(session, upload_id), level=level)
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
    upload_id: int | None = Query(None),
    session: Session = Depends(get_session),
):
    return to_jsonable(make_anomalies(_parquet_paths(session, upload_id), level=level))


@router.get("/forecast")
def forecast(
    level: str = Query("department"),
    upload_id: int | None = Query(None),
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> dict:
    result = run_forecast(
        _parquet_paths(session, upload_id), level=level, out_dir=settings.registry_dir
    )
    return {
        "model_id": result.model_id,
        "scorecard": to_jsonable(result.scorecard),
        "forecasts": to_jsonable(result.forecasts),
    }


@router.get("/explain")
def explain(
    level: str = Query("department"),
    upload_id: int | None = Query(None),
    session: Session = Depends(get_session),
) -> dict:
    result = run_explain(_parquet_paths(session, upload_id), level=level)
    return {
        "drivers": to_jsonable(result.drivers),
        "narratives": [
            {"source": item.source, "text": item.text} for item in result.narratives
        ],
    }


@router.get("/export")
def export_data(
    format: str = Query("csv"),
    upload_id: int | None = Query(None),
    session: Session = Depends(get_session),
):
    frames = [pd.read_parquet(path) for path in _parquet_paths(session, upload_id)]
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
