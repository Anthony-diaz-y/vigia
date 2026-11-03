"""Weekly series and interannual comparison, built from the M1 Parquet."""

from __future__ import annotations

from pathlib import Path
from typing import Sequence

import pandas as pd

from vigia.analysis.engine import geography_columns, open_tenant


def weekly_series(
    parquet_paths: Sequence[str | Path], *, level: str = "department"
) -> pd.DataFrame:
    """Aggregate cases per geography, year and epidemiological week.

    ``level="department"`` returns columns ``[department, year, epi_week,
    cases]``. ``level="province"`` returns ``[department, province, year,
    epi_week, cases]``. Rows are ordered by geography, then year, then week.
    """
    geo = geography_columns(level)
    select = ", ".join(geo)
    connection = open_tenant(parquet_paths)
    try:
        return connection.execute(
            f"""
            SELECT {select}, year, epi_week,
                   CAST(SUM(cases) AS BIGINT) AS cases
            FROM tenant
            GROUP BY {select}, year, epi_week
            ORDER BY {select}, year, epi_week
            """
        ).df()
    finally:
        connection.close()


def interannual_comparison(
    parquet_paths: Sequence[str | Path],
    *,
    level: str = "department",
    geography: str | None = None,
) -> pd.DataFrame:
    """Cases per epidemiological week, one column per year.

    Rows are epidemiological weeks (ascending) and columns are years
    (ascending). When ``geography`` is given it keeps one department (level
    ``"department"``) or one province name (level ``"province"``); otherwise
    every unit at that level is summed.
    """
    series = weekly_series(parquet_paths, level=level)
    if geography is not None:
        series = _keep_geography(series, level, geography)
    pivot = (
        series.groupby(["epi_week", "year"], sort=True)["cases"]
        .sum()
        .unstack("year")
    )
    pivot.index.name = "epi_week"
    pivot.columns.name = "year"
    return pivot.reindex(columns=sorted(pivot.columns))


def _keep_geography(series: pd.DataFrame, level: str, geography: str) -> pd.DataFrame:
    key = geography_columns(level)[-1]
    normalized = str(geography).strip().upper()
    return series[series[key] == normalized]
