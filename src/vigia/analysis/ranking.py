"""Department x week heatmap and ranking by rate per 100k inhabitants."""

from __future__ import annotations

from pathlib import Path
from typing import Sequence

import pandas as pd

from vigia.analysis.engine import geography_columns
from vigia.analysis.series import weekly_series

POPULATION_COLUMNS = ("department", "province", "population")


def heatmap(
    parquet_paths: Sequence[str | Path],
    *,
    year: int,
    level: str = "department",
) -> pd.DataFrame:
    """Cases by geography (rows) and epidemiological week (columns) for one year."""
    series = weekly_series(parquet_paths, level=level)
    subset = series[series["year"] == year]
    geo = geography_columns(level)
    matrix = subset.pivot_table(
        index=geo,
        columns="epi_week",
        values="cases",
        aggfunc="sum",
        fill_value=0,
    ).sort_index().sort_index(axis=1)
    matrix.columns.name = "epi_week"
    return matrix


def rank_by_rate(
    parquet_paths: Sequence[str | Path],
    population: pd.DataFrame,
    *,
    level: str = "department",
    year: int | None = None,
) -> pd.DataFrame:
    """Rank geographies by cases per 100k inhabitants over the selected period.

    ``population`` must carry ``[department, province, population]``; each row
    is the population of one province, and a department's population is the sum
    of its provinces. ``year`` restricts the case count to one year; ``None``
    uses every year. Geographies without a population row get a ``NaN`` rate
    and no rank.
    """
    series = weekly_series(parquet_paths, level=level)
    if year is not None:
        series = series[series["year"] == year]

    geo = geography_columns(level)
    cases = series.groupby(geo, sort=False)["cases"].sum().reset_index()
    population = _normalize_population(population)

    if level == "department":
        denominator = (
            population.groupby("department", sort=False)["population"]
            .sum()
            .reset_index()
        )
        merged = cases.merge(denominator, on="department", how="left")
    else:
        merged = cases.merge(population, on=["department", "province"], how="left")

    merged["population"] = pd.to_numeric(
        merged["population"], errors="coerce"
    ).fillna(0.0)
    merged["rate_per_100k"] = (
        merged["cases"] / merged["population"].where(merged["population"] > 0)
        * 100_000
    )

    merged = merged.sort_values(
        "rate_per_100k", ascending=False, na_position="last"
    ).reset_index(drop=True)

    valid = merged["rate_per_100k"].notna()
    merged["rank"] = pd.Series(pd.NA, index=merged.index, dtype="Int64")
    merged.loc[valid, "rank"] = list(range(1, int(valid.sum()) + 1))

    ordered = ["rank"] + geo + ["cases", "population", "rate_per_100k"]
    return merged[ordered]


def _normalize_population(population: pd.DataFrame) -> pd.DataFrame:
    missing = set(POPULATION_COLUMNS) - set(population.columns)
    if missing:
        raise ValueError(f"population is missing columns: {sorted(missing)}")
    frame = population[list(POPULATION_COLUMNS)].copy()
    for column in ("department", "province"):
        frame[column] = frame[column].astype("string").str.strip().str.upper()
    frame["population"] = pd.to_numeric(frame["population"], errors="coerce")
    return frame
