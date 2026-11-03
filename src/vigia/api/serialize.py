"""DataFrame-to-JSON helpers that turn NaN into ``null`` correctly."""

from __future__ import annotations

import json

import pandas as pd


def to_jsonable(frame: pd.DataFrame, orient: str = "records"):
    """Serialize a DataFrame to plain Python via pandas' JSON writer."""
    return json.loads(frame.to_json(orient=orient))
