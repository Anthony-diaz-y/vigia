"""Explanation contract tests (M4).

All series are synthetic and deterministic (no RNG). Linear SHAP is closed
form, so driver rankings are exact and reproducible.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from pandas.testing import assert_frame_equal

from vigia.explain import (
    ACTION_TABLE,
    FEATURES,
    explain,
    linear_shap,
    narrative,
    recommend,
    render_template,
    standardize,
    top_drivers,
)
from vigia.forecast import year_over_year_drift


def _build_parquet(tmp_path: Path) -> Path:
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
    add("NOISY", [2022, 2023, 2024], 3, lambda i: (i * 7) % 5 - 2)
    add("SHORT", [2022], 0, lambda i: 0)

    frame = pd.DataFrame(
        rows, columns=["department", "province", "year", "epi_week", "cases"]
    )
    path = tmp_path / "synthetic.parquet"
    frame.to_parquet(path, index=False)
    return path


def test_year_over_year_drift() -> None:
    assert year_over_year_drift([1, 2, 3, 4, 5, 6], season=3) == 3.0
    assert year_over_year_drift([1, 2, 3], season=3) == 0.0
    assert year_over_year_drift([1, 2, 3, 4], season=3) == 3.0


def test_linear_shap_formula() -> None:
    Xs = np.array([[1.0, -1.0], [2.0, 0.5]])
    weights = np.array([0.5, -2.0])
    phi = linear_shap(Xs, weights)
    assert phi == pytest.approx(np.array([[0.5, 2.0], [1.0, -1.0]]))


def test_standardize_zero_variance_is_safe() -> None:
    X = np.array([[1.0, 5.0], [2.0, 5.0], [3.0, 5.0]])
    Xs, _mean, std = standardize(X)
    assert std[1] == 1.0
    assert (Xs[:, 1] == 0.0).all()


def test_top_drivers_returns_top_5_per_unit(tmp_path: Path) -> None:
    path = _build_parquet(tmp_path)
    drivers = top_drivers([path], level="department")

    assert list(drivers.columns) == [
        "department",
        "rank",
        "feature",
        "driver",
        "mean_shap",
        "abs_mean_shap",
        "direction",
    ]
    # SHORT has too little history, so it is skipped.
    assert set(drivers["department"]) == {"TREND", "FLAT", "NOISY"}

    for _unit, group in drivers.groupby("department", sort=True):
        assert group["rank"].tolist() == [1, 2, 3, 4, 5]
        assert group["abs_mean_shap"].is_monotonic_decreasing
        assert group["feature"].isin(FEATURES).all()


def test_flat_department_top_driver_is_seasonal_baseline(tmp_path: Path) -> None:
    path = _build_parquet(tmp_path)
    drivers = top_drivers([path], level="department")
    flat = drivers[drivers["department"] == "FLAT"]
    # Cases are exactly periodic, so the same-week-last-year feature explains
    # the target perfectly and dominates the ranking.
    assert flat.iloc[0]["feature"] == "seasonal_baseline"


def test_action_table_covers_every_feature() -> None:
    for feature in FEATURES:
        assert feature in ACTION_TABLE
        assert ACTION_TABLE[feature]


def test_recommend_attaches_actions(tmp_path: Path) -> None:
    path = _build_parquet(tmp_path)
    recommendations = recommend(top_drivers([path], level="department"))
    assert "action" in recommendations.columns
    assert recommendations["action"].notna().all()


def test_narrative_template_is_deterministic() -> None:
    payload = {
        "unit": "LIMA",
        "drivers": [
            {
                "driver": "Casos recientes",
                "feature": "recent_level",
                "direction": "up",
                "action": "Intensificar la investigación de casos.",
            },
            {
                "driver": "Temporada previa",
                "feature": "seasonal_baseline",
                "direction": "down",
                "action": "Preparar capacidad de respuesta.",
            },
        ],
    }
    first = render_template(payload)
    second = render_template(payload)
    assert first == second
    assert "LIMA" in first
    assert "Casos recientes (al alza)" in first
    assert "Intensificar la investigación de casos." in first


def test_narrative_falls_back_without_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    result = narrative({"unit": "LIMA", "drivers": []})
    assert result.source == "template"
    assert "LIMA" in result.text


def test_explain_integration(tmp_path: Path) -> None:
    path = _build_parquet(tmp_path)
    result = explain([path], level="department")

    assert set(result.drivers["department"]) == {"TREND", "FLAT", "NOISY"}
    assert "action" in result.drivers.columns
    assert len(result.narratives) == 3
    assert all(item.source == "template" for item in result.narratives)
    texts = "\n".join(item.text for item in result.narratives)
    assert "TREND" in texts and "FLAT" in texts and "NOISY" in texts


def test_explain_is_reproducible(tmp_path: Path) -> None:
    path = _build_parquet(tmp_path)
    first = explain([path], level="department")
    second = explain([path], level="department")

    assert_frame_equal(first.drivers, second.drivers)
    assert [item.text for item in first.narratives] == [
        item.text for item in second.narratives
    ]
