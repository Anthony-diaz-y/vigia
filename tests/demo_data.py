"""Deterministic demo dataset so the dashboard is viewable immediately.

Synthetic only: no row here is real surveillance data.
"""

from __future__ import annotations

DEMO_HEADER = (
    "departamento,provincia,distrito,enfermedad,ano,semana,diagnostico,"
    "tipo_diagnostico,ubigeo,edad,tipo_edad,sexo,casos"
)

_UBIGEO = {
    "LORETO": "160110",
    "PIURA": "200101",
    "LIMA": "150101",
    "AMAZONAS": "010101",
}

_TREND = {"LORETO": 1, "PIURA": 2, "LIMA": 3, "AMAZONAS": 0}


def demo_csv_text() -> str:
    """Build a three-year, four-department weekly series in the MINSA schema."""
    seasonal = [20 + (i * 3) % 10 for i in range(52)]
    lines = [DEMO_HEADER]
    for department, ubigeo in _UBIGEO.items():
        trend = _TREND[department]
        for year in (2022, 2023, 2024):
            for week in range(1, 53):
                index = (year - 2022) * 52 + (week - 1)
                value = max(0, seasonal[week - 1] + trend * index + (index * 7) % 5 - 2)
                lines.append(
                    f"{department},{department},{department},DENGUE,{year},{week},"
                    f"DENGUE SIN SIGNOS DE ALARMA,CONFIRMADO,{ubigeo},30,ANOS,F,{value}"
                )
    return "\n".join(lines) + "\n"
