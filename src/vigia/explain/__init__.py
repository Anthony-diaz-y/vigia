"""Deterministic explanation and recommendations for the forecast."""

from vigia.explain.drivers import (
    ACTION_TABLE,
    FEATURES,
    linear_shap,
    recommend,
    ridge_weights,
    standardize,
    top_drivers,
)
from vigia.explain.narrative import NarrativeResult, narrative, render_template
from vigia.explain.pipeline import ExplainResult, explain

__all__ = [
    "ACTION_TABLE",
    "FEATURES",
    "ExplainResult",
    "NarrativeResult",
    "explain",
    "linear_shap",
    "narrative",
    "recommend",
    "render_template",
    "ridge_weights",
    "standardize",
    "top_drivers",
]
