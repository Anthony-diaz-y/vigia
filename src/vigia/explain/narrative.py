"""Narrative over an aggregated payload, with a deterministic template fallback.

The LLM (DeepSeek) writes prose only, never decisions: the driver ranking and
the preventive actions come from the deterministic modules. The payload sent to
the API is aggregated (unit name plus driver summary) and never contains
patient or row-level data.
"""

from __future__ import annotations

import json
import os
import urllib.request
from dataclasses import dataclass

DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"
DEEPSEEK_API_KEY_ENV = "DEEPSEEK_API_KEY"

_SYSTEM_PROMPT = (
    "You summarize a public-health forecast in plain language. "
    "Never make clinical recommendations or decide actions; only summarize "
    "the provided drivers and actions."
)


@dataclass(frozen=True)
class NarrativeResult:
    source: str  # "template" | "deepseek"
    text: str


def render_template(payload: dict) -> str:
    """Deterministic prose from the aggregated payload."""
    unit = payload["unit"]
    drivers = payload["drivers"]
    top = ", ".join(f"{d['feature']} ({d['direction']})" for d in drivers)
    actions = "; ".join(d["action"] for d in drivers if d.get("action"))
    return (
        f"For {unit}, the forecast is driven mainly by: {top}. "
        f"Recommended preventive actions: {actions}."
    )


def deepseek_narrative(payload: dict) -> str | None:
    """Call DeepSeek over the aggregated payload; return ``None`` when unavailable."""
    key = os.environ.get(DEEPSEEK_API_KEY_ENV)
    if not key:
        return None

    body = json.dumps(
        {
            "model": "deepseek-chat",
            "messages": [
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": json.dumps(payload)},
            ],
            "temperature": 0.0,
        }
    ).encode("utf-8")

    request = urllib.request.Request(
        DEEPSEEK_URL,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {key}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            data = json.loads(response.read().decode("utf-8"))
        return data["choices"][0]["message"]["content"]
    except Exception:
        return None


def narrative(payload: dict) -> NarrativeResult:
    """Prefer DeepSeek, fall back to the deterministic template."""
    prose = deepseek_narrative(payload)
    if prose is None:
        return NarrativeResult(source="template", text=render_template(payload))
    return NarrativeResult(source="deepseek", text=prose)
