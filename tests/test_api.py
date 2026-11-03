"""API contract tests (M5)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

TOKEN = "test-token"


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("VIGIA_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("VIGIA_ACCESS_TOKEN", TOKEN)
    from vigia.api.main import create_app

    with TestClient(create_app()) as test_client:
        yield test_client


def _auth() -> dict[str, str]:
    return {"X-Access-Token": TOKEN}


def test_health_is_public_with_disclaimer(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert "medical device" in response.json()["disclaimer"]


def test_missing_token_is_rejected(client: TestClient) -> None:
    assert client.get("/api/analysis/series").status_code == 401


def test_demo_load_then_analysis_forecast_explain_export(client: TestClient) -> None:
    response = client.post("/api/demo/load", headers=_auth())
    assert response.status_code == 200
    assert response.json()["rows_valid"] == 624

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
    client.post("/api/demo/load", headers=_auth())
    assert len(client.get("/api/uploads", headers=_auth()).json()) == 1

    response = client.delete("/api/uploads", headers=_auth())
    assert response.status_code == 200
    assert response.json() == {"cleared": True}
    assert client.get("/api/uploads", headers=_auth()).json() == []
