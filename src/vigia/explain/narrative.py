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
    "Resumí en español, en lenguaje claro, un pronóstico de salud pública. "
    "Nunca hagas recomendaciones clínicas ni decidas acciones; solo resumí "
    "los impulsores y las acciones provistas."
)


@dataclass(frozen=True)
class NarrativeResult:
    source: str  # "template" | "deepseek"
    text: str


_DIRECTIONS = {"up": "al alza", "down": "a la baja"}


def render_template(payload: dict) -> str:
    """Deterministic prose from the aggregated payload."""
    unit = payload["unit"]
    drivers = payload["drivers"]
    top = ", ".join(
        f"{_driver_name(d)} ({_DIRECTIONS.get(d.get('direction'), d.get('direction', ''))})"
        for d in drivers
    )
    actions = "; ".join(d["action"] for d in drivers if d.get("action"))
    return (
        f"Para {unit}, el pronóstico está impulsado principalmente por: {top}. "
        f"Acciones preventivas recomendadas: {actions}."
    )


def _driver_name(driver: dict) -> str:
    return driver.get("driver") or driver.get("feature") or ""


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
