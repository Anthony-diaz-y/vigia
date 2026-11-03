"""SHAP top-k drivers per geographic unit via exact linear SHAP.

The explanation model is a ridge regression over six engineered features, fit
per geography with numpy (no extra dependency). Linear SHAP values are closed
form -- ``phi_j = w_j * (x_j - mean_j)`` -- so they are computed directly
instead of approximated.
"""

from __future__ import annotations

import math
from pathlib import Path
from typing import Sequence

import numpy as np
import pandas as pd

from vigia.analysis.engine import geography_columns
from vigia.analysis.series import weekly_series
from vigia.forecast import year_over_year_drift
from vigia.forecast.model import WEEKS_PER_YEAR

#: Engineered features, in column order, each mapping to a named driver.
FEATURES: tuple[str, ...] = (
    "recent_level",  # cases one week ago
    "recent_level_2w",  # cases two weeks ago
    "seasonal_baseline",  # cases same week last year
    "year_over_year_trend",  # mean year-over-year change
    "seasonal_phase_sin",  # sin(2*pi*week/52)
    "seasonal_phase_cos",  # cos(2*pi*week/52)
)

DEFAULT_RIDGE_LAMBDA = 1.0
DEFAULT_PROVISIONAL_WEEKS = 6

#: Human-readable Spanish labels for the feature keys shown to the user.
DRIVER_LABELS: dict[str, str] = {
    "recent_level": "Casos recientes",
    "recent_level_2w": "Casos hace 2 semanas",
    "seasonal_baseline": "Temporada previa",
    "year_over_year_trend": "Tendencia interanual",
    "seasonal_phase_sin": "Estacionalidad",
    "seasonal_phase_cos": "Estacionalidad (fase)",
}

#: Deterministic driver -> preventive action table. The LLM never writes these.
ACTION_TABLE: dict[str, str] = {
    "recent_level": "Intensificar la investigación de casos en las unidades notificadoras.",
    "recent_level_2w": "Sostener la vigilancia activa en los distritos con transmisión reciente.",
    "seasonal_baseline": "Preparar capacidad de respuesta antes del pico estacional esperado.",
    "year_over_year_trend": "Reforzar el control larvario para contrarrestar la tendencia creciente.",
    "seasonal_phase_sin": "Calendarizar las campañas preventivas según la temporada de transmisión.",
    "seasonal_phase_cos": "Alinear personal e insumos con la temporada de transmisión.",
}


def _feature_matrix(
    cases: np.ndarray, weeks: list[tuple[int, int]]
) -> tuple[np.ndarray, np.ndarray]:
    """Build ``(X, y)`` for one geography: predict ``cases[t]`` from past features."""
    season = WEEKS_PER_YEAR
    rows: list[list[float]] = []
    targets: list[float] = []
    for t in range(season, len(cases)):
        _year, week = weeks[t]
        rows.append(
            [
                cases[t - 1],
                cases[t - 2],
                cases[t - season],
                year_over_year_drift(cases[:t], season),
                math.sin(2 * math.pi * week / season),
                math.cos(2 * math.pi * week / season),
            ]
        )
        targets.append(cases[t])
    return np.asarray(rows, dtype=float), np.asarray(targets, dtype=float)


def standardize(X: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Z-score features, keeping zero-variance columns safely at zero."""
    mean = X.mean(axis=0)
    std = X.std(axis=0)
    std[std == 0.0] = 1.0
    return (X - mean) / std, mean, std


def ridge_weights(Xs: np.ndarray, ys: np.ndarray, lam: float) -> np.ndarray:
    """Ridge regression weights ``(Xs.T Xs + lam I)^-1 Xs.T ys``."""
    features = Xs.shape[1]
    gram = Xs.T @ Xs + lam * np.eye(features)
    return np.linalg.solve(gram, Xs.T @ ys)


def linear_shap(Xs: np.ndarray, weights: np.ndarray) -> np.ndarray:
    """Per-row linear SHAP values for standardized (zero-mean) features."""
    return Xs * weights


def _group_key(key: object, geo: list[str]) -> dict[str, str]:
    key_tuple = key if isinstance(key, tuple) else (key,)
    return {column: str(value) for column, value in zip(geo, key_tuple)}


def top_drivers(
    parquet_paths: Sequence[str | Path],
    *,
    level: str = "department",
    top_k: int = 5,
    ridge_lambda: float = DEFAULT_RIDGE_LAMBDA,
    provisional_weeks: int = DEFAULT_PROVISIONAL_WEEKS,
) -> pd.DataFrame:
    """Rank the top ``top_k`` drivers per geographic unit by mean |SHAP|."""
    geo = geography_columns(level)
    series = weekly_series(parquet_paths, level=level)

    rows: list[dict[str, object]] = []
    for key, group in series.groupby(geo, sort=True):
        geo_row = _group_key(key, geo)
        ordered = group.sort_values(["year", "epi_week"])
        cases = ordered["cases"].astype(float).to_numpy()
        weeks = [
            (int(year), int(week))
            for year, week in ordered[["year", "epi_week"]].itertuples(
                index=False, name=None
            )
        ]
        if provisional_weeks > 0 and len(cases) > provisional_weeks:
            cases = cases[:-provisional_weeks]
            weeks = weeks[:-provisional_weeks]

        if len(cases) <= WEEKS_PER_YEAR:
            continue

        X, y = _feature_matrix(cases, weeks)
        if X.shape[0] < 2:
            continue

        Xs, _mean, _std = standardize(X)
        ys = y - y.mean()
        weights = ridge_weights(Xs, ys, ridge_lambda)
        phi = linear_shap(Xs, weights)

        mean_shap = phi.mean(axis=0)
        abs_mean_shap = np.abs(phi).mean(axis=0)
        order = np.argsort(-abs_mean_shap)[:top_k]

        for rank, index in enumerate(order, start=1):
            feature = FEATURES[index]
            rows.append(
                {
                    **geo_row,
                    "rank": int(rank),
                    "feature": feature,
                    "driver": DRIVER_LABELS[feature],
                    "mean_shap": float(mean_shap[index]),
                    "abs_mean_shap": float(abs_mean_shap[index]),
                    "direction": "up" if mean_shap[index] >= 0 else "down",
                }
            )

    return pd.DataFrame(
        rows,
        columns=geo
        + ["rank", "feature", "driver", "mean_shap", "abs_mean_shap", "direction"],
    )


def recommend(drivers: pd.DataFrame) -> pd.DataFrame:
    """Attach the deterministic preventive action for each driver row."""
    result = drivers.copy()
    result["action"] = result["feature"].map(ACTION_TABLE)
    return result
