"""Errors raised by the ingestion contract.

Every error carries structured detail so the API layer can answer with a
machine-readable rejection instead of a bare 500.
"""

from __future__ import annotations


class IngestError(Exception):
    """Base class for a rejected or unprocessable upload."""


class UnsupportedFile(IngestError):
    """The file format is not accepted (legacy formats, macro-enabled workbooks)."""

    def __init__(self, reason: str) -> None:
        self.reason = reason
        super().__init__(reason)


class FileTooLarge(IngestError):
    """The upload exceeds the configured size, row or column budget."""

    def __init__(self, reason: str, limit: int, actual: int) -> None:
        self.reason = reason
        self.limit = limit
        self.actual = actual
        super().__init__(f"{reason}: limit={limit} actual={actual}")


class EmptyFile(IngestError):
    """The file has no data rows."""


class PiiDetected(IngestError):
    """Personal-data columns were detected; the upload is refused before storage."""

    def __init__(self, columns: list[str]) -> None:
        self.columns = columns
        super().__init__(
            "Upload contains personal-data columns and was rejected: "
            + ", ".join(columns)
        )


class MissingRequiredColumns(IngestError):
    """Required canonical columns could not be resolved from the source headers."""

    def __init__(self, missing: list[str], available: list[str]) -> None:
        self.missing = missing
        self.available = available
        super().__init__(
            "Missing required columns: "
            + ", ".join(missing)
            + ". Available: "
            + ", ".join(available)
        )


class SourceConfigError(IngestError):
    """The per-source mapping configuration is missing or malformed."""
