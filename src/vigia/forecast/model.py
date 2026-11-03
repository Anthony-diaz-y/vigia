"""Seasonal-naive-plus-drift forecasting with a rolling-origin backtest.

The model is deterministic and dependency-free: the point forecast (p50) is the
seasonal naive value plus the mean year-over-year drift, and the p10/p90
intervals come from the empirical quantiles of the backtest residuals.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Sequence

import numpy as np
import pandas as pd

from vigia.analysis.engine import geography_columns
from vigia.analysis.series import weekly_series
from vigia.forecast.metrics import mase, weighted_interval_score

#: The seasonal naive lag, matching ``SeasonalNaive(52)``.
WEEKS_PER_YEAR = 52

PUBLISH = "publish"
INSUFFICIENT_EVIDENCE = "insufficient_evidence"


@dataclass(frozen=True)
class ForecastConfig:
    horizon: int = 4
    min_windows: int = 3
    provisional_weeks: int = 6
    season: int = 52
    interval_alpha: float = 0.20

    def to_dict(self) -> dict[str, object]:
        return {
            "horizon": self.horizon,
            "min_windows": self.min_windows,
            "provisional_weeks": self.provisional_weeks,
            "season": self.season,
            "interval_alpha": self.interval_alpha,
        }


@dataclass
class BacktestResult:
    """Errors and outputs of a rolling-origin backtest for one geography."""

    errors: np.ndarray
    forecasts: np.ndarray
    actuals: np.ndarray
    baseline_errors: np.ndarray
    origins: list[int]

    @property
    def n_windows(self) -> int:
        return len(self.origins)


@dataclass
class ForecastResult:
    model_id: str
    scorecard: pd.DataFrame
    forecasts: pd.DataFrame
    registry_dir: Path
    config: ForecastConfig
    data_cut: dict[str, object] = field(default_factory=dict)


def advance_epi_week(year: int, epi_week: int, steps: int) -> tuple[int, int]:
    """Advance an epidemiological week by ``steps`` weeks (52-week years)."""
    total = year * WEEKS_PER_YEAR + (epi_week - 1) + steps
    return total // WEEKS_PER_YEAR, total % WEEKS_PER_YEAR + 1


def seasonal_drift_forecast(
    values: Sequence[float], horizon: int, season: int = WEEKS_PER_YEAR
) -> list[float]:
    """Point forecast: seasonal naive plus the mean year-over-year drift.

    ``values`` is a chronological weekly series of length at least ``season``.
    The drift is the mean of ``values[t] - values[t - season]`` over the most
    recent complete season (or all available differences when only one season
    is present). The forecast for the next ``horizon`` weeks is the value 52
    weeks earlier plus that drift.
    """
    series = np.asarray(values, dtype=float)
    n = len(series)
    if n < season:
        raise ValueError("seasonal drift needs at least one full season of history")

    if n >= 2 * season:
        drift = float(
            np.mean(series[n - season : n] - series[n - 2 * season : n - season])
        )
    elif n > season:
        drift = float(np.mean(series[season:n] - series[0 : n - season]))
    else:
        drift = 0.0

    return [float(series[n - season + h - 1]) + drift for h in range(1, horizon + 1)]


def rolling_backtest(values: Sequence[float], config: ForecastConfig) -> BacktestResult:
    """Rolling-origin backtest with a seasonal naive baseline.

    Origins run from the most recent week that leaves ``horizon`` actuals, back
    to the first week with a full season of training. Returns arrays of shape
    ``(n_origins, horizon)``.
    """
    series = np.asarray(values, dtype=float)
    n = len(series)
    horizon = config.horizon
    season = config.season

    origins = list(range(n - horizon, season - 1, -1))
    size = (len(origins), horizon)
    if not origins:
        return BacktestResult(
            errors=np.empty(size),
            forecasts=np.empty(size),
            actuals=np.empty(size),
            baseline_errors=np.empty(size),
            origins=[],
        )

    errors = np.empty(size)
    forecasts = np.empty(size)
    actuals = np.empty(size)
    baseline_errors = np.empty(size)

    for i, origin in enumerate(origins):
        point = seasonal_drift_forecast(series[:origin], horizon, season)
        for h in range(horizon):
            actual = series[origin + h]
            baseline = series[origin + h - season]
            forecasts[i, h] = point[h]
            actuals[i, h] = actual
            errors[i, h] = actual - point[h]
            baseline_errors[i, h] = actual - baseline

    return BacktestResult(
        errors=errors,
        forecasts=forecasts,
        actuals=actuals,
        baseline_errors=baseline_errors,
        origins=origins,
    )


def _wis(bt: BacktestResult, config: ForecastConfig) -> float:
    """WIS over the backtest using per-horizon empirical residual quantiles."""
    horizon = config.horizon
    alpha = config.interval_alpha
    q_low = np.percentile(bt.errors, 10.0, axis=0)
    q_high = np.percentile(bt.errors, 90.0, axis=0)

    scores = []
    for i in range(bt.n_windows):
        for h in range(horizon):
            median = bt.forecasts[i, h]
            scores.append(
                weighted_interval_score(
                    bt.actuals[i, h],
                    median,
                    median + q_low[h],
                    median + q_high[h],
                    alpha,
                )
            )
    return float(np.mean(scores))


def _scorecard_row(bt: BacktestResult, config: ForecastConfig) -> dict[str, object]:
    """MASE, WIS and publication status for one geography's backtest."""
    if bt.n_windows < config.min_windows:
        return {
            "windows": bt.n_windows,
            "mase": float("nan"),
            "wis": float("nan"),
            "status": INSUFFICIENT_EVIDENCE,
        }
    value = mase(bt.errors, bt.baseline_errors)
    status = PUBLISH if value < 1.0 else INSUFFICIENT_EVIDENCE
    return {
        "windows": bt.n_windows,
        "mase": value,
        "wis": _wis(bt, config),
        "status": status,
    }


def _production_rows(
    geo: dict[str, str],
    values: np.ndarray,
    bt: BacktestResult,
    last_week: tuple[int, int],
    config: ForecastConfig,
) -> list[dict[str, object]]:
    """p10/p50/p90 for the next ``horizon`` weeks, using backtest residual quantiles."""
    point = seasonal_drift_forecast(values, config.horizon, config.season)
    q_low = np.percentile(bt.errors, 10.0, axis=0)
    q_high = np.percentile(bt.errors, 90.0, axis=0)

    rows: list[dict[str, object]] = []
    for h in range(config.horizon):
        target_year, target_week = advance_epi_week(last_week[0], last_week[1], h + 1)
        rows.append(
            {
                **geo,
                "horizon": h + 1,
                "target_year": target_year,
                "target_epi_week": target_week,
                "p10": point[h] + q_low[h],
                "p50": point[h],
                "p90": point[h] + q_high[h],
            }
        )
    return rows


def _group_key(key: object, geo: list[str]) -> dict[str, str]:
    key_tuple = key if isinstance(key, tuple) else (key,)
    return {column: str(value) for column, value in zip(geo, key_tuple)}


def forecast(
    parquet_paths: Sequence[str | Path],
    *,
    level: str = "department",
    config: ForecastConfig | None = None,
    out_dir: str | Path,
) -> ForecastResult:
    """Run the forecast pipeline and return a scorecard plus published forecasts.

    Reads the M1 Parquet, excludes the last ``provisional_weeks`` per geography,
    runs a rolling-origin backtest, scores each geography, applies the
    publication gate (MASE < 1) and emits a versioned registry artifact.
    """
    from vigia.forecast.registry import ModelRegistry, file_sha256, model_id

    config = config or ForecastConfig()
    out_dir = Path(out_dir)
    geo = geography_columns(level)

    series = weekly_series(parquet_paths, level=level)

    score_rows: list[dict[str, object]] = []
    forecast_rows: list[dict[str, object]] = []
    for key, group in series.groupby(geo, sort=True):
        geo_row = _group_key(key, geo)
        ordered = group.sort_values(["year", "epi_week"])
        values = ordered["cases"].astype(float).to_numpy()
        weeks = [
            (int(year), int(week))
            for year, week in ordered[["year", "epi_week"]].itertuples(
                index=False, name=None
            )
        ]

        if config.provisional_weeks > 0 and len(values) > config.provisional_weeks:
            values = values[: -config.provisional_weeks]
            weeks = weeks[: -config.provisional_weeks]

        if len(values) < config.season:
            score_rows.append(
                {
                    **geo_row,
                    "windows": 0,
                    "mase": float("nan"),
                    "wis": float("nan"),
                    "status": INSUFFICIENT_EVIDENCE,
                }
            )
            continue

        bt = rolling_backtest(values, config)
        row = _scorecard_row(bt, config)
        score_rows.append({**geo_row, **row})

        if row["status"] == PUBLISH:
            forecast_rows.extend(
                _production_rows(geo_row, values, bt, weeks[-1], config)
            )

    scorecard = pd.DataFrame(score_rows)
    forecast_columns = geo + [
        "horizon",
        "target_year",
        "target_epi_week",
        "p10",
        "p50",
        "p90",
    ]
    forecasts = pd.DataFrame(forecast_rows, columns=forecast_columns)

    data_cut = {
        "level": level,
        "file_hashes": sorted(file_sha256(Path(p)) for p in parquet_paths),
        "min_year": int(series["year"].min()),
        "max_year": int(series["year"].max()),
        "n_geographies": int(scorecard.shape[0]),
    }
    identifier = model_id(config.to_dict(), data_cut)
    registry_dir = ModelRegistry(out_dir).write(
        identifier,
        config=config.to_dict(),
        data_cut=data_cut,
        scorecard=scorecard,
        forecasts=forecasts,
    )

    return ForecastResult(
        model_id=identifier,
        scorecard=scorecard,
        forecasts=forecasts,
        registry_dir=registry_dir,
        config=config,
        data_cut=data_cut,
    )
