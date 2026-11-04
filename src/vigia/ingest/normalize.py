"""Normalization: source columns to the canonical contract, plus validation.

Validation is mask-based and vectorized so a multi-million-row upload is checked
without a per-row Python loop. Every dropped row is attributed to exactly one
issue class, which is what the quality report shows the user.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from vigia.ingest.contract import (
    AGE_BANDS,
    CANONICAL_COLUMNS,
    KEY_COLUMNS,
    MAX_EPI_WEEK,
    MAX_YEAR,
    MIN_EPI_WEEK,
    MIN_YEAR,
    SEX_VALUES,
    UBIGEO_LENGTH,
    UNKNOWN,
)
from vigia.ingest.mapping import MappingResult, SourceConfig
from vigia.ingest.quality import IssueCollector, QualityIssue

STRING_COLUMNS = (
    "disease",
    "ubigeo",
    "department",
    "province",
    "district",
    "directorate",
    "sex",
    "age_group",
    "age_type",
    "diagnosis",
    "diagnosis_type",
)


@dataclass
class NormalizedTable:
    """A canonical, deduplicated table plus the issues found on the way."""

    frame: pd.DataFrame
    rows_dropped: int
    duplicates_collapsed: int
    issues: list[QualityIssue] = field(default_factory=list)


def normalize(raw: pd.DataFrame, mapping: MappingResult, config: SourceConfig) -> NormalizedTable:
    """Coerce a raw upload into the canonical contract."""
    issues = IssueCollector()

    index = raw.index
    ubigeo, ubigeo_missing, ubigeo_invalid = _ubigeo(
        _column(raw, mapping, "ubigeo"), index
    )
    year, year_unparseable, year_out_of_range = _bounded_int(
        _column(raw, mapping, "year"), MIN_YEAR, MAX_YEAR, index
    )
    week, week_unparseable, week_out_of_range = _bounded_int(
        _column(raw, mapping, "epi_week"), MIN_EPI_WEEK, MAX_EPI_WEEK, index
    )
    cases, cases_missing, cases_invalid, cases_negative = _cases(
        _column(raw, mapping, "cases"), index, count_rows=config.count_rows
    )

    issues.add_many("missing_ubigeo", "Row has no UBIGEO.", _values(_column(raw, mapping, "ubigeo"), ubigeo_missing))
    issues.add_many("invalid_ubigeo", "UBIGEO is not a 6-digit code.", _values(_column(raw, mapping, "ubigeo"), ubigeo_invalid))
    issues.add_many("invalid_year", "Year could not be read as a number.", _values(_column(raw, mapping, "year"), year_unparseable))
    issues.add_many("year_out_of_range", f"Year is outside {MIN_YEAR}-{MAX_YEAR}.", _values(_column(raw, mapping, "year"), year_out_of_range))
    issues.add_many("invalid_epi_week", "Epidemiological week could not be read as a number.", _values(_column(raw, mapping, "epi_week"), week_unparseable))
    issues.add_many("epi_week_out_of_range", f"Epidemiological week is outside {MIN_EPI_WEEK}-{MAX_EPI_WEEK}.", _values(_column(raw, mapping, "epi_week"), week_out_of_range))
    issues.add_many("missing_cases", "Row has no case count.", _values(_column(raw, mapping, "cases"), cases_missing))
    issues.add_many("invalid_cases", "Case count is not a number.", _values(_column(raw, mapping, "cases"), cases_invalid))
    issues.add_many("negative_cases", "Case count is negative.", _values(_column(raw, mapping, "cases"), cases_negative))

    frame = _assemble(raw, mapping, config, ubigeo, year, week, cases, issues)
    valid_mask = ~(
        ubigeo_missing
        | ubigeo_invalid
        | year_unparseable
        | year_out_of_range
        | week_unparseable
        | week_out_of_range
        | cases_missing
        | cases_invalid
        | cases_negative
    )

    rows_dropped = int((~valid_mask).sum())
    frame = frame.loc[valid_mask]

    deduplicated, collapsed = _deduplicate(frame)
    deduplicated["year"] = deduplicated["year"].astype("int64")
    deduplicated["epi_week"] = deduplicated["epi_week"].astype("int64")
    deduplicated["cases"] = deduplicated["cases"].astype("int64")
    for column in STRING_COLUMNS:
        deduplicated[column] = deduplicated[column].astype(object)

    return NormalizedTable(
        frame=deduplicated[list(CANONICAL_COLUMNS)],
        rows_dropped=rows_dropped,
        duplicates_collapsed=collapsed,
        issues=issues.build(),
    )


def _column(raw: pd.DataFrame, mapping: MappingResult, canonical: str) -> pd.Series | None:
    source = mapping.mapping.get(canonical)
    if source is None:
        return None
    return raw[source]


def _text(series: pd.Series | None, index: pd.Index) -> pd.Series:
    """Return a plain-object text column with empty strings instead of nulls."""
    if series is None:
        return pd.Series("", index=index, dtype=object)
    as_string = series.astype("string").str.strip().fillna("")
    return as_string.astype(object)


def _numeric(series: pd.Series) -> pd.Series:
    text = series.astype("string").str.strip().fillna("")
    text = text.str.replace(r"\.0+$", "", regex=True)
    return pd.to_numeric(text.replace("", pd.NA), errors="coerce")


def _values(series: pd.Series | None, mask: pd.Series) -> list[str]:
    if series is None:
        return []
    return [str(value) for value in series.loc[mask].tolist()]


def _ubigeo(series: pd.Series | None, index: pd.Index) -> tuple[pd.Series, pd.Series, pd.Series]:
    if series is None:
        empty = pd.Series("", index=index, dtype=object)
        missing = pd.Series(True, index=index)
        return empty, missing, pd.Series(False, index=index)
    text = _text(series, index)
    stripped = text.str.replace(r"\.0+$", "", regex=True)
    missing = stripped.eq("")
    digits = stripped.str.fullmatch(r"\d+").fillna(False)
    fits = stripped.str.len().le(UBIGEO_LENGTH)
    usable = digits & fits
    padded = stripped.str.zfill(UBIGEO_LENGTH).where(usable, "")
    invalid = ~missing & ~usable
    return padded, missing, invalid


def _bounded_int(
    series: pd.Series | None, low: int, high: int, index: pd.Index
) -> tuple[pd.Series, pd.Series, pd.Series]:
    if series is None:
        empty = pd.Series(pd.NA, index=index, dtype="Float64")
        return empty, pd.Series(False, index=index), pd.Series(False, index=index)
    numbers = _numeric(_text(series, index))
    whole = numbers.where(numbers.notna() & (numbers % 1 == 0))
    unparseable = whole.isna()
    out_of_range = whole.notna() & ~whole.between(low, high)
    return whole, unparseable, out_of_range


def _cases(
    series: pd.Series | None, index: pd.Index, *, count_rows: bool
) -> tuple[pd.Series, pd.Series, pd.Series, pd.Series]:
    if count_rows or series is None:
        ones = pd.Series(1.0, index=index)
        false = pd.Series(False, index=index)
        return ones, false, false, false
    text = _text(series, index)
    numbers = _numeric(text)
    missing = text.eq("")
    invalid = ~missing & numbers.isna()
    negative = numbers.notna() & (numbers < 0)
    return numbers, missing, invalid, negative


def _assemble(
    raw: pd.DataFrame,
    mapping: MappingResult,
    config: SourceConfig,
    ubigeo: pd.Series,
    year: pd.Series,
    week: pd.Series,
    cases: pd.Series,
    issues: IssueCollector,
) -> pd.DataFrame:
    index = raw.index
    frame = pd.DataFrame(index=index)

    source_disease = _column(raw, mapping, "disease")
    if source_disease is None:
        frame["disease"] = config.disease
    else:
        values = _text(source_disease, index).str.upper()
        mismatched = values.ne("") & values.ne(config.disease)
        issues.add_many(
            "disease_mismatch",
            f"Row declares a disease other than {config.disease}.",
            _text(source_disease, index).loc[mismatched].tolist(),
        )
        frame["disease"] = values.where(~mismatched, config.disease)
        frame.loc[values.eq(""), "disease"] = config.disease

    frame["ubigeo"] = ubigeo
    frame["year"] = year
    frame["epi_week"] = week

    for column, canonical in (
        ("department", "department"),
        ("province", "province"),
        ("district", "district"),
        ("directorate", "directorate"),
        ("diagnosis", "diagnosis"),
        ("diagnosis_type", "diagnosis_type"),
    ):
        frame[canonical] = _text(_column(raw, mapping, column), index).str.upper()

    frame["sex"] = _sex(_text(_column(raw, mapping, "sex"), index))
    frame["age_type"] = _text(_column(raw, mapping, "age_type"), index).str.upper()
    frame["age_group"] = _age_group(
        _text(_column(raw, mapping, "age_group"), index), frame["age_type"]
    )
    frame["cases"] = cases
    return frame


def _sex(text: pd.Series) -> pd.Series:
    mapped = text.str.upper().map(SEX_VALUES)
    return mapped.fillna(UNKNOWN).astype(object)


def _age_group(age: pd.Series, age_type: pd.Series) -> pd.Series:
    years = _numeric(age).astype("float64")
    months = age_type.str.contains("MES", na=False)
    conditions = [years.between(low, high) for low, high, _ in AGE_BANDS]
    labels = [label for _, _, label in AGE_BANDS]
    banded = pd.Series(
        np.select(conditions, labels, default=UNKNOWN), index=age.index, dtype=object
    )
    banded = banded.mask(months | years.eq(0), "<1")
    return banded.fillna(UNKNOWN).astype(object)


def _deduplicate(frame: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    if frame.empty:
        return frame.assign(cases=pd.Series(dtype="float64")), 0
    keys = list(KEY_COLUMNS)
    grouped = (
        frame.groupby(keys, dropna=False, as_index=False, sort=False)["cases"]
        .sum()
    )
    collapsed = int(len(frame) - len(grouped))
    ordered = grouped[[column for column in CANONICAL_COLUMNS]]
    return ordered, collapsed
