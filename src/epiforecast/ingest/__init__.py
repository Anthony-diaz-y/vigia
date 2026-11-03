"""Ingestion package: readers, column mapping, normalization and quality checks."""

from epiforecast.ingest.pipeline import IngestResult, ingest_file

__all__ = ["IngestResult", "ingest_file"]
