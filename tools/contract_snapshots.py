"""Generate the golden contract snapshots used to migrate vigia to TypeScript.

The current Python implementation is the oracle. Every snapshot is produced
from the public modules and the HTTP API, so a TypeScript port can be tested
against the exact behavior it replaces.

Run from the repository root::

    uv run python -m tools.contract_snapshots

The committed snapshots live in ``contract/snapshots``. Regenerate them only
when the Python behavior is intentionally changed; the accompanying test
(``tests/test_contract_snapshots.py``) fails on any accidental drift.
"""

from __future__ import annotations

import importlib.util
import json
import os
import tempfile
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = ROOT / "contract" / "snapshots"
SCHEMA_VERSION = 1
TOKEN = "contract-token"


def _write_bytes(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)


def _write_json(path: Path, payload: Any) -> None:
    text = json.dumps(
        payload,
        indent=2,
        ensure_ascii=False,
        sort_keys=True,
        allow_nan=False,
    )
    _write_bytes(path, (text + "\n").encode("utf-8"))


def _write_text(path: Path, text: str) -> None:
    _write_bytes(path, text.encode("utf-8"))


def _records(frame) -> list[dict[str, Any]]:
    """Serialize a DataFrame the same way the API does (NaN becomes null)."""
    return json.loads(frame.to_json(orient="records", force_ascii=False))


def _scrub(value: Any) -> Any:
    """Remove values that are deterministic per run but not per contract."""
    if isinstance(value, dict):
        return {
            key: ("<timestamp>" if key == "created_at" else _scrub(item))
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_scrub(item) for item in value]
    return value


def _canonical_fixture_bytes(path: Path) -> bytes:
    """Normalize fixture line endings so snapshots are platform-independent."""
    text = path.read_text(encoding="utf-8")
    return text.replace("\r\n", "\n").replace("\r", "\n").encode("utf-8")


def _load_demo_data():
    path = ROOT / "tests" / "demo_data.py"
    spec = importlib.util.spec_from_file_location("vigia_demo_data", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _ingest_snapshot(source: Path, out_dir: Path) -> dict[str, Any]:
    import pandas as pd

    from vigia.ingest import ingest_file

    result = ingest_file(source, out_dir=out_dir, source="minsa_dengue")
    frame = pd.read_parquet(result.normalized_path)
    return {
        "file_hash": result.file_hash,
        "status": result.status,
        "rows_in": result.rows_in,
        "rows_valid": result.rows_valid,
        "rows_dropped": result.rows_dropped,
        "duplicates_collapsed": result.duplicates_collapsed,
        "mapping": result.mapping,
        "unmapped_columns": result.unmapped_columns,
        "quality": result.quality.to_dict(),
        "rows": _records(frame),
    }


def _analysis_snapshots(parquet_path: Path) -> dict[str, Any]:
    from vigia.analysis import (
        anomalies,
        heatmap,
        interannual_comparison,
        weekly_series,
    )

    weekly = weekly_series([parquet_path], level="department")
    interannual = interannual_comparison([parquet_path], level="department")
    matrix = heatmap([parquet_path], year=2024, level="department")
    return {
        "weekly_series": _records(weekly),
        "interannual": _records(interannual.reset_index()),
        "heatmap_2024": {
            "geographies": [str(value) for value in matrix.index],
            "weeks": [int(value) for value in matrix.columns],
            "values": [[int(value) for value in row] for row in matrix.values],
        },
        "anomalies": _records(anomalies([parquet_path], level="department")),
    }


def _forecast_snapshot(
    parquet_path: Path, source_hash: str, out_dir: Path
) -> dict[str, Any]:
    from vigia.forecast import forecast

    result = forecast(
        [parquet_path],
        level="department",
        out_dir=out_dir,
        file_hashes=[source_hash],
    )
    return {
        "model_id": result.model_id,
        "data_cut": result.data_cut,
        "scorecard": _records(result.scorecard),
        "forecasts": _records(result.forecasts),
    }


def _explain_snapshot(parquet_path: Path) -> dict[str, Any]:
    from vigia.explain import explain

    result = explain([parquet_path], level="department")
    return {
        "drivers": _records(result.drivers),
        "narratives": [
            {"source": item.source, "text": item.text} for item in result.narratives
        ],
    }


@contextmanager
def _contract_environment(root: Path) -> Iterator[None]:
    keys = (
        "VIGIA_DATA_DIR",
        "VIGIA_ACCESS_TOKEN",
        "VIGIA_DATABASE_URL",
        "DEEPSEEK_API_KEY",
    )
    previous = {key: os.environ.get(key) for key in keys}
    try:
        os.environ["VIGIA_DATA_DIR"] = str(root / "api-data")
        os.environ["VIGIA_ACCESS_TOKEN"] = TOKEN
        os.environ["VIGIA_DATABASE_URL"] = (
            f"sqlite:///{(root / 'contract.db').as_posix()}"
        )
        os.environ.pop("DEEPSEEK_API_KEY", None)
        yield
    finally:
        for key, value in previous.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value


def _preview_payloads(client, headers: dict[str, str]) -> dict[str, Any]:
    demo = _load_demo_data()
    preview = client.post(
        "/api/upload/preview",
        headers=headers,
        files={
            "file": (
                "historico.csv",
                demo.demo_csv_text().encode("utf-8"),
                "text/csv",
            )
        },
    )
    pii = client.post(
        "/api/upload/preview",
        headers=headers,
        files={
            "file": (
                "pii.csv",
                (
                    "departamento,ano,semana,ubigeo,casos,dni\n"
                    "LIMA,2024,1,150101,7,12345678\n"
                ).encode("utf-8"),
                "text/csv",
            )
        },
    )
    missing = client.post(
        "/api/upload/preview",
        headers=headers,
        files={
            "file": (
                "missing.csv",
                "departamento,ano,semana,casos\nLIMA,2024,1,7\n".encode("utf-8"),
                "text/csv",
            )
        },
    )
    return {
        "api_preview_demo": preview.json(),
        "api_preview_pii": pii.json(),
        "api_preview_missing_required": missing.json(),
    }


def _api_snapshots(root: Path) -> dict[str, Any]:
    demo = _load_demo_data()
    headers = {"X-Access-Token": TOKEN}
    with _contract_environment(root):
        # Import after the environment is set: vigia.api.main builds a
        # module-level app on import and would otherwise read the developer's
        # .env database URL.
        from fastapi.testclient import TestClient

        from vigia.api.main import create_app

        app = create_app()
        try:
            with TestClient(app) as client:
                health = client.get("/api/health").json()
                previews = _preview_payloads(client, headers)
                upload = client.post(
                    "/api/upload",
                    headers=headers,
                    files={
                        "file": (
                            "historico.csv",
                            demo.demo_csv_text().encode("utf-8"),
                            "text/csv",
                        )
                    },
                )
                upload.raise_for_status()
                upload_payload = _scrub(upload.json())

                uploads = _scrub(client.get("/api/uploads", headers=headers).json())
                quality = client.get(
                    f"/api/uploads/{upload_payload['id']}/quality", headers=headers
                ).json()
                series = client.get("/api/analysis/series", headers=headers).json()
                interannual = client.get(
                    "/api/analysis/interannual", headers=headers
                ).json()
                heatmap = client.get(
                    "/api/analysis/heatmap?year=2024", headers=headers
                ).json()
                ranking = client.get(
                    "/api/analysis/ranking?year=2024", headers=headers
                ).json()
                anomalies = client.get(
                    "/api/analysis/anomalies", headers=headers
                ).json()
                forecast = client.get("/api/forecast", headers=headers).json()
                explain = client.get("/api/explain", headers=headers).json()
                exported = client.get("/api/export?format=csv", headers=headers)
        finally:
            # SQLite keeps the database file open on Windows; dispose every
            # engine before the temporary directory is removed.
            app.state.engine.dispose()
            import vigia.api.main as api_main

            api_main.app.state.engine.dispose()

    return {
        "api_health": health,
        **previews,
        "api_upload": upload_payload,
        "api_uploads": uploads,
        "api_quality": quality,
        "api_series": series,
        "api_interannual": interannual,
        "api_heatmap_2024": heatmap,
        "api_ranking_2024": ranking,
        "api_anomalies": anomalies,
        "api_forecast": forecast,
        "api_explain": explain,
        "export_demo_csv": exported.text,
    }


def generate_snapshots(out_dir: Path = DEFAULT_OUT) -> Path:
    """Generate every snapshot under ``out_dir`` and return that directory."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    demo = _load_demo_data()
    with tempfile.TemporaryDirectory(prefix="vigia-contract-") as raw:
        work = Path(raw)
        demo_csv = work / "historico.csv"
        # Keep the exact bytes the API uploads so both snapshots share a hash.
        demo_csv.write_bytes(demo.demo_csv_text().encode("utf-8"))

        fixtures = work / "fixtures"
        clean_source = fixtures / "minsa_dengue_clean.csv"
        _write_bytes(
            clean_source,
            _canonical_fixture_bytes(
                ROOT / "tests" / "fixtures" / "minsa_dengue_clean.csv"
            ),
        )
        synthetic_source = fixtures / "analysis_synthetic.csv"
        _write_bytes(
            synthetic_source,
            _canonical_fixture_bytes(
                ROOT / "tests" / "fixtures" / "analysis_synthetic.csv"
            ),
        )

        _write_json(out_dir / "ingest_demo.json", _ingest_snapshot(demo_csv, work / "demo"))
        _write_json(
            out_dir / "ingest_clean.json",
            _ingest_snapshot(clean_source, work / "clean"),
        )
        synthetic = _ingest_snapshot(synthetic_source, work / "synthetic")
        _write_json(out_dir / "ingest_synthetic.json", synthetic)

        synthetic_parquet = work / "synthetic" / synthetic["file_hash"][:16] / "normalized.parquet"
        analysis = _analysis_snapshots(synthetic_parquet)
        for name, payload in analysis.items():
            _write_json(out_dir / f"analysis_synthetic_{name}.json", payload)

        _write_json(
            out_dir / "forecast_synthetic.json",
            _forecast_snapshot(
                synthetic_parquet,
                synthetic["file_hash"],
                work / "registry",
            ),
        )
        _write_json(
            out_dir / "explain_synthetic.json",
            _explain_snapshot(synthetic_parquet),
        )

        api_root = work / "api"
        api_root.mkdir(parents=True, exist_ok=True)
        api = _api_snapshots(api_root)
        for name, payload in api.items():
            if name == "export_demo_csv":
                _write_text(out_dir / "export_demo.csv", payload)
            else:
                _write_json(out_dir / f"{name}.json", payload)

    _write_json(
        out_dir / "manifest.json",
        {
            "schema_version": SCHEMA_VERSION,
            "oracle": "python",
            "description": (
                "Golden snapshots generated from the Python implementation. "
                "A TypeScript port must match them before the Python service "
                "is retired."
            ),
        },
    )
    return out_dir


def main() -> None:
    out_dir = generate_snapshots()
    files = sorted(path.name for path in out_dir.iterdir() if path.is_file())
    print(f"wrote {len(files)} snapshots to {out_dir}")
    for name in files:
        print(f"  {name}")


if __name__ == "__main__":
    main()
