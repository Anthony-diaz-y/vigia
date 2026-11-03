"""DuckDB query engine over tenant Parquet.

M2 reads one or more normalized M1 Parquet files through a single DuckDB
connection. DuckDB owns the aggregation; pandas only shapes the result into the
figures the analysis layer exposes.
"""

from __future__ import annotations

from pathlib import Path
from typing import Sequence

import duckdb

GEO_LEVELS = ("department", "province")

#: Canonical columns the analysis layer reads from the M1 Parquet.
SOURCE_COLUMNS = ("department", "province", "year", "epi_week", "cases")


def open_tenant(parquet_paths: Sequence[str | Path]) -> duckdb.DuckDBPyConnection:
    """Open DuckDB with a ``tenant`` view over the union of the given Parquet files."""
    paths = [str(Path(p).resolve()) for p in parquet_paths]
    if not paths:
        raise ValueError("at least one normalized Parquet path is required")
    connection = duckdb.connect()
    relation = connection.sql("SELECT * FROM read_parquet(?)", params=[paths])
    connection.register("tenant", relation)
    return connection


def geography_columns(level: str) -> list[str]:
    """Return the identifying columns for a granularity level."""
    if level == "department":
        return ["department"]
    if level == "province":
        return ["department", "province"]
    raise ValueError(f"level must be one of {GEO_LEVELS}, got {level!r}")
