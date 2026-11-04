"""API contract tests (M5)."""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

TOKEN = "test-token"


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("VIGIA_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("VIGIA_ACCESS_TOKEN", TOKEN)
    monkeypatch.delenv("VIGIA_DATABASE_URL", raising=False)
    from vigia.api.main import create_app

    with TestClient(create_app()) as test_client:
        yield test_client


def _auth() -> dict[str, str]:
    return {"X-Access-Token": TOKEN}


def test_health_is_public_with_disclaimer(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert "dispositivo médico" in response.json()["disclaimer"]


def test_missing_token_is_rejected(client: TestClient) -> None:
    assert client.get("/api/analysis/series").status_code == 401


def _upload_demo_csv(client: TestClient) -> dict:
    """Upload the synthetic weekly fixture (no demo endpoint in production)."""
    from demo_data import demo_csv_text

    response = client.post(
        "/api/upload",
        headers=_auth(),
        files={"file": ("historico.csv", demo_csv_text().encode("utf-8"), "text/csv")},
    )
    assert response.status_code == 200
    return response.json()


def test_upload_then_analysis_forecast_explain_export(client: TestClient) -> None:
    payload = _upload_demo_csv(client)
    assert payload["rows_valid"] == 624

    uploads = client.get("/api/uploads", headers=_auth()).json()
    assert len(uploads) == 1

    series = client.get("/api/analysis/series", headers=_auth()).json()
    assert len(series) == 624

    interannual = client.get("/api/analysis/interannual", headers=_auth()).json()
    assert interannual and "epi_week" in interannual[0]

    heatmap = client.get("/api/analysis/heatmap?year=2024", headers=_auth()).json()
    assert set(heatmap["geographies"]) == {"LORETO", "PIURA", "LIMA", "AMAZONAS"}
    assert len(heatmap["weeks"]) == 52

    ranking = client.get("/api/analysis/ranking?year=2024", headers=_auth()).json()
    assert ranking[0]["cases"] >= ranking[-1]["cases"]

    forecast = client.get("/api/forecast", headers=_auth()).json()
    statuses = {row["department"]: row["status"] for row in forecast["scorecard"]}
    assert statuses["LIMA"] == "publish"
    assert statuses["AMAZONAS"] == "insufficient_evidence"

    explain = client.get("/api/explain", headers=_auth()).json()
    assert len(explain["drivers"]) == 20  # 4 departments * 5 drivers
    assert explain["narratives"]

    exported = client.get("/api/export?format=csv", headers=_auth())
    assert exported.status_code == 200
    assert "department" in exported.text


def test_upload_csv_and_quality(client: TestClient) -> None:
    csv_text = (
        "departamento,provincia,distrito,enfermedad,ano,semana,diagnostico,"
        "tipo_diagnostico,ubigeo,edad,tipo_edad,sexo,casos\n"
        "LIMA,LIMA,LIMA,DENGUE,2024,1,DENGUE SIN SIGNOS DE ALARMA,"
        "CONFIRMADO,150101,30,ANOS,F,7\n"
    )
    response = client.post(
        "/api/upload",
        headers=_auth(),
        files={"file": ("upload.csv", csv_text.encode("utf-8"), "text/csv")},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["rows_valid"] == 1
    assert payload["status"] == "ok"

    quality = client.get(
        f"/api/uploads/{payload['id']}/quality", headers=_auth()
    ).json()
    assert quality["rows_in"] == 1
    assert quality["rows_valid"] == 1


def test_clear_uploads(client: TestClient) -> None:
    _upload_demo_csv(client)
    assert len(client.get("/api/uploads", headers=_auth()).json()) == 1

    response = client.delete("/api/uploads", headers=_auth())
    assert response.status_code == 200
    assert response.json() == {"cleared": True}
    assert client.get("/api/uploads", headers=_auth()).json() == []


def test_dangling_record_self_heals(client: TestClient, tmp_path) -> None:
    from vigia.api.models import Upload

    session = client.app.state.SessionLocal()
    try:
        session.add(
            Upload(
                file_hash="dangling",
                filename="gone.csv",
                source="minsa_dengue",
                status="ok",
                rows_in=1,
                rows_valid=1,
                rows_dropped=0,
                duplicates_collapsed=0,
                normalized_path=str(tmp_path / "missing" / "normalized.parquet"),
                quality_path=str(tmp_path / "missing" / "quality.json"),
            )
        )
        session.commit()
    finally:
        session.close()

    # Analysis must not crash (500) on a dangling reference.
    assert client.get("/api/analysis/series", headers=_auth()).status_code == 404
    # Listing uploads self-heals the dangling row.
    assert client.get("/api/uploads", headers=_auth()).json() == []


def test_preview_returns_mapping_without_ingesting(client: TestClient) -> None:
    csv_text = (
        "departamento,provincia,distrito,enfermedad,ano,semana,diagnostico,"
        "tipo_diagnostico,ubigeo,edad,tipo_edad,sexo,casos\n"
        "LIMA,LIMA,LIMA,DENGUE,2024,1,DENGUE SIN SIGNOS DE ALARMA,"
        "CONFIRMADO,150101,30,ANOS,F,7\n"
    )
    response = client.post(
        "/api/upload/preview",
        headers=_auth(),
        files={"file": ("upload.csv", csv_text.encode("utf-8"), "text/csv")},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["mapping"]["cases"] == "casos"
    assert payload["mapping"]["year"] == "ano"
    assert payload["mapping"]["epi_week"] == "semana"
    assert payload["mapping"]["ubigeo"] == "ubigeo"
    assert payload["missing_required"] == []
    assert payload["pii_detected"] == []
    assert payload["canonical_columns"]
    # Preview must not ingest anything.
    assert client.get("/api/uploads", headers=_auth()).json() == []


def test_preview_reports_missing_required(client: TestClient) -> None:
    csv_text = "departamento,ano,semana,casos\nLIMA,2024,1,7\n"
    response = client.post(
        "/api/upload/preview",
        headers=_auth(),
        files={"file": ("upload.csv", csv_text.encode("utf-8"), "text/csv")},
    )
    assert response.status_code == 200
    assert "ubigeo" in response.json()["missing_required"]


def test_preview_detects_pii_without_rejecting(client: TestClient) -> None:
    csv_text = (
        "departamento,ano,semana,ubigeo,casos,dni\n"
        "LIMA,2024,1,150101,7,12345678\n"
    )
    response = client.post(
        "/api/upload/preview",
        headers=_auth(),
        files={"file": ("upload.csv", csv_text.encode("utf-8"), "text/csv")},
    )
    assert response.status_code == 200
    assert "dni" in response.json()["pii_detected"]


def test_upload_applies_mapping_override(client: TestClient) -> None:
    csv_text = (
        "departamento,ano,semana,ubigeo,edad,tipo_edad,sexo,casos,total\n"
        "LIMA,2024,1,150101,30,ANOS,F,111,222\n"
    )
    response = client.post(
        "/api/upload",
        headers=_auth(),
        files={"file": ("upload.csv", csv_text.encode("utf-8"), "text/csv")},
        data={
            "mapping": json.dumps(
                {
                    "ubigeo": "ubigeo",
                    "year": "ano",
                    "epi_week": "semana",
                    "department": "departamento",
                    "age_group": "edad",
                    "age_type": "tipo_edad",
                    "sex": "sexo",
                    "cases": "total",
                }
            )
        },
    )
    assert response.status_code == 200
    assert response.json()["rows_valid"] == 1
    exported = client.get("/api/export?format=csv", headers=_auth()).text
    assert "222" in exported
    assert "111" not in exported


def test_upload_override_missing_required_is_rejected(client: TestClient) -> None:
    csv_text = "departamento,ano,semana,ubigeo,casos\nLIMA,2024,1,150101,7\n"
    response = client.post(
        "/api/upload",
        headers=_auth(),
        files={"file": ("upload.csv", csv_text.encode("utf-8"), "text/csv")},
        data={"mapping": json.dumps({"cases": "casos"})},
    )
    assert response.status_code == 422


def test_upload_without_age_columns_does_not_crash(client: TestClient) -> None:
    csv_text = "departamento,ano,semana,ubigeo,casos\nLIMA,2024,1,150101,7\n"
    response = client.post(
        "/api/upload",
        headers=_auth(),
        files={"file": ("upload.csv", csv_text.encode("utf-8"), "text/csv")},
    )
    assert response.status_code == 200
    assert response.json()["rows_valid"] == 1


def _upload_department(client: TestClient, filename: str, department: str, ubigeo: str) -> dict:
    csv_text = (
        "departamento,ano,semana,ubigeo,edad,tipo_edad,sexo,casos\n"
        f"{department},2024,1,{ubigeo},30,ANOS,F,7\n"
    )
    response = client.post(
        "/api/upload",
        headers=_auth(),
        files={"file": (filename, csv_text.encode("utf-8"), "text/csv")},
    )
    assert response.status_code == 200
    return response.json()


def test_analysis_can_be_scoped_to_one_upload(client: TestClient) -> None:
    lima = _upload_department(client, "lima.csv", "LIMA", "150101")
    piura = _upload_department(client, "piura.csv", "PIURA", "200101")

    all_ranking = client.get("/api/analysis/ranking?year=2024", headers=_auth()).json()
    assert {row["department"] for row in all_ranking} == {"LIMA", "PIURA"}

    lima_ranking = client.get(
        f"/api/analysis/ranking?year=2024&upload_id={lima['id']}", headers=_auth()
    ).json()
    assert [row["department"] for row in lima_ranking] == ["LIMA"]

    piura_ranking = client.get(
        f"/api/analysis/ranking?year=2024&upload_id={piura['id']}", headers=_auth()
    ).json()
    assert [row["department"] for row in piura_ranking] == ["PIURA"]

    scoped_series = client.get(
        f"/api/analysis/series?upload_id={piura['id']}", headers=_auth()
    ).json()
    assert {row["department"] for row in scoped_series} == {"PIURA"}


def test_unknown_upload_id_returns_404(client: TestClient) -> None:
    _upload_department(client, "lima.csv", "LIMA", "150101")
    response = client.get("/api/analysis/series?upload_id=9999", headers=_auth())
    assert response.status_code == 404
    assert "no encontrada" in response.json()["detail"]


def test_demo_endpoint_is_gone(client: TestClient) -> None:
    assert client.post("/api/demo/load", headers=_auth()).status_code in (404, 405)
