"""Deterministic analysis contract tests (M2).

All fixtures are synthetic; no row here is real surveillance data. Expected
values are hand-computed from ``tests/fixtures/analysis_synthetic.csv`` and
stated literally so any change to an aggregate is caught.
"""

from __future__ import annotations

from pathlib import Path

import duckdb
import pandas as pd
import pytest
from pandas.testing import assert_frame_equal

from vigia.analysis import (
    anomalies,
    heatmap,
    interannual_comparison,
    rank_by_rate,
    weekly_series,
)
from vigia.ingest import ingest_file

FIXTURES = Path(__file__).parent / "fixtures"
ANALYSIS_FIXTURE = FIXTURES / "analysis_synthetic.csv"

POPULATION = pd.DataFrame(
    {
        "department": ["LIMA", "PIURA", "PIURA"],
        "province": ["LIMA", "PIURA", "SULLANA"],
        "population": [100_000, 10_000, 10_000],
    }
)


def _ingest(tmp_path: Path) -> Path:
    result = ingest_file(
        ANALYSIS_FIXTURE, out_dir=tmp_path / "out", source="minsa_dengue"
    )
    assert result.rows_valid == 27
    assert result.rows_dropped == 0
    return result.normalized_path


def test_weekly_series_matches_hand_checked_sql(tmp_path: Path) -> None:
    path = _ingest(tmp_path)
    actual = weekly_series([path], level="department")

    # Independent, hand-written SQL over the same Parquet.
    connection = duckdb.connect()
    try:
        expected = connection.execute(
            """
            SELECT department, year, epi_week, CAST(SUM(cases) AS BIGINT) AS cases
            FROM read_parquet(?)
            GROUP BY department, year, epi_week
            ORDER BY department, year, epi_week
            """,
            [[str(path)]],
        ).df()
    finally:
        connection.close()

    assert_frame_equal(actual, expected, check_dtype=False)

    lima = actual[actual["department"] == "LIMA"]
    assert lima.loc[lima["epi_week"] == 3, "cases"].tolist() == [15, 16, 50]
    piura = actual[actual["department"] == "PIURA"]
    assert set(piura["cases"]) == {22}


def test_weekly_series_province(tmp_path: Path) -> None:
    path = _ingest(tmp_path)
    frame = weekly_series([path], level="province")

    assert list(frame.columns) == ["department", "province", "year", "epi_week", "cases"]

    sullana = frame[frame["province"] == "SULLANA"]
    assert len(sullana) == 9
    assert set(sullana["cases"]) == {2}

    piura_city = frame[
        (frame["department"] == "PIURA") & (frame["province"] == "PIURA")
    ]
    assert set(piura_city["cases"]) == {20}


def test_interannual_comparison(tmp_path: Path) -> None:
    path = _ingest(tmp_path)

    national = interannual_comparison([path], level="department")
    assert national.loc[1, 2022] == 27  # LIMA 5 + PIURA 22
    assert national.loc[2, 2022] == 32  # LIMA 10 + PIURA 22
    assert national.loc[3, 2022] == 37  # LIMA 15 + PIURA 22
    assert national.loc[1, 2023] == 28  # LIMA 6 + PIURA 22
    assert national.loc[3, 2024] == 72  # LIMA 50 + PIURA 22
    assert list(national.columns) == [2022, 2023, 2024]

    lima = interannual_comparison([path], level="department", geography="LIMA")
    assert lima.loc[3, 2022] == 15
    assert lima.loc[3, 2023] == 16
    assert lima.loc[3, 2024] == 50


def test_heatmap(tmp_path: Path) -> None:
    path = _ingest(tmp_path)
    matrix = heatmap([path], year=2024, level="department")

    assert list(matrix.columns) == [1, 2, 3]
    assert matrix.loc["LIMA", 1] == 7
    assert matrix.loc["LIMA", 3] == 50
    assert matrix.loc["PIURA", 1] == 22
    assert matrix.loc["PIURA", 3] == 22


def test_rank_by_rate_department(tmp_path: Path) -> None:
    path = _ingest(tmp_path)
    ranked = rank_by_rate([path], POPULATION, level="department", year=2024)

    assert ranked["department"].tolist() == ["PIURA", "LIMA"]
    assert ranked["rank"].tolist() == [1, 2]
    # PIURA: 66 cases / 20k * 100k = 330. LIMA: 69 / 100k * 100k = 69.
    assert ranked["rate_per_100k"].tolist() == pytest.approx([330.0, 69.0])
    assert ranked["cases"].tolist() == [66, 69]


def test_rank_by_rate_province(tmp_path: Path) -> None:
    path = _ingest(tmp_path)
    ranked = rank_by_rate([path], POPULATION, level="province", year=2024)

    assert ranked[["department", "province"]].values.tolist() == [
        ["PIURA", "PIURA"],
        ["LIMA", "LIMA"],
        ["PIURA", "SULLANA"],
    ]
    # PIURA/PIURA: 60 / 10k * 100k = 600. LIMA/LIMA: 69. SULLANA: 60.
    assert ranked["rate_per_100k"].tolist() == pytest.approx([600.0, 69.0, 60.0])


def test_anomalies_department(tmp_path: Path) -> None:
    path = _ingest(tmp_path)
    frame = anomalies([path], level="department")

    flagged = frame[frame["is_anomaly"]]
    assert len(flagged) == 1
    row = flagged.iloc[0]
    assert row["department"] == "LIMA"
    assert row["year"] == 2024
    assert row["epi_week"] == 3
    assert row["seasonal_baseline"] == 16.0  # median(15, 16, 50)
    assert row["residual"] == 34.0
    assert row["robust_z"] == pytest.approx(0.6745 * 34)

    piura = frame[frame["department"] == "PIURA"]
    assert not piura["is_anomaly"].any()
    assert (piura["robust_z"] == 0.0).all()


def test_figures_are_reproducible(tmp_path: Path) -> None:
    path = _ingest(tmp_path)

    assert_frame_equal(
        weekly_series([path], level="department"),
        weekly_series([path], level="department"),
    )
    assert_frame_equal(
        anomalies([path], level="department"),
        anomalies([path], level="department"),
    )


def test_invalid_level_raises(tmp_path: Path) -> None:
    path = _ingest(tmp_path)
    with pytest.raises(ValueError):
        weekly_series([path], level="district")


def test_rank_by_rate_rejects_missing_population_columns(tmp_path: Path) -> None:
    path = _ingest(tmp_path)
    with pytest.raises(ValueError):
        rank_by_rate([path], pd.DataFrame({"department": ["LIMA"]}), level="department")
