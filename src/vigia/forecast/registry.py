"""Versioned model registry: artifact, data cut, config and metrics.

The registry is idempotent: the model id is a hash of the config and the data
cut, so the same inputs always produce the same versioned directory.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pandas as pd


def file_sha256(path: Path) -> str:
    """SHA-256 of a file, streamed so large inputs stay cheap."""
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def model_id(config: dict[str, object], data_cut: dict[str, object]) -> str:
    """Deterministic identifier from the canonical config and data cut."""
    canonical = json.dumps(
        {"config": config, "data_cut": data_cut}, sort_keys=True, default=str
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:16]


class ModelRegistry:
    """Writes one versioned forecast artifact under ``<out_dir>/<model_id>/``."""

    def __init__(self, out_dir: str | Path) -> None:
        self.out_dir = Path(out_dir)

    def write(
        self,
        identifier: str,
        *,
        config: dict[str, object],
        data_cut: dict[str, object],
        scorecard: pd.DataFrame,
        forecasts: pd.DataFrame,
    ) -> Path:
        directory = self.out_dir / identifier
        directory.mkdir(parents=True, exist_ok=True)

        (directory / "config.json").write_text(
            json.dumps(config, indent=2), encoding="utf-8"
        )
        (directory / "data_cut.json").write_text(
            json.dumps(data_cut, indent=2), encoding="utf-8"
        )
        (directory / "scorecard.json").write_text(
            scorecard.to_json(orient="records", indent=2), encoding="utf-8"
        )
        forecasts.to_parquet(directory / "forecast.parquet", index=False)
        return directory
