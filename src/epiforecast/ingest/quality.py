"""Quality report produced for every upload.

The report is the user-facing explanation of what happened to their file: how
many rows were read, how many survived, and exactly why the rest did not.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

MAX_SAMPLES = 3


@dataclass(frozen=True)
class QualityIssue:
    """One class of problem found in the upload."""

    code: str
    message: str
    count: int
    sample: list[str]

    def to_dict(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "message": self.message,
            "count": self.count,
            "sample": self.sample,
        }


class IssueCollector:
    """Accumulates issues by code, keeping a bounded sample of offending values."""

    def __init__(self) -> None:
        self._codes: dict[str, str] = {}
        self._counts: dict[str, int] = {}
        self._samples: dict[str, list[str]] = {}

    def add(self, code: str, message: str, values: list[str] | None = None, count: int = 1) -> None:
        self._codes[code] = message
        self._counts[code] = self._counts.get(code, 0) + count
        bucket = self._samples.setdefault(code, [])
        for value in values or []:
            if len(bucket) >= MAX_SAMPLES:
                break
            text = "" if value is None else str(value)
            if text not in bucket:
                bucket.append(text)

    def add_many(self, code: str, message: str, values: list[str]) -> None:
        if not values:
            return
        self.add(code, message, values=values, count=len(values))

    def build(self) -> list[QualityIssue]:
        return [
            QualityIssue(
                code=code,
                message=self._codes[code],
                count=self._counts[code],
                sample=self._samples.get(code, []),
            )
            for code in self._codes
        ]


@dataclass
class QualityReport:
    """Outcome of validating one upload against the canonical contract."""

    rows_in: int
    rows_valid: int
    rows_dropped: int
    duplicates_collapsed: int
    mapped_columns: dict[str, str] = field(default_factory=dict)
    unmapped_columns: list[str] = field(default_factory=list)
    issues: list[QualityIssue] = field(default_factory=list)
    source_format: str = "csv"
    encoding: str | None = None
    delimiter: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "rows_in": self.rows_in,
            "rows_valid": self.rows_valid,
            "rows_dropped": self.rows_dropped,
            "duplicates_collapsed": self.duplicates_collapsed,
            "mapped_columns": self.mapped_columns,
            "unmapped_columns": self.unmapped_columns,
            "issues": [issue.to_dict() for issue in self.issues],
            "source_format": self.source_format,
            "encoding": self.encoding,
            "delimiter": self.delimiter,
        }
