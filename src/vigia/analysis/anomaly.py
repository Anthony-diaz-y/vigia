"""Anomaly flags from a robust z-score on the seasonally adjusted residual."""

from __future__ import annotations

from pathlib import Path
from typing import Sequence

import pandas as pd

from vigia.analysis.engine import geography_columns
from vigia.analysis.series import weekly_series

#: Modified z-score cutoff (Iglewicz & Hoaglin) above which a week is flagged.
DEFAULT_THRESHOLD = 3.5
#: Factor that maps MAD onto a standard-deviation equivalent for normal data.
MAD_SCALE = 0.6745


def anomalies(
    parquet_paths: Sequence[str | Path],
    *,
    level: str = "department",
    threshold: float = DEFAULT_THRESHOLD,
) -> pd.DataFrame:
    """Flag weeks whose seasonally adjusted residual is far from the norm.

    The seasonal baseline of an epidemiological week is the median of that
    week's cases across years for the same geography. The residual is
    ``cases - baseline``. A week is flagged when its modified z-score,
    ``0.6745 * (residual - median_residual) / MAD``, exceeds ``threshold`` in
    absolute value, with the median and MAD taken over the geography's own
    residuals. A geography with zero dispersion (MAD == 0) flags nothing.
    """
    series = weekly_series(parquet_paths, level=level)
    geo = geography_columns(level)

    series["seasonal_baseline"] = series.groupby(geo + ["epi_week"])[
        "cases"
    ].transform("median")
    series["residual"] = series["cases"] - series["seasonal_baseline"]

    center = series.groupby(geo)["residual"].transform("median")
    mad = series.groupby(geo)["residual"].transform(
        lambda values: (values - values.median()).abs().median()
    )

    series["robust_z"] = (
        MAD_SCALE * (series["residual"] - center) / mad
    ).where(mad != 0, 0.0)
    series["is_anomaly"] = series["robust_z"].abs() > threshold

    columns = geo + [
        "year",
        "epi_week",
        "cases",
        "seasonal_baseline",
        "residual",
        "robust_z",
        "is_anomaly",
    ]
    return series[columns].reset_index(drop=True)
