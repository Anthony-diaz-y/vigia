"""Runtime configuration for the API layer."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

#: Fixed, non-negotiable disclaimer shown on every surface.
DISCLAIMER = (
    "Decision-support tool, not a medical device. It does not replace the "
    "health authority."
)

DEFAULT_ACCESS_TOKEN = "vigia-dev"


@dataclass(frozen=True)
class Settings:
    data_dir: Path
    access_token: str
    database_url: str

    @classmethod
    def from_env(cls) -> "Settings":
        data = Path(os.environ.get("VIGIA_DATA_DIR", Path.cwd() / "data"))
        data.mkdir(parents=True, exist_ok=True)
        return cls(
            data_dir=data,
            access_token=os.environ.get("VIGIA_ACCESS_TOKEN", DEFAULT_ACCESS_TOKEN),
            database_url=f"sqlite:///{data / 'vigia.db'}",
        )

    @property
    def uploads_dir(self) -> Path:
        directory = self.data_dir / "uploads"
        directory.mkdir(parents=True, exist_ok=True)
        return directory

    @property
    def raw_dir(self) -> Path:
        directory = self.data_dir / "raw"
        directory.mkdir(parents=True, exist_ok=True)
        return directory

    @property
    def registry_dir(self) -> Path:
        directory = self.data_dir / "registry"
        directory.mkdir(parents=True, exist_ok=True)
        return directory
