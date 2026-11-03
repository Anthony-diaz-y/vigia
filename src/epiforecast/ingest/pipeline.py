"""Ingestion pipeline: upload in, canonical Parquet plus quality report out.

The pipeline is idempotent by file hash: the same bytes always produce the same
output paths, so a retried job never duplicates data.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from epiforecast.ingest.errors import MissingRequiredColumns
from epiforecast.ingest.mapping import (
    MappingResult,
    SourceConfig,
    detect_pii,
    load_source_config,
    resolve_mapping,
)
from epiforecast.ingest.normalize import NormalizedTable, normalize
from epiforecast.ingest.quality import QualityReport
from epiforecast.ingest.readers import RawTable, file_hash, read_table

DEFAULT_SOURCE = "minsa_dengue"


@dataclass(frozen=True)
class IngestResult:
    """Everything the API needs to answer an upload request."""

    file_hash: str
    status: str
    rows_in: int
    rows_valid: int
    rows_dropped: int
    duplicates_collapsed: int
    mapping: dict[str, str]
    unmapped_columns: list[str]
    normalized_path: Path
    quality_path: Path
    quality: QualityReport
    source_config: SourceConfig = field(repr=False, default=None)  # type: ignore[assignment]


def ingest_file(
    path: Path,
    *,
    out_dir: Path,
    source: str = DEFAULT_SOURCE,
    mapping_override: dict[str, str] | None = None,
) -> IngestResult:
    """Validate one upload and materialize the canonical dataset."""
    path = Path(path)
    out_dir = Path(out_dir)

    digest = file_hash(path)
    config = load_source_config(source)
    table = read_table(path)

    detect_pii(list(table.frame.columns), config)

    mapping = _resolve(table, config, mapping_override)

    normalized = normalize(table.frame, mapping, config)
    report = _report(table, mapping, normalized)

    dataset_dir = out_dir / digest[:16]
    dataset_dir.mkdir(parents=True, exist_ok=True)
    normalized_path = dataset_dir / "normalized.parquet"
    quality_path = dataset_dir / "quality.json"

    normalized.frame.to_parquet(normalized_path, index=False)
    quality_path.write_text(
        json.dumps(_quality_payload(report, digest), indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    return IngestResult(
        file_hash=digest,
        status="ok" if not report.issues else "ok_with_issues",
        rows_in=report.rows_in,
        rows_valid=report.rows_valid,
        rows_dropped=report.rows_dropped,
        duplicates_collapsed=report.duplicates_collapsed,
        mapping=dict(mapping.mapping),
        unmapped_columns=list(mapping.unmapped_columns),
        normalized_path=normalized_path,
        quality_path=quality_path,
        quality=report,
        source_config=config,
    )


def _resolve(
    table: RawTable, config: SourceConfig, mapping_override: dict[str, str] | None
) -> MappingResult:
    mapping = resolve_mapping(list(table.frame.columns), config)
    if mapping_override:
        merged = dict(mapping.mapping)
        merged.update(
            {
                canonical: source_column
                for canonical, source_column in mapping_override.items()
                if source_column in table.frame.columns
            }
        )
        missing = [column for column in config.required if column not in merged]
        mapping = MappingResult(
            mapping=merged,
            unmapped_columns=[
                name for name in table.frame.columns if name not in set(merged.values())
            ],
            missing_required=missing,
        )
    if mapping.missing_required:
        raise MissingRequiredColumns(
            missing=mapping.missing_required,
            available=list(table.frame.columns),
        )
    return mapping


def _report(
    table: RawTable, mapping: MappingResult, normalized: NormalizedTable
) -> QualityReport:
    return QualityReport(
        rows_in=table.rows_in,
        rows_valid=len(normalized.frame),
        rows_dropped=normalized.rows_dropped,
        duplicates_collapsed=normalized.duplicates_collapsed,
        mapped_columns=dict(mapping.mapping),
        unmapped_columns=list(mapping.unmapped_columns),
        issues=normalized.issues,
        source_format=table.source_format,
        encoding=table.encoding,
        delimiter=table.delimiter,
    )


def _quality_payload(report: QualityReport, digest: str) -> dict[str, Any]:
    payload = report.to_dict()
    payload["file_hash"] = digest
    return payload
