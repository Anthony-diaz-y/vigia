"""Robust reading of CSV and XLSX uploads.

The reader never guesses silently: it reports the encoding and delimiter it
used, keeps every value as text so identifiers such as UBIGEO do not lose their
leading zeros, and refuses formats that can execute code.
"""

from __future__ import annotations

import csv
import hashlib
import io
import zipfile
from dataclasses import dataclass
from pathlib import Path

import pandas as pd
from charset_normalizer import from_bytes

from vigia.ingest.errors import EmptyFile, FileTooLarge, UnsupportedFile

MAX_BYTES = 50 * 1024 * 1024
MAX_ROWS = 2_000_000
MAX_COLUMNS = 200

CSV_SUFFIXES = frozenset({".csv", ".txt"})
XLSX_SUFFIXES = frozenset({".xlsx"})
#: Legacy binary and macro-enabled formats cannot be parsed safely.
BLOCKED_SUFFIXES = frozenset({".xls", ".xlsb", ".xlsm", ".ods"})

ENCODING_ORDER = ("utf-8-sig", "utf-8")
DELIMITERS = ",;\t|"


@dataclass(frozen=True)
class RawTable:
    """A parsed upload with every value kept as text."""

    frame: pd.DataFrame
    source_format: str
    encoding: str | None
    delimiter: str | None
    size_bytes: int

    @property
    def rows_in(self) -> int:
        return len(self.frame)


def file_hash(path: Path) -> str:
    """Return the SHA-256 of the file, streamed so large uploads stay cheap."""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_table(path: Path) -> RawTable:
    """Read an upload into a text-only frame, enforcing size and shape budgets."""
    if not path.exists():
        raise FileNotFoundError(path)

    suffix = path.suffix.lower()
    if suffix in BLOCKED_SUFFIXES:
        raise UnsupportedFile(f"unsupported format: {suffix}")
    if suffix not in CSV_SUFFIXES and suffix not in XLSX_SUFFIXES:
        raise UnsupportedFile(f"unsupported format: {suffix or '<no extension>'}")

    size_bytes = path.stat().st_size
    if size_bytes > MAX_BYTES:
        raise FileTooLarge("file exceeds size budget", MAX_BYTES, size_bytes)

    if suffix in CSV_SUFFIXES:
        frame, encoding, delimiter = _read_csv(path)
        source_format = "csv"
    else:
        frame, encoding, delimiter = _read_xlsx(path), None, None
        source_format = "xlsx"

    frame = _clean_headers(frame, source_format)

    if frame.shape[1] > MAX_COLUMNS:
        raise FileTooLarge("file exceeds column budget", MAX_COLUMNS, frame.shape[1])
    if len(frame) > MAX_ROWS:
        raise FileTooLarge("file exceeds row budget", MAX_ROWS, len(frame))
    if frame.empty:
        raise EmptyFile("the upload has no data rows")

    return RawTable(
        frame=frame,
        source_format=source_format,
        encoding=encoding,
        delimiter=delimiter,
        size_bytes=size_bytes,
    )


def _read_csv(path: Path) -> tuple[pd.DataFrame, str, str]:
    data = path.read_bytes()
    text, encoding = _decode(data)
    delimiter = _sniff_delimiter(text)
    try:
        frame = pd.read_csv(
            io.StringIO(text),
            sep=delimiter,
            dtype=str,
            keep_default_na=False,
            na_values=[""],
            skipinitialspace=True,
            engine="c",
        )
    except pd.errors.ParserError as exc:  # malformed quotes or ragged rows
        raise UnsupportedFile(f"malformed csv: {exc}") from exc
    return frame, encoding, delimiter


def _decode(data: bytes) -> tuple[str, str]:
    for encoding in ENCODING_ORDER:
        try:
            return data.decode(encoding), encoding
        except UnicodeDecodeError:
            continue
    match = from_bytes(data).best()
    if match is not None:
        return str(match), match.encoding or "unknown"
    return data.decode("cp1252", errors="replace"), "cp1252"


def _sniff_delimiter(text: str) -> str:
    sample = text[:8192]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=DELIMITERS)
        return dialect.delimiter
    except csv.Error:
        return ","


def _read_xlsx(path: Path) -> pd.DataFrame:
    if _has_macros(path):
        raise UnsupportedFile("macro-enabled workbook rejected")
    try:
        frame = pd.read_excel(
            path,
            dtype=str,
            keep_default_na=False,
            na_values=[""],
            engine="openpyxl",
        )
    except Exception as exc:  # openpyxl raises several unrelated error types
        raise UnsupportedFile(f"unreadable workbook: {exc}") from exc
    return frame


def _has_macros(path: Path) -> bool:
    try:
        with zipfile.ZipFile(path) as archive:
            return any("vbaProject.bin" in name for name in archive.namelist())
    except zipfile.BadZipFile:
        return False


def _clean_headers(frame: pd.DataFrame, source_format: str) -> pd.DataFrame:
    """Strip header whitespace and make duplicate header names addressable."""
    cleaned = [str(name).strip() for name in frame.columns]
    seen: dict[str, int] = {}
    unique: list[str] = []
    for name in cleaned:
        if name in seen:
            seen[name] += 1
            unique.append(f"{name}__{seen[name]}")
        else:
            seen[name] = 0
            unique.append(name)
    frame = frame.copy()
    frame.columns = unique
    return frame
