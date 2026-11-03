"""Canonical data contract shared by every ingestion source.

An upload is expected to be an aggregate of notified cases keyed by geography,
epidemiological week and case classification. Nominal patient records are out of
contract and are rejected upstream.
"""

from __future__ import annotations

from datetime import date

# Ordered canonical columns of the normalized table.
CANONICAL_COLUMNS: tuple[str, ...] = (
    "disease",
    "ubigeo",
    "year",
    "epi_week",
    "department",
    "province",
    "district",
    "directorate",
    "sex",
    "age_group",
    "age_type",
    "diagnosis",
    "diagnosis_type",
    "cases",
)

# Columns that take part in the natural key used for deduplication.
KEY_COLUMNS: tuple[str, ...] = tuple(c for c in CANONICAL_COLUMNS if c != "cases")

# Any column not in this set is reported as unmapped instead of being dropped
# silently.
OPTIONAL_COLUMNS: frozenset[str] = frozenset(
    {
        "department",
        "province",
        "district",
        "directorate",
        "sex",
        "age_group",
        "age_type",
        "diagnosis",
        "diagnosis_type",
    }
)

MIN_YEAR = 2000
#: Surveillance files are published for closed epidemiological weeks, so a year
#: ahead of the current one is already suspicious.
MAX_YEAR = date.today().year + 1
MIN_EPI_WEEK = 1
MAX_EPI_WEEK = 53

UBIGEO_LENGTH = 6

#: Coarse age bands used for grouping when the source exposes a numeric age.
AGE_BANDS: tuple[tuple[int, int, str], ...] = (
    (0, 0, "<1"),
    (1, 4, "1-4"),
    (5, 9, "5-9"),
    (10, 19, "10-19"),
    (20, 29, "20-29"),
    (30, 59, "30-59"),
    (60, 200, "60+"),
)

SEX_VALUES: dict[str, str] = {
    "F": "F",
    "FEMENINO": "F",
    "MUJER": "F",
    "M": "M",
    "MASCULINO": "M",
    "HOMBRE": "M",
}

UNKNOWN = "unknown"
