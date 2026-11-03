"""Forecast accuracy metrics: MASE and the weighted interval score (WIS)."""

from __future__ import annotations

import numpy as np


def mase(model_errors, baseline_errors) -> float:
    """Mean absolute scaled error against a baseline (seasonal naive).

    ``MASE = mean(|model_errors|) / mean(|baseline_errors|)``. Values below 1
    mean the model beats the baseline; a perfect baseline (denominator 0)
    returns ``nan`` because no model can improve on zero error.
    """
    model = np.asarray(model_errors, dtype=float).ravel()
    baseline = np.asarray(baseline_errors, dtype=float).ravel()
    if model.size == 0 or baseline.size == 0:
        return float("nan")
    baseline_mae = float(np.mean(np.abs(baseline)))
    if baseline_mae == 0:
        return float("nan")
    return float(np.mean(np.abs(model)) / baseline_mae)


def interval_score(actual: float, lower: float, upper: float, alpha: float) -> float:
    """Interval score for a central ``(1 - alpha)`` prediction interval."""
    actual = float(actual)
    lower = float(lower)
    upper = float(upper)
    width = upper - lower
    if actual < lower:
        width += (2.0 / alpha) * (lower - actual)
    elif actual > upper:
        width += (2.0 / alpha) * (actual - upper)
    return width


def weighted_interval_score(
    actual: float, median: float, lower: float, upper: float, alpha: float
) -> float:
    """WIS for a median plus one central ``(1 - alpha)`` interval (Bracher et al.)."""
    numerator = 0.5 * abs(actual - median) + (alpha / 2.0) * interval_score(
        actual, lower, upper, alpha
    )
    return numerator / 1.5
