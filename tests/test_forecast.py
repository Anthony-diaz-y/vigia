"""Forecast contract tests (M3).

All series are synthetic and deterministic (no RNG). Expected values are
hand-computed and stated literally.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from pandas.testing import assert_frame_equal

from vigia.forecast import (
    INSUFFICIENT_EVIDENCE,
    PUBLISH,
    ForecastConfig,
    forecast,
    interval_score,
    mase,
    seasonal_drift_forecast,
    weighted_interval_score,
)
from vigia.forecast.model import (
    BacktestResult,
    _scorecard_row,
    advance_epi_week,
)


def _build_parquet(tmp_path: Path) -> Path:
    """Deterministic weekly series: seasonal base plus a per-department trend."""
    seasonal = [20 + (i * 3) % 10 for i in range(52)]
    rows: list[tuple[str, str, int, int, int]] = []

    def add(dept: str, years: list[int], trend: int, noise) -> None:
        for year in years:
            for week in range(1, 53):
                index = (year - 2022) * 52 + (week - 1)
                value = seasonal[week - 1] + trend * index + noise(index)
                rows.append((dept, dept, year, week, int(value)))

    add("TREND", [2022, 2023, 2024], 2, lambda i: 0)
    add("FLAT", [2022, 2023, 2024], 0, lambda i: 0)
    add("SHORT", [2022], 0, lambda i: 0)
    add("NOISY", [2022, 2023, 2024], 3, lambda i: (i * 7) % 5 - 2)

    frame = pd.DataFrame(
        rows, columns=["department", "province", "year", "epi_week", "cases"]
    )
    path = tmp_path / "synthetic.parquet"
    frame.to_parquet(path, index=False)
    return path


def test_mase_formula() -> None:
    assert mase([1, -1, 2], [1, 2, 3]) == pytest.approx(2 / 3)
    assert mase([1.0], [0.0, 0.0, 0.0]) is not None
    assert np.isnan(mase([1.0], [0.0, 0.0, 0.0]))


def test_interval_and_weighted_interval_score() -> None:
    # actual inside the interval: score is just the width.
    assert interval_score(10, 6, 14, 0.2) == pytest.approx(8.0)
    # actual below the interval.
    assert interval_score(3, 6, 14, 0.2) == pytest.approx(8 + 10 * 3)
    # actual above the interval.
    assert interval_score(20, 6, 14, 0.2) == pytest.approx(8 + 10 * 6)

    # WIS for an actual above the interval: (0.5*10 + 0.1*68) / 1.5.
    assert weighted_interval_score(20, 10, 6, 14, 0.2) == pytest.approx(11.8 / 1.5)
    # WIS for an actual at the median: (0 + 0.1*8) / 1.5.
    assert weighted_interval_score(10, 10, 6, 14, 0.2) == pytest.approx(0.8 / 1.5)


def test_seasonal_drift_forecast() -> None:
    # Two "seasons" of length 3: drift is the constant year-over-year step of 3.
    # Targets are positions 6 and 7; seasonal naive looks back 3 positions.
    values = [1, 2, 3, 4, 5, 6]
    assert seasonal_drift_forecast(values, horizon=2, season=3) == [7.0, 8.0]

    # Exactly one season: no drift is estimable, so it reduces to seasonal naive.
    assert seasonal_drift_forecast([1, 2, 3], horizon=1, season=3) == [1.0]

    # Between one and two seasons: drift from the single available difference.
    assert seasonal_drift_forecast([1, 2, 3, 4], horizon=1, season=3) == [5.0]


def test_advance_epi_week() -> None:
    assert advance_epi_week(2024, 52, 1) == (2025, 1)
    assert advance_epi_week(2024, 46, 4) == (2024, 50)
    assert advance_epi_week(2024, 1, 4) == (2024, 5)


def test_scorecard_gate() -> None:
    config = ForecastConfig(horizon=2, min_windows=3, provisional_weeks=0)

    worse = BacktestResult(
        errors=np.full((3, 2), 5.0),
        forecasts=np.full((3, 2), 1.0),
        actuals=np.full((3, 2), 6.0),
        baseline_errors=np.full((3, 2), 1.0),
        origins=[0, 1, 2],
    )
    row = _scorecard_row(worse, config)
    assert row["status"] == INSUFFICIENT_EVIDENCE
    assert row["mase"] == pytest.approx(5.0)

    better = BacktestResult(
        errors=np.full((3, 2), 0.5),
        forecasts=np.full((3, 2), 1.0),
        actuals=np.full((3, 2), 1.5),
        baseline_errors=np.full((3, 2), 1.0),
        origins=[0, 1, 2],
    )
    row = _scorecard_row(better, config)
    assert row["status"] == PUBLISH
    assert row["mase"] == pytest.approx(0.5)

    few = BacktestResult(
        errors=np.full((1, 2), 0.5),
        forecasts=np.full((1, 2), 1.0),
        actuals=np.full((1, 2), 1.5),
        baseline_errors=np.full((1, 2), 1.0),
        origins=[0],
    )
    row = _scorecard_row(few, config)
    assert row["status"] == INSUFFICIENT_EVIDENCE
    assert row["windows"] == 1


def test_forecast_scorecard_and_gate(tmp_path: Path) -> None:
    path = _build_parquet(tmp_path)
    result = forecast([path], level="department", out_dir=tmp_path / "registry")

    scorecard = result.scorecard
    assert list(scorecard.columns) == ["department", "windows", "mase", "wis", "status"]
    assert set(scorecard["department"]) == {"TREND", "FLAT", "SHORT", "NOISY"}

    by_dept = scorecard.set_index("department")

    assert by_dept.loc["TREND", "status"] == PUBLISH
    # Only the oldest origin lacks a prior season for the drift, so 4 of the
    # 95*4 errors are non-zero and MASE is exactly 1/95.
    assert by_dept.loc["TREND", "mase"] == pytest.approx(1 / 95)

    assert by_dept.loc["FLAT", "status"] == INSUFFICIENT_EVIDENCE
    assert pd.isna(by_dept.loc["FLAT", "mase"])

    assert by_dept.loc["SHORT", "status"] == INSUFFICIENT_EVIDENCE
    assert by_dept.loc["SHORT", "windows"] == 0

    assert by_dept.loc["NOISY", "status"] == PUBLISH
    assert by_dept.loc["NOISY", "mase"] < 1.0

    # The gate is exactly MASE < 1 for every row with enough evidence.
    for _, row in scorecard.iterrows():
        expected = PUBLISH if (not pd.isna(row["mase"]) and row["mase"] < 1.0) else INSUFFICIENT_EVIDENCE
        assert row["status"] == expected

    # Only published departments get a forecast.
    assert set(result.forecasts["department"]) == {"TREND", "NOISY"}


def test_provisional_weeks_excluded_from_training(tmp_path: Path) -> None:
    path = _build_parquet(tmp_path)
    result = forecast([path], level="department", out_dir=tmp_path / "registry")

    trend = result.forecasts[result.forecasts["department"] == "TREND"]
    # 2024 has 52 weeks; the last 6 are provisional, so training ends at week 46
    # and horizons 1..4 target weeks 47..50.
    assert trend["target_year"].tolist() == [2024, 2024, 2024, 2024]
    assert trend["target_epi_week"].tolist() == [47, 48, 49, 50]
    assert trend["horizon"].tolist() == [1, 2, 3, 4]


def test_model_registry_is_versioned_and_idempotent(tmp_path: Path) -> None:
    path = _build_parquet(tmp_path)
    out = tmp_path / "registry"

    first = forecast([path], level="department", out_dir=out)
    second = forecast([path], level="department", out_dir=out)

    assert first.model_id == second.model_id
    assert first.registry_dir == second.registry_dir

    registry_dir = first.registry_dir
    assert (registry_dir / "config.json").exists()
    assert (registry_dir / "data_cut.json").exists()
    assert (registry_dir / "scorecard.json").exists()
    assert (registry_dir / "forecast.parquet").exists()

    config = json.loads((registry_dir / "config.json").read_text(encoding="utf-8"))
    assert config["horizon"] == 4
    assert config["provisional_weeks"] == 6

    saved = pd.read_json((registry_dir / "scorecard.json"))
    assert set(saved["department"]) == {"TREND", "FLAT", "SHORT", "NOISY"}


def test_forecast_is_reproducible(tmp_path: Path) -> None:
    path = _build_parquet(tmp_path)
    first = forecast([path], level="department", out_dir=tmp_path / "a")
    second = forecast([path], level="department", out_dir=tmp_path / "b")

    assert_frame_equal(first.scorecard, second.scorecard)
    assert_frame_equal(first.forecasts, second.forecasts)
