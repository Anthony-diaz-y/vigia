"""Top-level explanation pipeline: drivers, then actions, then a narrative."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Sequence

import pandas as pd

from vigia.analysis.engine import geography_columns
from vigia.explain.drivers import recommend, top_drivers
from vigia.explain.narrative import NarrativeResult, narrative


@dataclass
class ExplainResult:
    drivers: pd.DataFrame
    narratives: list[NarrativeResult] = field(default_factory=list)


def explain(
    parquet_paths: Sequence[str | Path],
    *,
    level: str = "department",
    top_k: int = 5,
    provisional_weeks: int = 6,
) -> ExplainResult:
    """Produce top-k drivers, preventive actions and a narrative per unit."""
    drivers = top_drivers(
        parquet_paths,
        level=level,
        top_k=top_k,
        provisional_weeks=provisional_weeks,
    )
    recommendations = recommend(drivers)
    geo = geography_columns(level)

    narratives: list[NarrativeResult] = []
    for key, group in recommendations.groupby(geo, sort=True):
        unit = " / ".join(
            str(value) for value in (key if isinstance(key, tuple) else (key,))
        )
        payload_drivers = group[
            ["feature", "direction", "mean_shap", "action"]
        ].to_dict(orient="records")
        narratives.append(narrative({"unit": unit, "drivers": payload_drivers}))

    return ExplainResult(drivers=recommendations, narratives=narratives)
