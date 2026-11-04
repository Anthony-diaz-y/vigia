"""Column mapping: source headers to canonical columns.

Resolution is two-pass and deterministic: exact alias match on normalized
headers first, then a fuzzy fallback for real-world exports whose headers were
renamed, pluralized or abbreviated by hand.
"""

from __future__ import annotations

import unicodedata
from dataclasses import dataclass, field
from pathlib import Path

import yaml
from rapidfuzz import fuzz, process

from vigia.ingest.contract import CANONICAL_COLUMNS
from vigia.ingest.errors import PiiDetected, SourceConfigError

FUZZY_THRESHOLD = 85.0


@dataclass(frozen=True)
class SourceConfig:
    """Declarative mapping for one data source."""

    source: str
    disease: str
    count_rows: bool
    columns: dict[str, list[str]]
    required: list[str]
    pii_aliases: list[str]


@dataclass(frozen=True)
class MappingResult:
    mapping: dict[str, str]
    unmapped_columns: list[str]
    missing_required: list[str] = field(default_factory=list)

    @property
    def resolved(self) -> bool:
        return not self.missing_required


def normalize_header(name: str) -> str:
    """Fold a header to a comparable key: no case, accents or punctuation."""
    decomposed = unicodedata.normalize("NFKD", str(name))
    stripped = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    lowered = stripped.strip().lower()
    collapsed = "".join(ch if ch.isalnum() else "_" for ch in lowered)
    return "_".join(part for part in collapsed.split("_") if part)


def config_dir() -> Path:
    """Locate ``config/mappings`` by walking up from this module."""
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "config" / "mappings"
        if candidate.is_dir():
            return candidate
    raise SourceConfigError("config/mappings directory not found")


def load_source_config(source: str) -> SourceConfig:
    path = config_dir() / f"{source}.yaml"
    if not path.exists():
        raise SourceConfigError(f"unknown source mapping: {source}")
    payload = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    try:
        return SourceConfig(
            source=payload["source"],
            disease=str(payload["disease"]).upper(),
            count_rows=bool(payload.get("count_rows", False)),
            columns={k: [normalize_header(a) for a in v] for k, v in payload["columns"].items()},
            required=list(payload.get("required", ["ubigeo", "year", "epi_week"])),
            pii_aliases=[normalize_header(a) for a in payload.get("pii_aliases", [])],
        )
    except KeyError as exc:
        raise SourceConfigError(f"invalid source mapping {source}: {exc}") from exc


def find_pii(columns: list[str], config: SourceConfig) -> list[str]:
    """Return the headers that look like personal data, without raising."""
    blocked = set(config.pii_aliases)
    return [name for name in columns if normalize_header(name) in blocked]


def detect_pii(columns: list[str], config: SourceConfig) -> None:
    """Reject the upload when any header looks like personal data."""
    hits = find_pii(columns, config)
    if hits:
        raise PiiDetected(hits)


def resolve_mapping(columns: list[str], config: SourceConfig) -> MappingResult:
    """Map canonical columns to source headers using aliases, then fuzzy match."""
    by_key = {normalize_header(name): name for name in columns}
    mapping: dict[str, str] = {}
    used: set[str] = set()

    for canonical in CANONICAL_COLUMNS:
        aliases = config.columns.get(canonical, [])
        if not aliases:
            continue
        for alias in aliases:
            source = by_key.get(alias)
            if source is not None and source not in used:
                mapping[canonical] = source
                used.add(source)
                break

    for canonical in CANONICAL_COLUMNS:
        if canonical in mapping:
            continue
        aliases = config.columns.get(canonical, [])
        if not aliases:
            continue
        candidates = {key: name for key, name in by_key.items() if name not in used}
        if not candidates:
            continue
        best = process.extractOne(
            query=max(aliases, key=len),
            choices=list(candidates.keys()),
            scorer=fuzz.WRatio,
            score_cutoff=FUZZY_THRESHOLD,
        )
        if best is not None:
            matched_key, _score, _index = best
            source = candidates[matched_key]
            mapping[canonical] = source
            used.add(source)

    unmapped = [name for name in columns if name not in used]
    missing = [column for column in config.required if column not in mapping]
    return MappingResult(
        mapping=mapping, unmapped_columns=unmapped, missing_required=missing
    )
