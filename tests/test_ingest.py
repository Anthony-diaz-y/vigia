"""Ingestion contract tests (requirements R1-R6).

Fixtures are synthetic. The column layout mirrors the public MINSA/CDC Peru
dengue dataset, but no row here is real surveillance data.
"""

from __future__ import annotations

import hashlib
import zipfile
from pathlib import Path

import pandas as pd
import pytest

from vigia.ingest import ingest_file
from vigia.ingest.errors import (
    MissingRequiredColumns,
    PiiDetected,
    UnsupportedFile,
)

FIXTURES = Path(__file__).parent / "fixtures"
CLEAN = FIXTURES / "minsa_dengue_clean.csv"

HEADER = (
    "departamento,provincia,distrito,enfermedad,ano,semana,"
    "diagnostico,tipo_diagnostico,ubigeo,edad,tipo_edad,sexo,casos\n"
)


def _write(tmp_path: Path, body: str, name: str = "upload.csv", header: str = HEADER) -> Path:
    path = tmp_path / name
    path.write_text(header + body, encoding="utf-8")
    return path


def _read(result) -> pd.DataFrame:
    return pd.read_parquet(result.normalized_path)


def _issue_codes(result) -> set[str]:
    return {issue.code for issue in result.quality.issues}


def test_ingest_clean_file_produces_parquet_and_report(tmp_path: Path) -> None:
    result = ingest_file(CLEAN, out_dir=tmp_path / "out", source="minsa_dengue")

    assert result.status == "ok"
    assert result.rows_in == 10
    assert result.rows_valid == 10
    assert result.rows_dropped == 0
    assert result.normalized_path.exists()
    assert result.quality_path.exists()

    frame = _read(result)
    assert len(frame) == 10
    assert pd.api.types.is_string_dtype(frame["ubigeo"])
    assert not pd.api.types.is_numeric_dtype(frame["ubigeo"])
    assert "010101" in set(frame["ubigeo"])


def test_ubigeo_leading_zeros_preserved_from_numeric_column(tmp_path: Path) -> None:
    body = (
        "LORETO,MAYNAS,IQUITOS,DENGUE,2024,1,DENGUE SIN SIGNOS DE ALARMA,"
        "CONFIRMADO,10101,12,ANOS,F,3\n"
    )
    path = _write(tmp_path, body)

    result = ingest_file(path, out_dir=tmp_path / "out", source="minsa_dengue")

    assert result.rows_valid == 1
    assert _read(result)["ubigeo"].tolist() == ["010101"]


def test_semicolon_delimited_latin1_is_read(tmp_path: Path) -> None:
    text = (
        "DEPARTAMENTO;PROVINCIA;DISTRITO;ENFERMEDAD;AÑO;SEMANA;DIAGNOSTICO;"
        "TIPO_DIAGNOSTICO;UBIGEO;EDAD;TIPO_EDAD;SEXO;CASOS\n"
        "LORETO;MAYNAS;IQUITOS;DENGUE;2024;5;DENGUE SIN SIGNOS DE ALARMA;"
        "CONFIRMADO;160110;12;AÑOS;F;3\n"
    )
    path = tmp_path / "latin1.csv"
    path.write_bytes(text.encode("cp1252"))

    result = ingest_file(path, out_dir=tmp_path / "out", source="minsa_dengue")

    assert result.rows_valid == 1
    frame = _read(result)
    assert frame["department"].tolist() == ["LORETO"]
    assert frame["epi_week"].tolist() == [5]


def test_messy_headers_resolved_by_fuzzy_matching(tmp_path: Path) -> None:
    header = (
        " Dpto ;Provincia ;Distrito ;Enfermedad ;AÑO ;Semana_Epidemiologica_Notif ;"
        "Diagnostico ;Tipo Diagnostico ;Ubigeo ;Edad ;Tipo Edad ;Sexo ;Casos \n"
    )
    body = (
        "LORETO;MAYNAS;IQUITOS;DENGUE;2024;6;DENGUE SIN SIGNOS DE ALARMA;"
        "CONFIRMADO;160110;12;ANOS;F;3\n"
    )
    path = tmp_path / "messy.csv"
    path.write_text(header + body, encoding="utf-8")

    result = ingest_file(path, out_dir=tmp_path / "out", source="minsa_dengue")

    assert result.rows_valid == 1
    assert result.mapping["ubigeo"] == "Ubigeo"
    assert result.mapping["epi_week"] == "Semana_Epidemiologica_Notif"
    assert _read(result)["epi_week"].tolist() == [6]


def test_duplicates_collapsed_and_counted(tmp_path: Path) -> None:
    row = (
        "LORETO,MAYNAS,IQUITOS,DENGUE,2024,7,DENGUE SIN SIGNOS DE ALARMA,"
        "CONFIRMADO,160110,12,ANOS,F,{cases}\n"
    )
    body = row.format(cases=1) + row.format(cases=2) + row.format(cases=3)
    path = _write(tmp_path, body)

    result = ingest_file(path, out_dir=tmp_path / "out", source="minsa_dengue")

    assert result.rows_in == 3
    assert result.rows_valid == 1
    assert result.duplicates_collapsed == 2
    assert _read(result)["cases"].tolist() == [6]


def test_invalid_rows_reported_in_quality(tmp_path: Path) -> None:
    body = (
        "LORETO,MAYNAS,IQUITOS,DENGUE,2024,8,DENGUE SIN SIGNOS DE ALARMA,"
        "CONFIRMADO,160110,12,ANOS,F,3\n"
        "LORETO,MAYNAS,IQUITOS,DENGUE,1899,9,DENGUE SIN SIGNOS DE ALARMA,"
        "CONFIRMADO,160110,12,ANOS,F,3\n"
        "LORETO,MAYNAS,IQUITOS,DENGUE,2024,60,DENGUE SIN SIGNOS DE ALARMA,"
        "CONFIRMADO,160110,12,ANOS,F,3\n"
        "LORETO,MAYNAS,IQUITOS,DENGUE,2024,10,DENGUE SIN SIGNOS DE ALARMA,"
        "CONFIRMADO,ABC,12,ANOS,F,3\n"
        "LORETO,MAYNAS,IQUITOS,DENGUE,2024,11,DENGUE SIN SIGNOS DE ALARMA,"
        "CONFIRMADO,160110,12,ANOS,F,-4\n"
        "LORETO,MAYNAS,IQUITOS,DENGUE,2024,12,DENGUE SIN SIGNOS DE ALARMA,"
        "CONFIRMADO,,12,ANOS,F,3\n"
    )
    path = _write(tmp_path, body)

    result = ingest_file(path, out_dir=tmp_path / "out", source="minsa_dengue")

    assert result.rows_in == 6
    assert result.rows_valid == 1
    assert result.rows_dropped == 5
    codes = _issue_codes(result)
    assert "year_out_of_range" in codes
    assert "epi_week_out_of_range" in codes
    assert "invalid_ubigeo" in codes
    assert "negative_cases" in codes
    assert "missing_ubigeo" in codes
    assert result.status == "ok_with_issues"


def test_missing_required_column_raises(tmp_path: Path) -> None:
    path = tmp_path / "no_ubigeo.csv"
    path.write_text(
        "departamento,ano,semana,casos\nLORETO,2024,1,3\n", encoding="utf-8"
    )

    with pytest.raises(MissingRequiredColumns) as excinfo:
        ingest_file(path, out_dir=tmp_path / "out", source="minsa_dengue")

    assert "ubigeo" in excinfo.value.missing


def test_pii_columns_are_rejected(tmp_path: Path) -> None:
    header = HEADER.strip() + ",dni\n"
    body = (
        "LORETO,MAYNAS,IQUITOS,DENGUE,2024,1,DENGUE SIN SIGNOS DE ALARMA,"
        "CONFIRMADO,160110,12,ANOS,F,3,45678912\n"
    )
    path = tmp_path / "with_pii.csv"
    path.write_text(header + body, encoding="utf-8")

    with pytest.raises(PiiDetected) as excinfo:
        ingest_file(path, out_dir=tmp_path / "out", source="minsa_dengue")

    assert excinfo.value.columns == ["dni"]


def test_ingest_is_idempotent_by_file_hash(tmp_path: Path) -> None:
    first = ingest_file(CLEAN, out_dir=tmp_path / "out", source="minsa_dengue")
    second = ingest_file(CLEAN, out_dir=tmp_path / "out", source="minsa_dengue")

    expected = hashlib.sha256(CLEAN.read_bytes()).hexdigest()
    assert first.file_hash == expected
    assert second.file_hash == expected
    assert second.rows_valid == first.rows_valid
    assert second.normalized_path == first.normalized_path


def test_xlsm_with_macros_rejected(tmp_path: Path) -> None:
    path = tmp_path / "macro.xlsm"
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("xl/vbaProject.bin", "not-a-real-macro")

    with pytest.raises(UnsupportedFile):
        ingest_file(path, out_dir=tmp_path / "out", source="minsa_dengue")
