"""Short-horizon forecasting with measured accuracy and a publication gate."""

from vigia.forecast.metrics import interval_score, mase, weighted_interval_score
from vigia.forecast.model import (
    INSUFFICIENT_EVIDENCE,
    PUBLISH,
    ForecastConfig,
    ForecastResult,
    forecast,
    seasonal_drift_forecast,
    year_over_year_drift,
)
from vigia.forecast.registry import ModelRegistry, model_id

__all__ = [
    "INSUFFICIENT_EVIDENCE",
    "PUBLISH",
    "ForecastConfig",
    "ForecastResult",
    "ModelRegistry",
    "forecast",
    "interval_score",
    "mase",
    "model_id",
    "seasonal_drift_forecast",
    "weighted_interval_score",
    "year_over_year_drift",
]
